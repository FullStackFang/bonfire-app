import type { Metadata } from 'next'
import { getViewer, toPublicViewer } from '@/lib/pulse/identity'
import { getPublicAround } from '@/lib/pulse/around'
import { AroundView } from './Around.client'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Who’s around · Bonfire', robots: { index: false } }

export default async function AroundPage() {
  const viewer = await getViewer()
  const initial = await getPublicAround(toPublicViewer(viewer))
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-6">
      <AroundView initial={initial} />
    </main>
  )
}
