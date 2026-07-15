// One command to run the pulse rail locally: `npm run dev:local`.
// Starts the local PGlite Postgres (scripts/local-db.mjs) and, once it's listening,
// launches `next dev` wired to it with a matching APP_BASE_URL. Ctrl-C stops both.
import { spawn, spawnSync } from 'node:child_process'
import { createConnection } from 'node:net'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PORT = Number(process.env.LOCAL_DB_PORT ?? 5433)
const APP_PORT = Number(process.env.PORT ?? 3001) // 3000 is usually taken by the asker
const DATABASE_URL = `postgresql://postgres@127.0.0.1:${DB_PORT}/postgres`
const APP_BASE_URL = `http://localhost:${APP_PORT}`

const children = []
let stopping = false
// killChildren=false on the Ctrl-C path: the shared console already delivered the signal to
// the whole tree, and a hard kill would race the children's own graceful shutdown. On failure
// paths there is no signal, so kill explicitly — on Windows, c.kill() only terminates the
// cmd.exe wrapper, so take down the whole tree with taskkill.
function stop(code = 0, killChildren = true) {
  if (stopping) return
  stopping = true
  if (killChildren) {
    for (const c of children) {
      try {
        if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' })
        else c.kill()
      } catch {}
    }
  }
  process.exit(code)
}
process.on('SIGINT', () => stop(0, false))
process.on('SIGTERM', () => stop(0, false))

function portInUse(port) {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host: '127.0.0.1' })
    sock.once('connect', () => { sock.destroy(); resolve(true) })
    sock.once('error', () => { sock.destroy(); resolve(false) })
  })
}

function waitForPort(port, timeoutMs = 20000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    let done = false
    const finish = (fn, arg) => { if (!done) { done = true; fn(arg) } }
    const tryOnce = () => {
      if (done) return
      const sock = createConnection({ port, host: '127.0.0.1' })
      sock.once('connect', () => { sock.destroy(); finish(resolve) })
      sock.once('error', () => {
        sock.destroy()
        if (Date.now() - start > timeoutMs) finish(reject, new Error(`DB port ${port} not up after ${timeoutMs}ms`))
        else setTimeout(tryOnce, 300)
      })
    }
    tryOnce()
  })
}

// Refuse to start over stale listeners: a leftover DB would mask this run's schema state, and
// next dev silently hops to another port, leaving APP_BASE_URL (share links, OG) pointing at
// whatever squats on this one.
for (const [port, what, envVar] of [[DB_PORT, 'local DB', 'LOCAL_DB_PORT'], [APP_PORT, 'app', 'PORT']]) {
  if (await portInUse(port)) {
    console.error(`[dev:local] port ${port} (${what}) is already in use — stop what's running there or set ${envVar}.`)
    process.exit(1)
  }
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

// 1) local DB
const db = spawn(process.execPath, [join(__dirname, 'local-db.mjs')], {
  stdio: 'inherit', env: { ...process.env, LOCAL_DB_PORT: String(DB_PORT) },
})
children.push(db)
db.on('exit', (code) => {
  if (!stopping) { console.error('[dev:local] local-db exited unexpectedly', code ?? ''); stop(1) }
})

// 2) next dev, once the DB accepts connections
await waitForPort(DB_PORT).catch((e) => { console.error('[dev:local]', e.message); stop(1) })
console.log(`[dev:local] DB up — starting Next.js on ${APP_BASE_URL}`)
const web = spawn(npmCmd, ['run', 'dev'], {
  stdio: 'inherit', shell: process.platform === 'win32',
  env: { ...process.env, DATABASE_URL, APP_BASE_URL, PORT: String(APP_PORT), PG_POOL_MAX: '1' },
})
children.push(web)
web.on('exit', (code) => {
  if (!stopping) { console.log('[dev:local] next dev exited', code ?? ''); stop(code ?? 0) }
})
