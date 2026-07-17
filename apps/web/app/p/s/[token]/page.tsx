import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import * as repo from '@/lib/pulse/repo'
import { getViewer, toPublicViewer } from '@/lib/pulse/identity'
import { serializePulse } from '@/lib/pulse/serialize'
import { isCrawler } from '@/lib/pulse/ratelimit'
import { ogCopy } from '@/lib/pulse/copy'
import { PulseView } from './Pulse.client'

export const dynamic = 'force-dynamic'

// Evergreen unfurl: the creator-set title/place/time only — never participant notes or a live count.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const pulse = await repo.getPulseByToken(token)
  if (!pulse) return { robots: { index: false } }
  const title = ogCopy.pulseTitle(pulse.title)
  const description = ogCopy.pulseDescription(pulse.place, pulse.timeLabel)
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, url: `/p/s/${pulse.token}`, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function PulsePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const pulse = await repo.getPulseByToken(token)
  if (!pulse) notFound()

  const viewer = await getViewer()
  const now = new Date()
  const [responses, crew] = await Promise.all([
    repo.responsesForPulse(pulse.id),
    pulse.crewId ? repo.getCrewById(pulse.crewId) : Promise.resolve(null),
  ])

  const ua = (await headers()).get('user-agent')
  if (!isCrawler(ua)) {
    await repo.logEvent('open', { pulseId: pulse.id, crewId: pulse.crewId, participantId: viewer?.id ?? null })
  }

  const initial = serializePulse(pulse, responses, toPublicViewer(viewer), crew, now)

  return (
    <main className="bpd-main mx-auto flex min-h-full w-full max-w-md flex-col">
      <PulseView initial={initial} pulseToken={pulse.token} />
    </main>
  )
}
