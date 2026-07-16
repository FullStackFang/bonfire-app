'use client'
import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import type { BoardStatus, PublicDashCrew, PublicDashPulse, PublicPlanOption, PulseStatus } from '@/lib/pulse/types'
import { BOARD_STATUS_LABEL, PULSE_STATUS_LABEL, dashCopy } from '@/lib/pulse/copy'

// Shared Live Pulse primitives, ported from design/bonfire-design-system
// (Ember, Overline, StatusPill, Avatar, chunky press, slide-up sheet).

// ── brand ────────────────────────────────────────────────────────────

export function EmberMark({ size = 16, glow = false }: { size?: number; glow?: boolean }) {
  return <span className={`bp-ember${glow ? ' bp-ember--glow' : ''}`} style={{ width: size, height: size }} aria-hidden />
}

export function BrandRow({ children }: { children?: React.ReactNode }) {
  return (
    <div className="bp-brandrow flex items-center gap-2">
      {/* The way back home: every rail surface reaches the dash through the brand.
         On desktop the left rail owns brand + home, so this lockup hides (bp-brandrow-home)
         while any children — e.g. the ShareChip on detail pages — stay in the row. */}
      <Link href="/p" className="bp-brandrow-home flex items-center gap-2" style={{ textDecoration: 'none', color: 'inherit' }}>
        <EmberMark glow />
        <span className="bp-wordmark">BONFIRE</span>
      </Link>
      {children}
    </div>
  )
}

export function ShareChip() {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="bp-pin-chip"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {}
      }}
    >
      {copied ? 'copied' : 'share link'}
    </button>
  )
}

// ── identity ─────────────────────────────────────────────────────────

const AVATAR_ACCENTS = ['#5E7FE5', '#1A9E75', '#9D5BC2', '#E2843D', '#E2B33D', '#666f7d']

export function avatarColorFor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_ACCENTS[Math.abs(hash) % AVATAR_ACCENTS.length]
}

export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
}

export function Avatar({ name, seed, size = 40, live = false, ring = false }: {
  name: string; seed: string; size?: number; live?: boolean; ring?: boolean
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {live && (
        <span
          className="bonfire-pulse-dot"
          style={{
            position: 'absolute', inset: -Math.round(size * 0.18), width: 'auto', height: 'auto',
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(84,176,90,0.53) 0%, rgba(84,176,90,0) 68%)',
          }}
        />
      )}
      <span
        className="relative z-[1] flex items-center justify-center rounded-full text-white"
        style={{
          width: size, height: size, background: avatarColorFor(seed),
          fontWeight: 600, fontSize: size * 0.36, letterSpacing: 0.2,
          border: ring ? '2.5px solid var(--ember)' : '2px solid var(--hearth)', boxSizing: 'border-box',
        }}
      >
        {initialsFor(name)}
      </span>
    </span>
  )
}

// ── status pill ──────────────────────────────────────────────────────

const BOARD_PILL: Record<BoardStatus, { fg: string; bg: string }> = {
  around: { fg: 'var(--spark)', bg: 'var(--spark-tint)' },
  busy: { fg: 'var(--dusk)', bg: 'var(--dusk-tint)' },
  away: { fg: '#7A6C82', bg: '#efeaf0' },
  out: { fg: 'var(--smoke)', bg: '#f1eeec' },
}

const PULSE_PILL: Record<PulseStatus, { fg: string; bg: string }> = {
  in: { fg: 'var(--ember-deep)', bg: 'var(--ember-tint)' },
  on_my_way: { fg: 'var(--dusk)', bg: 'var(--dusk-tint)' },
  here: { fg: 'var(--spark)', bg: 'var(--spark-tint)' },
  out: { fg: 'var(--smoke)', bg: '#f1eeec' },
}

export function StatusPill(props:
  | { kind: 'board'; status: BoardStatus; label: string; time?: string }
  | { kind: 'pulse'; status: PulseStatus; label: string; time?: string }
) {
  const c = props.kind === 'board' ? BOARD_PILL[props.status] : PULSE_PILL[props.status]
  const here = props.kind === 'pulse' && props.status === 'here'
  const otw = props.kind === 'pulse' && props.status === 'on_my_way'
  return (
    <span className="bp-pill" style={{ background: c.bg, color: c.fg }}>
      {here && <span className="bonfire-pulse-dot" style={{ width: 6, height: 6 }} />}
      {otw && <span style={{ fontSize: 11 }}>→</span>}
      {props.label}
      {props.time && (
        <>
          <span style={{ opacity: 0.55 }}>·</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 400, fontSize: 11 }}>{props.time}</span>
        </>
      )}
    </span>
  )
}

// ── roster row ───────────────────────────────────────────────────────

export function PresenceItem({ name, seed, you = false, live = false, note, pill }: {
  name: string; seed: string; you?: boolean; live?: boolean; note?: string | null; pill: React.ReactNode
}) {
  return (
    <div className={`bp-card${you ? ' bp-card--you' : ''} flex items-start gap-3 px-[13px] py-[11px]`}>
      <Avatar name={name} seed={seed} live={live} ring={you} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span style={{ fontWeight: 600, fontSize: 14.5 }}>{name}</span>
          {you && <span className="bp-you-badge">YOU</span>}
        </div>
        <div className="mt-[7px]">{pill}</div>
        {note && <div className="mt-1.5" style={{ fontSize: 12.5, color: 'var(--smoke)', lineHeight: 1.35 }}>“{note}”</div>}
      </div>
    </div>
  )
}

// ── dash cards (shared by the rail, Events, and Groups surfaces) ─────

