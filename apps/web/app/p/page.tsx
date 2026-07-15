import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import * as repo from '@/lib/pulse/repo'
import { getViewer, isVerified, toPublicViewer } from '@/lib/pulse/identity'
import { serializeDash } from '@/lib/pulse/serialize'
import { isCrawler } from '@/lib/pulse/ratelimit'
import { dashCopy } from '@/lib/pulse/copy'
import { BrandRow, CrewCard, PulseCard } from './ui.client'
import { RecoveryEntry } from './dash.client'

// The home of the pulse rail: everything the viewer is part of, read once from the cookie
// identity and rendered server-side. A launchpad, not a live surface — no polling; freshness
// lives on the crew/pulse pages it links to.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Bonfire',
  robots: { index: false }, // participant-scoped — never index
}

const EARLIER_CAP = 10

export default async function DashPage() {
  const viewer = await getViewer()
  const now = new Date()
  const [crews, pulses] = viewer
    ? await Promise.all([
        repo.crewsForParticipant(viewer.id),
        repo.pulsesForParticipant(viewer.id, now, EARLIER_CAP),
      ])
    : [[], { live: [], earlier: [] }]

  // Funnel: one dash_view per human load; crawlers excluded.
  const ua = (await headers()).get('user-agent')
  if (!isCrawler(ua)) {
    await repo.logEvent('dash_view', { participantId: viewer?.id ?? null })
  }

  const dash = serializeDash(crews, pulses, toPublicViewer(viewer))
  const empty = dash.live.length === 0 && dash.crews.length === 0 && dash.earlier.length === 0
  // Identity chrome only when it can help: unverified (verify makes this device durable) or
  // empty (a returning participant on a fresh device recovers everything here).
  const showRecovery = !isVerified(viewer) || empty

  return (
    <main className="mx-auto min-h-full w-full max-w-md px-4 pt-4 pb-8">
      <BrandRow />

      {empty ? (
        <>
          <h1 className="bp-title mt-3 mb-1">{dashCopy.emptyTitle}</h1>
          <p className="bp-sub mb-6">{dashCopy.emptyBlurb}</p>
          <Link href="/p/new" className="bp-btn bp-btn--primary w-full" style={{ textDecoration: 'none' }}>
            {dashCopy.startCta}
          </Link>
        </>
      ) : (
        <>
          <h1 className="bp-title mt-3">{dashCopy.title}</h1>

          {/* Live pulses — same card as the board, plus my status / creator credit. */}
          <div className="bp-overline mt-6 mb-2">
            <span className="bp-live"><span className="bonfire-pulse-dot" />{dashCopy.liveOverline}</span>
          </div>
          {dash.live.length === 0 && <p className="bp-sub">{dashCopy.liveEmpty}</p>}
          <ul className="space-y-2">
            {dash.live.map((p) => (
              <li key={p.token}><PulseCard p={p} variant="live" /></li>
            ))}
          </ul>

          {/* Crews — name + MY status only; the roster lives on the board itself. */}
          <div className="bp-overline mt-6 mb-2">{dashCopy.crewsOverline}</div>
          {dash.crews.length === 0 && <p className="bp-sub">{dashCopy.crewsEmpty}</p>}
          <ul className="space-y-2">
            {dash.crews.map((c) => (
              <li key={c.token}><CrewCard c={c} /></li>
            ))}
          </ul>

          {/* Quiet history — muted, capped, no judgment attached to anything here. */}
          {dash.earlier.length > 0 && (
            <>
              <div className="bp-overline mt-6 mb-2">{dashCopy.earlierOverline}</div>
              <ul className="space-y-2" style={{ opacity: 0.62 }}>
                {dash.earlier.map((p) => (
                  <li key={p.token}><PulseCard p={p} variant="earlier" /></li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {showRecovery && <RecoveryEntry />}
    </main>
  )
}
