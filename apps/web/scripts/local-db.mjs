// Local Postgres for the pulse rail — with no Docker and no native/embedded Postgres
// (this repo is developed on Windows ARM64, where `supabase start` and `embedded-postgres`
// don't run). PGlite is a real Postgres compiled to wasm; `pg-gateway` fronts it with the
// Postgres wire protocol so the app's `postgres` driver connects to it unchanged.
//
// Multi-connection matters: PGLiteSocketServer allows only ONE connection and collides with
// the Next pool. pg-gateway accepts many connections onto the single (serial) PGlite backend.
// Keep the app pool at max:1 (the default) so concurrent requests don't interleave prepared
// statements on that single backend.
//
// Data persists in apps/web/.local-db so your boards survive a restart. Delete that dir to reset.
import { PGlite } from '@electric-sql/pglite'
import { createServer } from 'node:net'
import { fromNodeSocket } from 'pg-gateway/node'
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..', '..')
const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase', 'migrations')
const DATA_DIR = join(__dirname, '..', '.local-db')
const PORT = Number(process.env.LOCAL_DB_PORT ?? 5433)

const db = new PGlite(DATA_DIR)
await db.waitReady

// Every pulse migration, in filename (= timestamp) order, hashed together so we can detect
// when the SQL changed after this data dir was built (the migration is still being drafted).
const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.includes('pulse') && f.endsWith('.sql')).sort()
if (files.length === 0) throw new Error('no pulse migrations found in ' + MIGRATIONS_DIR)
const digest = files
  .reduce((h, f) => h.update(f + '\n' + readFileSync(join(MIGRATIONS_DIR, f), 'utf8') + '\n'), createHash('sha256'))
  .digest('hex')

const has = await db.query("select 1 from information_schema.schemata where schema_name='pulse'")
if (has.rows.length === 0) {
  for (const f of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
    console.log('[local-db] applied ' + f)
  }
  await db.exec('create table if not exists public._local_db_meta (key text primary key, value text)')
  await db.query(
    "insert into public._local_db_meta (key, value) values ('migrations_sha256', $1) on conflict (key) do update set value = excluded.value",
    [digest],
  )
} else {
  const meta = await db
    .query("select value from public._local_db_meta where key='migrations_sha256'")
    .catch(() => ({ rows: [] }))
  if (meta.rows[0]?.value === digest) {
    console.log('[local-db] pulse schema up to date (reusing ' + DATA_DIR + ')')
  } else {
    console.warn('[local-db] ⚠ migration files changed since this data dir was built — the schema here is STALE')
    console.warn('[local-db] ⚠ delete apps/web/.local-db and rerun to rebuild with the current schema')
  }
}

const server = createServer(async (socket) => {
  // A client vanishing mid-connection (dev-server restart, killed test run) emits an async
  // ECONNRESET on the socket; unhandled, it crashes the whole DB process.
  socket.on('error', (e) => {
    if (e.code !== 'ECONNRESET') console.error('[local-db] socket error:', e.message)
  })
  try {
    await fromNodeSocket(socket, {
      serverVersion: '16.3',
      auth: { method: 'trust' },
      async onStartup() { await db.waitReady },
      async onMessage(data, { isAuthenticated }) {
        if (!isAuthenticated) return
        return await db.execProtocolRaw(data)
      },
    })
  } catch (e) {
    console.error('[local-db] connection error:', e?.message)
  }
})

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`[local-db] port ${PORT} already in use — is another local-db running?`)
  else console.error('[local-db] server error:', e.message)
  process.exit(1)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[local-db] Postgres (PGlite) ready on 127.0.0.1:${PORT}`)
  console.log(`[local-db] DATABASE_URL=postgresql://postgres@127.0.0.1:${PORT}/postgres`)
})

const shutdown = async () => {
  server.close()
  await db.close().catch(() => {})
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
