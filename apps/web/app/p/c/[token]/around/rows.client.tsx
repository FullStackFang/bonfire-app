'use client'
import Link from 'next/link'
import type { ResolvedAvailability } from '@/lib/pulse/availability'
import { Avatar } from '../../../ui.client'

// One member row in Who's-Around. Color semantics are load-bearing (spec: availability):
// solid green = free, amber/lighter = probably_free, muted grey + label = busy,
// neutral outline = unknown. Coral stays reserved for actions — here, the drop-a-pulse
// handoff, which itself sends nothing.

export type AroundRowData = {
  participantId: string
  displayName: string
  me: boolean
  resolved: ResolvedAvailability
  presence: { label: string; note: string | null } | null
}

const PILL_STYLE: Record<ResolvedAvailability['availability'], React.CSSProperties> = {
  free: { background: 'var(--spark)', color: 'var(--hearth)' },
  probably_free: { background: 'var(--dusk-tint)', color: 'var(--dusk)' },
  busy: { background: '#f1eeec', color: 'var(--smoke)' },
  unknown: { background: 'transparent', color: 'var(--smoke)', border: '1px solid var(--ash)' },
}

const PILL_TEXT: Record<ResolvedAvailability['availability'], string> = {
  free: 'free',
  probably_free: 'probably free',
  busy: 'busy',
  unknown: 'no signal yet',
}

export function AroundRow({ crewToken, row }: { crewToken: string; row: AroundRowData }) {
  const a = row.resolved.availability
  const tappable = !row.me && (a === 'free' || a === 'probably_free')
  const muted = a === 'busy'

  const card = (
    <div className={`bp-card${row.me ? ' bp-card--you' : ''} flex items-start gap-3 px-[13px] py-[11px]`}
      style={muted ? { opacity: 0.66 } : undefined}>
      <Avatar name={row.displayName} seed={row.participantId} ring={row.me} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span style={{ fontWeight: 600, fontSize: 14.5 }}>{row.displayName}</span>
          {row.me && <span className="bp-you-badge">YOU</span>}
        </div>
        <div className="mt-[7px] flex flex-wrap items-center gap-1.5">
          <span className="bp-pill" style={PILL_STYLE[a]}>
            {PILL_TEXT[a]}
            {row.resolved.label && a === 'busy' && (
              <span style={{ fontWeight: 400 }}>· {row.resolved.label}</span>
            )}
          </span>
          {row.presence && (
            <span className="bp-pill" style={{ background: 'var(--hearth)', color: 'var(--smoke)', border: '1px solid var(--ash)' }}>
              on the board: {row.presence.label}
            </span>
          )}
        </div>
        {row.presence?.note && (
          <div className="mt-1.5" style={{ fontSize: 12.5, color: 'var(--smoke)', lineHeight: 1.35 }}>
            “{row.presence.note}”
          </div>
        )}
      </div>
      {tappable && (
        <span className="bp-pin-chip" style={{ marginLeft: 0, alignSelf: 'center' }}>
          drop a pulse →
        </span>
      )}
    </div>
  )

  // The handoff routes into the composer scoped to this crew — it sends nothing itself.
  return tappable
    ? <Link href={`/p/c/${crewToken}?compose=1`} style={{ color: 'inherit', textDecoration: 'none' }}>{card}</Link>
    : card
}
