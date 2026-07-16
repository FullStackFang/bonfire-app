import type { Metadata } from 'next'
import Link from 'next/link'
import { getViewer, toPublicViewer } from '@/lib/pulse/identity'
import { viewerPulses } from '@/lib/pulse/dashReads'
import { serializeDash } from '@/lib/pulse/serialize'
import { dashCopy, navCopy } from '@/lib/pulse/copy'
import { BrandRow, PulseCard } from '../ui.client'

// The Events tab: the viewer's live + earlier events, reusing the dash's pulse read, serializer,
// and card markup. A thin slice of the rail — no new data source, no polling (freshness lives on
// the pulse pages this links to).

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `${navCopy.eventsTitle} · Bonfire`,
  robots: { index: false }, // participant-scoped — never index
}

export default async function EventsPage() {
  const viewer = await getViewer()
  const pulses = viewer ? await viewerPulses(viewer.id) : { live: [], earlier: [] }

  const dash = serializeDash([], pulses, toPublicViewer(viewer))
  const empty = dash.live.length === 0 && dash.earlier.length === 0

  return (
    <main className={`mx-auto min-h-full w-full px-4 pt-4 pb-8 ${empty ? 'max-w-md' : 'bp-main-wide'}`}>
      <BrandRow />
      <h1 className="bp-title mt-3">{navCopy.eventsTitle}</h1>

      {empty ? (
        <>
          <p className="bp-sub mt-1 mb-6">{navCopy.eventsEmptyBlurb}</p>
          <Link href="/p/new" className="bp-btn bp-btn--primary w-full" style={{ textDecoration: 'none' }}>
            {navCopy.startCta}
          </Link>
        </>
      ) : (
        <>
          <div className="bp-overline mt-6 mb-2">
            <span className="bp-live"><span className="bonfire-pulse-dot" />{dashCopy.liveOverline}</span>
          </div>
          {dash.live.length === 0 && <p className="bp-sub">{dashCopy.liveEmpty}</p>}
          <ul className="bp-list">
            {dash.live.map((p) => (
              <li key={p.token}><PulseCard p={p} variant="live" /></li>
            ))}
          </ul>

          {dash.earlier.length > 0 && (
            <>
              <div className="bp-overline mt-6 mb-2">{dashCopy.earlierOverline}</div>
              <ul className="bp-list" style={{ opacity: 0.62 }}>
                {dash.earlier.map((p) => (
                  <li key={p.token}><PulseCard p={p} variant="earlier" /></li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  )
}
