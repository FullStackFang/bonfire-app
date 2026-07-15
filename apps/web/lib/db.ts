import postgres from 'postgres'

let client: ReturnType<typeof postgres> | null = null

// One pool per process, shared by every rail (asker, pulse). Forking a second
// `max:1` pool per serverless instance would double pooler connections — and the
// pulse rail's polling makes that worse. Domains stay isolated by schema, not pool.
export function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    // Supabase transaction pooler: prepare must be false; keep the pool tiny on serverless.
    client = postgres(url, {
      prepare: false,
      max: Number(process.env.PG_POOL_MAX ?? 1),
      transform: postgres.camel,
    })
  }
  return client
}