// One event/pulse card. `live` = the ember-cream card with title, TTL, my status and creator
// credit; `earlier` = the muted, single-line history card. Both link to the pulse page.
export function PulseCard({ p, variant }: { p: PublicDashPulse; variant: 'live' | 'earlier' }) {
  if (variant === 'earlier') {
    return (
      <Link href={`/p/s/${p.token}`} className="bp-card block px-4 py-3" style={{ color: 'inherit' }}>
        <span className="block truncate" style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--smoke)' }}>
          {p.title}
        </span>
        <span className="mt-0.5 block truncate" style={{ fontSize: 12, color: 'var(--smoke)' }}>
          {p.place} · {p.timeLabel}{p.crewName && <> · {p.crewName}</>}
        </span>
      </Link>
    )
  }
  return (
    <Link href={`/p/s/${p.token}`} className="bp-card bp-card--spark block px-4 py-3.5" style={{ color: 'inherit' }}>
      <span className="flex items-baseline gap-2">
        <span className="bp-num" style={{ fontSize: 18 }}>{p.title}</span>
        <span className="ml-auto"><EndsAt iso={p.expiresAt} /></span>
      </span>
      <span className="mt-0.5 block" style={{ fontSize: 12, color: 'var(--smoke)' }}>
        <b style={{ color: 'var(--coal)', fontWeight: 600 }}>{p.place}</b> · {p.timeLabel}
        {p.crewName && <> · {p.crewName}</>}
      </span>
      <span className="mt-2 flex items-center gap-2">
        {p.myStatus && <StatusPill kind="pulse" status={p.myStatus} label={PULSE_STATUS_LABEL[p.myStatus]} />}
        {p.droppedByMe && (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ember-deep)' }}>{dashCopy.droppedByYou}</span>
        )}
      </span>
    </Link>
  )
}

// One group/crew card: name + the viewer's own note and status only (the roster lives on the
// board). Links to the crew board.
export function CrewCard({ c }: { c: PublicDashCrew }) {
  return (
    <Link href={`/p/c/${c.token}`} className="bp-card flex items-center gap-3 px-4 py-3.5" style={{ color: 'inherit' }}>
      <span className="min-w-0 flex-1">
        <span className="block truncate" style={{ fontWeight: 600, fontSize: 14.5 }}>{c.name}</span>
        {c.myNote && (
          <span className="mt-0.5 block truncate" style={{ fontSize: 12.5, color: 'var(--smoke)' }}>“{c.myNote}”</span>
        )}
      </span>
      {c.myStatus && <StatusPill kind="board" status={c.myStatus} label={BOARD_STATUS_LABEL[c.myStatus]} />}
    </Link>
  )
}

// ── plan option typesetting (link view + opener review share it) ─────

// The server label is "Fri, Jul 17 · 6:30 PM · Blue Bottle Coffee". Split the venue
// off so the time leads and the place gets its own line instead of one long bold
// string wrapping mid-venue. Falls back to the whole label if the shape differs.
export function splitPlanLabel(label: string, venueName?: string | null): { time: string; venue: string | null } {
  if (venueName && label.endsWith(` · ${venueName}`)) {
    return { time: label.slice(0, label.length - venueName.length - 3), venue: venueName }
  }
  return { time: label, venue: null }
}

// Card body for one plan option: time lead, venue line, rationale, and (on the link
// view) the availability count typeset as a numeral — never chipped.
export function PlanOptionBody({ o, showCount = false }: { o: PublicPlanOption; showCount?: boolean }) {
  const { time, venue } = splitPlanLabel(o.label, o.venue?.name)
  return (
    <>
      <span className="flex items-baseline gap-2.5">
        <span style={{ fontWeight: 600, fontSize: 15, lineHeight: '21px' }}>{time}</span>
        {showCount && o.availableCount > 0 && (
          <span className="bp-num ml-auto whitespace-nowrap" style={{ fontSize: 15, color: 'var(--ember-deep)' }}>
            {o.availableCount} free
          </span>
        )}
      </span>
      {venue && (
        <span className="block" style={{ fontWeight: 500, fontSize: 13, marginTop: 1 }}>{venue}</span>
      )}
      {o.aiRationale && (
        <span className="block" style={{ fontSize: 12.5, color: 'var(--smoke)', marginTop: 3, lineHeight: '17px' }}>
          {o.aiRationale}
        </span>
      )}
    </>
  )
}

// ── ttl label (client-clock formatting; render after mount to avoid
//    a server/client timezone hydration mismatch) ─────────────────────

const emptySubscribe = () => () => {}

export function EndsAt({ iso }: { iso: string }) {
  // Render nothing on the server and on the hydration pass; only the mounted client
  // formats the label (its own clock/timezone) — avoids a hydration mismatch.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  if (!mounted) return null
  const d = new Date(iso)
  let h = d.getHours()
  const m = d.getMinutes()
  const ap = h >= 12 ? 'p' : 'a'
  h = h % 12 || 12
  const label = `ends ${h}${m ? ':' + String(m).padStart(2, '0') : ''}${ap}`
  return <span className="bp-mono whitespace-nowrap" style={{ fontSize: 9.5 }}>{label}</span>
}

// ── slide-up sheet ───────────────────────────────────────────────────

export function Sheet({ open, onClose, title, blurb, children }: {
  open: boolean; onClose: () => void; title: string; blurb?: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="bp-sheet-wrap">
      <div className="bp-scrim" onClick={onClose} />
      <div className="bp-sheet" role="dialog" aria-label={title}>
        <div className="bp-grab" />
        <h3 className="bp-sheet-title">{title}</h3>
        {blurb && <p className="bp-sheet-blurb">{blurb}</p>}
        {children}
      </div>
    </div>
  )
}
