import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getViewer, toPublicViewer } from '@/lib/pulse/identity'
import { getPlanByToken, getPublicPlanByToken } from '@/lib/pulse/plan'
import { PlanView } from './PlanView.client'

export const dynamic = 'force-dynamic'

// Evergreen unfurl: the opener's intent only — never who has marked availability or a live count.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const plan = await getPlanByToken(token)
  if (!plan) return { robots: { index: false } }
  const title = 'A plan on Bonfire'
  const description = `${plan.intentText} — tap the times you’re free.`
  return {
    title, description, robots: { index: false },
    openGraph: { title, description, url: `/p/plan/${token}`, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function PlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const viewer = await getViewer()
  const plan = await getPublicPlanByToken(token, toPublicViewer(viewer))
  if (!plan) notFound()

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-6">
      <PlanView initial={plan} token={token} />
    </main>
  )
}
