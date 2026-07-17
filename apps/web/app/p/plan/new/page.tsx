import type { Metadata } from 'next'
import { PlanNew } from './PlanNew.client'

export const metadata: Metadata = { title: 'New plan · Bonfire', robots: { index: false } }

// `?intent=` pre-seeds the intent field — how a mutual ember's "start the next one" flows into
// the normal creation path (close-plan-loop D6). Just a prefill: the initiator still reviews,
// publishes, and shares the link themselves; nothing is sent to anyone.
export default async function NewPlanPage({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  const { intent } = await searchParams
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-6">
      <PlanNew initialIntent={typeof intent === 'string' ? intent.slice(0, 500) : ''} />
    </main>
  )
}
