import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import * as repo from '@/lib/pulse/repo'
import { getViewer, toPublicViewer } from '@/lib/pulse/identity'
import { serializeBoard } from '@/lib/pulse/serialize'
import { isCrawler } from '@/lib/pulse/ratelimit'
import { ogCopy } from '@/lib/pulse/copy'
import { Board } from './Board.client'

// Reading the cookie (viewer) makes this dynamic. First paint is the server snapshot, so the
// page works in WhatsApp's in-app browser before any client JS hydrates.
export const dynamic = 'force-dynamic'

// Evergreen unfurl: built solely from the creator-set crew name, never a live count/roster.
// opengraph-image.tsx supplies the image meta (absolute URL + width/height) automatically.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const crew = await repo.getCrewByToken(token)
  if (!crew) return { robots: { index: false } }
  const title = ogCopy.crewTitle(crew.name)
  const description = ogCopy.crewDescription()
  return {
    title,
    description,
    robots: { index: false }, // a link is the only access control — never index it
    openGraph: { title, description, url: `/p/c/${crew.token}`, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function CrewPage({ params, searchParams }: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ compose?: string }>
}) {
  const { token } = await params
  const { compose } = await searchParams
  const crew = await repo.getCrewByToken(token)
  if (!crew) notFound()

  const viewer = await getViewer()
  const now = new Date()
  const [presence, pulses, members] = await Promise.all([
    repo.presenceForCrew(crew.id),
    repo.activePulsesForCrew(crew.id, now),
    repo.membersForCrew(crew.id),
  ])

  // Funnel: count a real human open, not a chat-app crawler fetching the unfurl.
  // after(): analytics never holds up first paint (same pattern as the dash).
  const ua = (await headers()).get('user-agent')
  if (!isCrawler(ua)) {
    after(() => repo.logEvent('open', { crewId: crew.id, participantId: viewer?.id ?? null }))
  }

  const board = serializeBoard(crew, presence, pulses, members, toPublicViewer(viewer))

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <Board initial={board} crewToken={crew.token} autoCompose={compose === '1'} />
    </main>
  )
}
