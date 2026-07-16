import type { Metadata } from 'next'
import { PlanNew } from './PlanNew.client'

export const metadata: Metadata = { title: 'New plan · Bonfire', robots: { index: false } }

export default function NewPlanPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-6">
      <PlanNew />
    </main>
  )
}
