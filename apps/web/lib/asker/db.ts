import postgres from 'postgres'

let client: ReturnType<typeof postgres> | null = null

export function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    // Supabase transaction pooler: prepare must be false; keep the pool tiny on serverless.
    client = postgres(url, { prepare: false, max: 1, transform: postgres.camel })
  }
  return client
}
