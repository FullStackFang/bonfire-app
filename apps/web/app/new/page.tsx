import { NewCircleForm } from '@/components/asker/NewCircleForm'

export const dynamic = 'force-dynamic'

export default function NewCirclePage() {
  return (
    <main className="mx-auto min-h-screen max-w-md bg-neutral-950 p-6 text-neutral-100">
      <h1 className="mb-1 text-2xl font-semibold">🔥 Start a circle</h1>
      <p className="mb-6 text-sm text-neutral-400">
        Verbs default to 🍜 ☕ 🏃 📺 and the asker's cadence defaults to Tue 5pm → Thu 7pm and Sun 11am → Sat 11am.
        Founders edit those in the database during the test.
      </p>
      <NewCircleForm />
    </main>
  )
}
