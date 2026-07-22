'use client'
import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createStore, useStore } from 'zustand'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { PULSE_STATUSES, POD_KINDS, type PodKind, type PulsePhase, type PulseStatus, type PublicPulse, type PublicPulseHeadcount, type PublicPulsePod, type PublicPulseResponse, type PublicViewer } from '@/lib/pulse/types'
import { PULSE_STATUS_LABEL, CAPS, pulseMessage, authCopy, podCopy, headcountCopy } from '@/lib/pulse/copy'
import { startsLabel, remainingLabel } from '@/lib/pulse/time'
import { usePulsePoll } from '@/lib/pulse/usePulsePoll'
import { avatarColorFor, initialsFor } from '../../ui.client'
import { VerifySheet } from '../../verify.client'

// The desktop hero's basemap ships in its own chunk (maplibre-gl + tile CSS) fetched only when it
// renders — i.e. only for a resolved coordinate. Unresolved pulses fall back to the cream gather
// and never load it.
const HeroMap = dynamic(() => import('./HeroMap.client'), { ssr: false })

// tile ordering: the people already there lead, then arrivals by ETA, then in, then out
const STATUS_ORDER: Record<PulseStatus, number> = { here: 0, on_my_way: 1, in: 2, out: 3 }
// "You're …" accent per status — matches the StatusPill palette
const YOU_COLOR: Record<PulseStatus, string> = {
  here: 'var(--spark)', on_my_way: 'var(--dusk)', in: 'var(--ember-deep)', out: 'var(--smoke)',
}
// desktop expanded-roster groups, in present-first order
const DESKTOP_GROUPS: { key: PulseStatus; label: string }[] = [
  { key: 'here', label: 'Here now' },
  { key: 'on_my_way', label: 'On the way' },
  { key: 'in', label: 'In' },
  { key: 'out', label: 'Out' },
]
// The decluttered hero shows only the people in motion. `on_my_way` are individual markers on the
// approaching ring (the focus); `here` cordon into a huddle at the fire; `in` (committed but not
// moving) live in the count + roster, never scattered. These cap how many render before a +N chip.
const HUDDLE_CAP = 4 // faces in the fire huddle before "+N"
const OTW_CAP = 7    // approaching markers on the ring before "+N"
// the slider is the attending progression only — 'out' (not coming) is a negation, not a
// point on it, so it lives as the OptOutToggle below.
const SLIDER_STATUSES = PULSE_STATUSES.filter((s) => s !== 'out')

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n

// ── desktop hero gather geometry (cinematic fixed frame) ──
// The fire sits just right of the hero's centre (52%, 57%); `on_my_way` markers take fixed seats
// around it, ordered by preference. Hand-placed in the hero's free zones — clear of the count +
// timeline (top-left), the filter pills (top-right), the feed + place cards (bottom-left), the
// here-huddle at the fire's base, and the YOU fab (bottom-right). Positions are % of the hero box;
// the first two mirror the design composition.
const OTW_SEATS: [number, number][] = [
  [57, 29], [25, 51], [72, 34], [17, 44], [80, 46], [65, 21], [87, 56], [39, 62],
]
function otwSeat(i: number): React.CSSProperties {
  const [x, y] = OTW_SEATS[i % OTW_SEATS.length]!
  return { left: `${x}%`, top: `${y}%` }
}

// A shared 1s clock as an external store, so Winddown can tick without a setState-in-effect and
// without a hydration mismatch (server snapshot is null → renders nothing until the client mounts).
let clockNow = 0
const clockSubs = new Set<() => void>()
let clockTimer: ReturnType<typeof setInterval> | null = null
function subscribeClock(cb: () => void) {
  clockSubs.add(cb)
  if (!clockTimer) {
    clockTimer = setInterval(() => { clockNow = Date.now(); clockSubs.forEach((f) => f()) }, 1000)
  }
  return () => {
    clockSubs.delete(cb)
    if (clockSubs.size === 0 && clockTimer) { clearInterval(clockTimer); clockTimer = null }
  }
}
const getClock = () => (clockNow === 0 ? (clockNow = Date.now()) : clockNow)
const getClockServer = (): number | null => null

// Ticking wind-down for the dateline: "2:47:12" (h:mm:ss, or m:ss under an hour). Null on the server
// and the hydration pass, so the client's clock can't mismatch.
function Winddown({ iso }: { iso: string }) {
  const now = useSyncExternalStore(subscribeClock, getClock, getClockServer)
  if (now === null) return null
  const ms = Math.max(0, new Date(iso).getTime() - now)
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const two = (x: number) => String(x).padStart(2, '0')
  return <span className="bpd-wind">{h > 0 ? `${h}:${two(m)}:${two(ss)}` : `${m}:${two(ss)}`}</span>
}

// Upcoming: a calm "starts in 20 min" / "starts at 8:30pm", computed fresh from start_at vs now.
function StartsIn({ iso }: { iso: string }) {
  const now = useSyncExternalStore(subscribeClock, getClock, getClockServer)
  if (now === null) return null
  return <>{startsLabel(new Date(iso), new Date(now))}</>
}

// Live: a calm "for another 45 min" / "for another 2 hrs" from expires_at vs now (the phone read;
// the desktop dateline keeps the precise ticking Winddown).
function Remaining({ iso }: { iso: string }) {
  const now = useSyncExternalStore(subscribeClock, getClock, getClockServer)
  if (now === null) return null
  return <>{remainingLabel(new Date(iso), new Date(now))}</>
}

// De-emphasised, confirm-gated "End early": the manual wrap, pulled OUT of the status region so
// reaching "here" can never end the pulse. First tap arms it; a second confirms. Blur disarms.
function EndEarly({ onEnd, disabled, className }: { onEnd: () => void; disabled?: boolean; className?: string }) {
  const [armed, setArmed] = useState(false)
  return (
    <button type="button" disabled={disabled} className={className}
      onClick={() => (armed ? onEnd() : setArmed(true))}
      onBlur={() => setArmed(false)}
      style={{
        background: 'none', border: 'none', padding: '8px 4px', cursor: 'pointer',
        fontSize: 12.5, letterSpacing: 0.2, textDecoration: 'underline', textUnderlineOffset: 3,
        color: armed ? 'var(--ember-deep)' : 'var(--smoke)',
      }}>
      {armed ? 'Tap again to end it for everyone' : 'End early'}
    </button>
  )
}

// Draggable status slider. Grab the thumb (or press anywhere on the track) and drag: the thumb
// follows the pointer, morphing to each status's colour as it crosses (in=ember, on-the-way=amber,
// here=spark), and snaps to the nearest status on release. Tap a label to slide there; arrow keys
// step. Parked on a status it breathes in the fire's 3.2s cadence. Only transform/opacity/colour
// animate — never layout. Shared by the mobile sheet and the desktop commit card (via --seg-n).
function StatusSegment({ statuses, current, onPick, disabled, dimmed, className }: {
  statuses: readonly PulseStatus[]
  current: PulseStatus | null
  onPick: (s: PulseStatus) => void
  disabled?: boolean
  dimmed?: boolean
  className?: string
}) {
  const n = statuses.length
  const idx = current ? statuses.indexOf(current) : -1     // resting slot (optimistic `current`)
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragPx, setDragPx] = useState<number | null>(null) // freeform offset while dragging
  const [nearest, setNearest] = useState(idx < 0 ? 0 : idx)
  const geom = useRef({ left: 0, segW: 0 })
  const pressing = useRef(false)
  const moved = useRef(false)
  const startX = useRef(0)

  const measure = () => {
    const el = trackRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    geom.current = { left: r.left + 4, segW: (r.width - 8) / n }
  }
  // pointer x → { pixel offset within the track, nearest segment index }
  const at = (clientX: number) => {
    const { left, segW } = geom.current
    const rel = Math.max(segW / 2, Math.min(clientX - left, n * segW - segW / 2))
    return { x: rel - segW / 2, i: Math.max(0, Math.min(n - 1, Math.round((rel - segW / 2) / segW))) }
  }
  const commit = (i: number) => {
    const s = statuses[i]
    if (s) onPick(s)
  }
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    measure()
    pressing.current = true
    moved.current = false
    startX.current = e.clientX
    trackRef.current?.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pressing.current) return
    if (!moved.current && Math.abs(e.clientX - startX.current) < 4) return // ignore jitter → taps stay taps
    moved.current = true
    const { x, i } = at(e.clientX)
    setDragPx(x)
    setNearest(i)
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pressing.current) return
    pressing.current = false
    trackRef.current?.releasePointerCapture?.(e.pointerId)
    const { i } = at(e.clientX)
    setDragPx(null) // drop freeform offset → thumb snaps to the slot via CSS transition
    commit(i)
  }
  const onPointerCancel = () => { pressing.current = false; moved.current = false; setDragPx(null) }
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const cur = idx < 0 ? 0 : idx
    let next = cur
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0, cur - 1)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(n - 1, cur + 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else return
    e.preventDefault()
    commit(next)
  }

  const dragging = dragPx != null
  const activeIdx = dragging ? nearest : idx
  const thumbStatus = activeIdx >= 0 ? statuses[activeIdx] : undefined
  const rest = idx < 0 ? 0 : idx

  return (
    <div
      ref={trackRef}
      className={`bp-seg2${dragging ? ' is-dragging' : ''}${dimmed ? ' is-muted' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--seg-n': n } as React.CSSProperties}
      role="slider" aria-label="Your status" aria-valuemin={0} aria-valuemax={n - 1}
      aria-valuenow={activeIdx >= 0 ? activeIdx : undefined}
      aria-valuetext={thumbStatus ? PULSE_STATUS_LABEL[thumbStatus] : undefined}
      aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : 0}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel} onKeyDown={onKeyDown}
    >
      <span className="bp-seg2-thumb" aria-hidden data-status={thumbStatus}
        style={dragging
          ? { opacity: 1, transform: `translateX(${dragPx}px)`, transition: 'none' }
          : { opacity: activeIdx >= 0 ? 1 : 0, transform: `translateX(${rest * 100}%)` }} />
      {statuses.map((s, i) => (
        <span key={s} className={`bp-seg2-opt${i === activeIdx ? ' is-sel' : ''}`} aria-hidden>
          {PULSE_STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  )
}

// Quiet opt-out. 'out' (not coming) is a negation, not a point on the attending slider, so it
// lives as a de-emphasised switch — muted, never alarming. Flipping it off returns you to 'in'.
function OptOutToggle({ on, onToggle, disabled }: {
  on: boolean; onToggle: (next: boolean) => void; disabled?: boolean
}) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled}
      className={`bp-optout${on ? ' is-on' : ''}`} onClick={() => onToggle(!on)}>
      <span className="bp-optout-lab">{on ? 'Not coming' : "Can’t make it"}</span>
      <span className="bp-optout-sw" aria-hidden><span className="knob" /></span>
    </button>
  )
}

function CopyButton({ text, className, label, idle, done }: {
  text: () => string; className: string; label: string; idle: React.ReactNode; done: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button" className={className} aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text())
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {}
      }}
    >
      {copied ? done : idle}
    </button>
  )
}

// Soft "save your spot" nudge in the YOU panel after an anon guest joins. One line + a dismiss —
// never covers the status control, suppressed for verified viewers and after dismiss (see saveState).
// Inline styles (not a new .bpd- class) so it reads identically in both trees and both themes.
function SaveSpotLine({ onSave, onDismiss }: { onSave: () => void; onDismiss: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
      <button type="button" onClick={onSave}
        style={{ flex: 1, textAlign: 'left', fontSize: 13, lineHeight: 1.4, color: 'var(--ember-deep)',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
        {authCopy.saveSpotLine}
      </button>
      <button type="button" onClick={onDismiss} aria-label="Dismiss"
        style={{ flexShrink: 0, fontSize: 13, color: 'var(--smoke)', background: 'none', border: 'none', padding: 4, cursor: 'pointer', lineHeight: 1 }}>
        ✕
      </button>
    </div>
  )
}

// The headcount breakdown as a journey, not three tags: stations (in → on the way → here)
// along a dashed approach line, ending at the spark terminus — the same "here" vocabulary
// the arrived faces carry. Stations with zero people drop out; "here" stays (dimmed) so the
// destination reads even before anyone arrives. Keying the numeral on its value replays the
// pop animation whenever a count changes.
const PATH_POS: number[][] = [[], [93], [9, 93], [9, 48, 93]]
function StatusPath({ inN, otwN, hereN }: { inN: number; otwN: number; hereN: number }) {
  const stops: { key: string; cls: string; n: number; label: string }[] = []
  if (inN > 0) stops.push({ key: 'in', cls: '', n: inN, label: 'in' })
  if (otwN > 0) stops.push({ key: 'otw', cls: ' bp-path-stop--otw', n: otwN, label: 'on the way' })
  stops.push({ key: 'here', cls: ` bp-path-stop--here${hereN === 0 ? ' bp-path-stop--empty' : ''}`, n: hereN, label: 'here' })
  const pos = PATH_POS[stops.length]
  return (
    <div className="bp-path">
      <div className="bp-path-line" />
      {stops.map((s, i) => (
        <div key={s.key} className={`bp-path-stop${s.cls}`} style={{ left: `${pos[i]}%` }}>
          <span key={s.n} className="pn">{s.n}</span>
          {s.key === 'here' ? <span className="pt"><i /></span> : <span className="pd" />}
          <span className="pl">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── restaurant pods: headcount meter, party chips, pods (add-restaurant-pods) ──

const POD_GLYPH: Record<PodKind, string> = { car: '🚗', walk: '🚶', meetup: '📍', other: '👥' }

// Cutoff instants render client-side only (the shared clock is null on the server pass), so the
// server's timezone can never leak into the HTML and mismatch on hydration.
function CutoffLabel({ iso }: { iso: string }) {
  const now = useSyncExternalStore(subscribeClock, getClock, getClockServer)
  if (now === null) return null
  const label = new Date(iso).toLocaleString(undefined, {
    weekday: 'short', hour: 'numeric', minute: '2-digit',
  })
  return <>{headcountCopy.countNeededBy(label)}</>
}

// The reservation math as a dense strip: people + guests, the number vs the cap, a thin bar
// (overflow renders as a soft ember segment — passive copy, never a block), the locked-count chip
// once the cutoff passes, and the egalitarian table-called toggle. No flame anywhere.
function HeadcountMeter({ hc, people, guests, over, busy, onTableCalled }: {
  hc: PublicPulseHeadcount
  people: number
  guests: number
  over: boolean
  busy: boolean
  onTableCalled: () => void
}) {
  const headcount = people + guests
  const cap = hc.seatsCap
  const overBy = cap != null ? headcount - cap : 0
  const fill = cap != null ? Math.min(1, headcount / cap) : 1
  const locked = hc.lockedCount != null
  const called = hc.tableCalledAt != null
  return (
    <div className="bp-card mt-3 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2" style={{ fontSize: 13.5 }}>
        <span>{headcountCopy.meterLine(people, guests)}</span>
        {cap != null && (
          <span className="bp-num" style={{ fontSize: 15, color: overBy > 0 ? 'var(--ember-deep)' : undefined }}>
            {headcountCopy.seatsLine(headcount, cap)}
          </span>
        )}
      </div>
      {cap != null && (
        <div aria-hidden style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--sand, rgba(0,0,0,.08))', overflow: 'hidden', display: 'flex' }}>
          <span style={{ width: `${fill * 100}%`, background: overBy > 0 ? 'var(--ember-deep)' : 'var(--spark)', transition: 'width .3s' }} />
        </div>
      )}
      {overBy > 0 && !over && (
        <p style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.4, color: 'var(--ember-deep)' }}>
          {headcountCopy.overflowLine(overBy)}
        </p>
      )}
      {(hc.countNeededBy != null || called) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ marginTop: 8, fontSize: 12, color: 'var(--smoke)' }}>
          {hc.countNeededBy != null && !locked && <span><CutoffLabel iso={hc.countNeededBy} /></span>}
          {locked && (
            <span className="bp-done-tag" style={{ fontSize: 11.5 }}>{headcountCopy.lockedChip(hc.lockedCount!)}</span>
          )}
          {locked && (hc.afterCount ?? 0) > 0 && <span>{headcountCopy.afterCountLine(hc.afterCount!)}</span>}
          <button type="button" disabled={busy || called} onClick={onTableCalled}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: '2px 0', cursor: called ? 'default' : 'pointer',
              fontSize: 12, color: called ? 'var(--spark)' : 'var(--ember-deep)',
              textDecoration: called ? 'none' : 'underline', textUnderlineOffset: 3 }}>
            {called ? headcountCopy.tableCalledDone : headcountCopy.tableCalledCta}
          </button>
        </div>
      )}
    </div>
  )
}

// "anyone with you?" — the optional follow-up after the one-tap join. Chips only edit YOUR row.
function PartyChips({ current, onPick, disabled }: {
  current: number; onPick: (n: number) => void; disabled?: boolean
}) {
  return (
    <div className="mt-3">
      <div className="bp-overline" style={{ marginBottom: 6 }}>{headcountCopy.partyPrompt}</div>
      <div className="flex gap-1.5">
        {headcountCopy.partyChips.map((label, n) => (
          <button key={label} type="button" disabled={disabled}
            className={`bp-opt flex-1${current === n ? ' bp-opt--sel' : ''}`}
            onClick={() => onPick(n)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Day-of context, derived read-time from members' EXISTING statuses: a rolling car reads as a
// group ("10 min out · ~4 people"), an arrived one as "4 here now". Nothing new is written.
function podContext(pod: PublicPulsePod): string | null {
  const here = pod.members.filter((m) => m.status === 'here').length
  if (here > 0) return podCopy.hereLine(here)
  const otw = pod.members.filter((m) => m.status === 'on_my_way')
  if (otw.length > 0) {
    const etas = otw.map((m) => m.etaMinutes).filter((n): n is number => n != null)
    if (etas.length > 0) return podCopy.rollingLine(Math.min(...etas), pod.members.length)
  }
  return null
}

// One pod card: kind glyph, label, seats, member faces, join/hop-out, owner edit/disband.
function PodCard({ pod, over, busy, onJoin, onLeave, onEdit, onDelete }: {
  pod: PublicPulsePod
  over: boolean
  busy: boolean
  onJoin: (pod: PublicPulsePod) => void
  onLeave: (pod: PublicPulsePod) => void
  onEdit: (pod: PublicPulsePod, patch: { label: string; seats: number | null }) => Promise<boolean>
  onDelete: (pod: PublicPulsePod) => void
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(pod.label)
  const [seats, setSeats] = useState<number | null>(pod.seats)
  const [armed, setArmed] = useState(false) // two-tap disband, like EndEarly
  const full = pod.seats != null && pod.members.length >= pod.seats
  const context = podContext(pod)
  return (
    <div className="bp-card px-3.5 py-3" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="flex items-center gap-2">
        <span aria-hidden style={{ fontSize: 15 }}>{POD_GLYPH[pod.kind]}</span>
        <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pod.label}
        </span>
        <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 12, color: full ? 'var(--ember-deep)' : 'var(--smoke)' }}>
          {pod.seats != null
            ? full ? podCopy.fullChip : `${pod.members.length}/${pod.seats} ${podCopy.seatsLabel}`
            : podCopy.memberCount(pod.members.length)}
        </span>
      </div>
      {context && (
        <div style={{ fontSize: 12.5, color: 'var(--dusk)' }}>
          <span className="bonfire-pulse-dot" style={{ marginRight: 6 }} />{context}
        </div>
      )}
      <div className="flex items-center gap-1.5" style={{ flexWrap: 'wrap' }}>
        {pod.members.map((m) => (
          <span key={m.participantId} title={m.displayName}
            style={{ width: 26, height: 26, borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 10.5, fontWeight: 700, color: '#fff',
              background: avatarColorFor(m.participantId),
              outline: m.me ? '2px solid var(--spark)' : 'none', outlineOffset: 1 }}>
            {initialsFor(m.displayName)}
          </span>
        ))}
        {!over && (
          pod.mine ? (
            <button type="button" className="bp-opt" disabled={busy} onClick={() => onLeave(pod)}
              style={{ marginLeft: 'auto' }}>
              {podCopy.leaveCta}
            </button>
          ) : (
            <button type="button" className="bp-opt" disabled={busy || full} onClick={() => onJoin(pod)}
              style={{ marginLeft: 'auto', opacity: full ? 0.5 : 1 }}>
              {full ? podCopy.fullChip : podCopy.joinCta}
            </button>
          )
        )}
      </div>
      {!over && pod.owned && !editing && (
        <div className="flex gap-3" style={{ fontSize: 12 }}>
          <button type="button" disabled={busy} onClick={() => { setLabel(pod.label); setSeats(pod.seats); setEditing(true) }}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--smoke)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            {podCopy.editCta}
          </button>
          <button type="button" disabled={busy} onBlur={() => setArmed(false)}
            onClick={() => (armed ? onDelete(pod) : setArmed(true))}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              color: armed ? 'var(--ember-deep)' : 'var(--smoke)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            {armed ? 'tap again to disband' : podCopy.deleteCta}
          </button>
        </div>
      )}
      {!over && pod.owned && editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={CAPS.podLabel}
            className="bp-field" aria-label={podCopy.labelPlaceholder} />
          <div className="flex items-center gap-1.5" style={{ fontSize: 13 }}>
            <span>{podCopy.seatsLabel}</span>
            <button type="button" className="bp-opt" aria-label="Fewer seats"
              onClick={() => setSeats((n) => (n && n > 1 ? n - 1 : null))}>−</button>
            <span className="bp-num" style={{ minWidth: 28, textAlign: 'center' }}>{seats ?? '—'}</span>
            <button type="button" className="bp-opt" aria-label="More seats"
              onClick={() => setSeats((n) => Math.min(50, (n ?? 3) + 1))}>+</button>
            <button type="button" className="bp-opt" disabled={busy || !label.trim()} style={{ marginLeft: 'auto' }}
              onClick={async () => { if (await onEdit(pod, { label: label.trim(), seats })) setEditing(false) }}>
              save
            </button>
            <button type="button" className="bp-opt" onClick={() => setEditing(false)}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

// The pods section, shared by both trees: cards in an auto-fill grid (one column in the phone
// sheet, several on desktop) + the "open a pod" affordance. Zero pods renders ONLY the affordance.
function PodsSection({ pods, over, busy, msg, onOpen, onJoin, onLeave, onEdit, onDelete }: {
  pods: PublicPulsePod[]
  over: boolean
  busy: boolean
  msg: string | null
  onOpen: (kind: PodKind, label: string, seats: number | null) => Promise<boolean>
  onJoin: (pod: PublicPulsePod) => void
  onLeave: (pod: PublicPulsePod) => void
  onEdit: (pod: PublicPulsePod, patch: { label: string; seats: number | null }) => Promise<boolean>
  onDelete: (pod: PublicPulsePod) => void
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [kind, setKind] = useState<PodKind>('car')
  const [label, setLabel] = useState('')
  const [seats, setSeats] = useState<number | null>(4)
  if (pods.length === 0 && over) return null
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between">
        <div className="bp-overline mb-3">{podCopy.sectionTitle}{pods.length > 0 ? ` · ${pods.length}` : ''}</div>
        {!over && !formOpen && (
          <button type="button" className="bp-opt" disabled={busy} onClick={() => setFormOpen(true)}>
            + {podCopy.openCta}
          </button>
        )}
      </div>
      {msg && <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--dusk)' }}>{msg}</p>}
      {formOpen && !over && (
        <div className="bp-card mb-3 px-4 py-3" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="flex gap-1.5">
            {POD_KINDS.map((k) => (
              <button key={k} type="button" className={`bp-opt flex-1${kind === k ? ' bp-opt--sel' : ''}`}
                onClick={() => { setKind(k); setSeats(k === 'car' ? 4 : null) }}>
                {POD_GLYPH[k]} {podCopy.kindLabel[k]}
              </button>
            ))}
          </div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={CAPS.podLabel}
            placeholder={podCopy.labelPlaceholder} className="bp-field" />
          <div className="flex items-center gap-1.5" style={{ fontSize: 13 }}>
            <span>{podCopy.seatsLabel}</span>
            <button type="button" className="bp-opt" aria-label="Fewer seats"
              onClick={() => setSeats((n) => (n && n > 1 ? n - 1 : null))}>−</button>
            <span className="bp-num" style={{ minWidth: 28, textAlign: 'center' }}>{seats ?? '—'}</span>
            <button type="button" className="bp-opt" aria-label="More seats"
              onClick={() => setSeats((n) => Math.min(50, (n ?? 3) + 1))}>+</button>
            <span style={{ fontSize: 11.5, color: 'var(--smoke)' }}>{seats == null ? podCopy.seatsUncapped : ''}</span>
            <button type="button" className="bp-opt" disabled={busy || !label.trim()} style={{ marginLeft: 'auto' }}
              onClick={async () => {
                if (await onOpen(kind, label.trim(), seats)) { setFormOpen(false); setLabel(''); setKind('car'); setSeats(4) }
              }}>
              open
            </button>
            <button type="button" className="bp-opt" onClick={() => setFormOpen(false)} aria-label="Cancel">✕</button>
          </div>
        </div>
      )}
      {pods.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
          {pods.map((pod) => (
            <PodCard key={pod.id} pod={pod} over={over} busy={busy}
              onJoin={onJoin} onLeave={onLeave} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

type PulseStore = {
  participants: PublicPulseResponse[]
  viewer: PublicViewer
  live: boolean
  madeItCount: number
  headcount: PublicPulseHeadcount | null
  pods: PublicPulsePod[]
  holdMine: boolean
  setViewer: (v: PublicViewer) => void
  setHold: (b: boolean) => void
  upsertMine: (row: PublicPulseResponse) => void
  markTableCalled: () => void
  wrap: (madeItCount: number) => void
  applyServer: (p: PublicPulse) => void
}

function makeStore(initial: PublicPulse) {
  return createStore<PulseStore>((set) => ({
    participants: initial.participants,
    viewer: initial.viewer,
    live: initial.live,
    madeItCount: initial.madeItCount,
    headcount: initial.headcount,
    pods: initial.pods,
    holdMine: false,
    setViewer: (v) => set({ viewer: v }),
    setHold: (b) => set({ holdMine: b }),
    upsertMine: (row) => set((s) => ({
      participants: [row, ...s.participants.filter((p) => p.participantId !== row.participantId)],
    })),
    markTableCalled: () => set((s) => (s.headcount
      ? { headcount: { ...s.headcount, tableCalledAt: new Date().toISOString() } } : {})),
    wrap: (madeItCount) => set({ live: false, madeItCount }),
    applyServer: (pu) => set((s) => {
      const myId = s.viewer?.participantId ?? pu.viewer?.participantId ?? null
      let participants = pu.participants
      if (s.holdMine && myId) {
        const mine = s.participants.find((p) => p.participantId === myId)
        if (mine) participants = [mine, ...pu.participants.filter((p) => p.participantId !== myId)]
      }
      return {
        participants, live: pu.live, madeItCount: pu.madeItCount, viewer: pu.viewer ?? s.viewer,
        headcount: pu.headcount, pods: pu.pods,
      }
    }),
  }))
}

export function PulseView({ initial, pulseToken }: { initial: PublicPulse; pulseToken: string }) {
  const [store] = useState(() => makeStore(initial))

  const participants = useStore(store, (s) => s.participants)
  const viewer = useStore(store, (s) => s.viewer)
  const live = useStore(store, (s) => s.live)
  const madeItCount = useStore(store, (s) => s.madeItCount)
  const headcount = useStore(store, (s) => s.headcount)
  const pods = useStore(store, (s) => s.pods)
  const { upsertMine, setHold, setViewer, wrap, applyServer, markTableCalled } = store.getState()

  usePulsePoll<PublicPulse>(`/api/pulse/s/${pulseToken}/state`, applyServer)

  // The lifecycle phase, computed FRESH from the instants vs a ticking clock (never from the stored
  // snapshot), so an upcoming pulse flips to live at its start with no server round-trip. `live` from
  // the store is server liveness (unwrapped + before end): true for both upcoming and live, false
  // once wrapped. On the server/hydration pass `now` is null → we trust the server's `initial.phase`.
  const nowMs = useSyncExternalStore(subscribeClock, getClock, getClockServer)
  const startMs = useMemo(() => new Date(initial.startAt).getTime(), [initial.startAt])
  const endMs = useMemo(() => new Date(initial.expiresAt).getTime(), [initial.expiresAt])
  const phase = useMemo<PulsePhase>(() => {
    if (nowMs === null) return initial.phase
    if (!live || nowMs >= endMs) return 'over'
    if (nowMs < startMs) return 'upcoming'
    return 'live'
  }, [nowMs, live, startMs, endMs, initial.phase])
  const over = phase === 'over'

  const me = useMemo(() => participants.find((p) => p.me) ?? null, [participants])
  const roster = useMemo(() => [...participants].sort((a, b) =>
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.etaMinutes ?? 999) - (b.etaMinutes ?? 999)
  ), [participants])
  const goingCount = roster.filter((p) => p.status !== 'out').length
  const notes = roster.filter((p) => p.note)

  const [name, setName] = useState('')
  const [eta, setEta] = useState<string>(me?.etaMinutes ? String(me.etaMinutes) : '')
  const [note, setNote] = useState(me?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false) // desktop hearth → searchable roster
  const [query, setQuery] = useState('')
  // YOU panel (both trees): open on arrival for a viewer who hasn't joined yet (the commit step is
  // the point of the link); collapsed to the status fab once they have a pulse.
  const [youOpen, setYouOpen] = useState(() => !initial.participants.some((p) => p.me))
  const [feedOpen, setFeedOpen] = useState(false) // mobile pulse-feed card, collapsed by default
  const needName = !viewer?.displayName
  // Save-your-spot nudge: once an unverified guest sets a status, offer to attach a phone. One
  // line, dismissible, once per pulse — 'dismissed' is terminal so it never nags after that.
  const [saveState, setSaveState] = useState<'hidden' | 'shown' | 'dismissed'>('hidden')
  const [verifyOpen, setVerifyOpen] = useState(false)
  const showSaveLine = saveState === 'shown' && !!viewer && !viewer.verified

  async function setStatus(status: PulseStatus, extra: { eta?: number | null; note?: string | null; party?: number } = {}) {
    // Upcoming AND live accept responses (intent collects before start); only `over` is closed.
    if (busy || over) return
    const nm = needName ? name.trim() : undefined
    if (needName && !nm) { setErr('Add your name first.'); return }
    setErr(null)
    const etaVal = status === 'on_my_way' ? (extra.eta ?? (eta ? Number(eta) : null)) : null
    const noteVal = extra.note !== undefined ? extra.note : (status === 'here' ? (note.trim() || null) : me?.note ?? null)
    const party = extra.party !== undefined ? extra.party : me?.partySize ?? 0
    const optimistic = !!viewer
    if (optimistic) {
      upsertMine({
        participantId: viewer!.participantId, displayName: viewer!.displayName ?? nm ?? 'you',
        status, etaMinutes: etaVal, note: noteVal, partySize: party, afterCount: me?.afterCount ?? false, me: true,
      })
      setHold(true)
    }
    setBusy(true)
    try {
      const res = await fetch('/api/pulse/pulse-response', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pulseToken, status, etaMinutes: etaVal ?? undefined, note: noteVal ?? undefined, name: nm,
          partySize: extra.party,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setErr(data?.error ?? 'try again'); setHold(false); return }
      setViewer(data.viewer)
      upsertMine({
        participantId: data.viewer.participantId, displayName: data.viewer.displayName,
        status, etaMinutes: etaVal, note: noteVal, partySize: party, afterCount: me?.afterCount ?? false, me: true,
      })
      // First status from an unverified guest → surface the save nudge (unless already dismissed).
      if (!data.viewer.verified) setSaveState((s) => (s === 'dismissed' ? 'dismissed' : 'shown'))
      setHold(false)
    } catch {
      setErr('network error'); setHold(false)
    } finally {
      setBusy(false)
    }
  }

  async function doWrap() {
    if (busy || over) return
    setBusy(true)
    try {
      const res = await fetch('/api/pulse/pulse-wrap', {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pulseToken }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) wrap(data?.summary?.madeItCount ?? madeItCount)
    } finally { setBusy(false) }
  }

  function timeFor(p: PublicPulseResponse): string | undefined {
    return p.status === 'on_my_way' && p.etaMinutes ? `${p.etaMinutes} min` : undefined
  }

  // ── restaurant pods: party size, table-called, pod writes ──
  const [podMsg, setPodMsg] = useState<string | null>(null)

  // Live meter numbers derive from the (optimistic) roster; cap/cutoff/locked ride the server block.
  const countedRows = participants.filter((p) => p.status !== 'out')
  const meterPeople = countedRows.length
  const meterGuests = countedRows.reduce((sum, p) => sum + p.partySize, 0)

  // Pod writes have no optimistic model (rosters cross participants) — re-pull the state instead.
  async function refreshState() {
    try {
      const res = await fetch(`/api/pulse/s/${pulseToken}/state`, { cache: 'no-store' })
      if (res.ok) applyServer(await res.json())
    } catch {}
  }

  async function tableCalled() {
    if (busy || over || headcount?.tableCalledAt) return
    markTableCalled() // optimistic; idempotent server-side
    try {
      await fetch('/api/pulse/table-called', {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pulseToken }),
      })
    } catch {}
  }

  // Shared guard for pod writes: they carry the member's display name, so one is required first.
  function podNameGuard(): boolean {
    if (viewer?.displayName) return true
    setPodMsg('Add your name first — tap your pulse above.')
    setYouOpen(true)
    return false
  }

  type PodWriteData = { error?: string; moved?: boolean } | null
  async function podWrite(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body: object): Promise<{ ok: boolean; data: PodWriteData }> {
    setBusy(true)
    setPodMsg(null)
    try {
      const res = await fetch(path, {
        method, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pulseToken, ...body }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) await refreshState()
      return { ok: res.ok, data }
    } catch {
      return { ok: false, data: null }
    } finally {
      setBusy(false)
    }
  }

  const POD_ERR: Record<string, string> = {
    pod_full: 'That one just filled up.',
    pulse_over: 'This pulse has wrapped.',
    seats_below_members: 'Seats can’t go below the people already in.',
    not_owner: 'Only the opener can change this.',
  }
  const podFail = (data: PodWriteData) => setPodMsg((data?.error && POD_ERR[data.error]) ?? 'try again')

  async function openPod(kind: PodKind, label: string, seats: number | null): Promise<boolean> {
    if (!podNameGuard()) return false
    const { ok, data } = await podWrite('POST', '/api/pulse/pod', { kind, label, seats })
    if (!ok) podFail(data)
    return ok
  }
  async function joinPod(pod: PublicPulsePod) {
    if (!podNameGuard()) return
    const { ok, data } = await podWrite('PUT', '/api/pulse/pod-member', { podId: pod.id })
    if (!ok) { podFail(data); return }
    if (data?.moved) {
      setPodMsg(podCopy.movedLine(pod.label))
      setTimeout(() => setPodMsg((m) => (m === podCopy.movedLine(pod.label) ? null : m)), 5000)
    }
  }
  async function leavePod(pod: PublicPulsePod) {
    const { ok, data } = await podWrite('DELETE', '/api/pulse/pod-member', { podId: pod.id })
    if (!ok) podFail(data)
  }
  async function editPod(pod: PublicPulsePod, patch: { label: string; seats: number | null }): Promise<boolean> {
    const { ok, data } = await podWrite('PATCH', '/api/pulse/pod', { podId: pod.id, ...patch })
    if (!ok) podFail(data)
    return ok
  }
  async function deletePod(pod: PublicPulsePod) {
    const { ok, data } = await podWrite('DELETE', '/api/pulse/pod', { podId: pod.id })
    if (!ok) podFail(data)
  }

  const podsSection = (
    <PodsSection pods={pods} over={over} busy={busy} msg={podMsg}
      onOpen={openPod} onJoin={joinPod} onLeave={leavePod} onEdit={editPod} onDelete={deletePod} />
  )

  const goingRoster = roster.filter((p) => p.status !== 'out')
  const heroAvs = goingRoster.slice(0, 3)
  const heroExtra = goingCount - heroAvs.length

  // ── desktop hero: only the people in motion, so the fire stays readable ──
  // `on_my_way` are the focus — individual approaching markers with ETA. `here` cordon into a
  // huddle at the fire (a tight cluster + count, never a scatter). `in` stay in the count + roster.
  const hereList = goingRoster.filter((p) => p.status === 'here')
  const otwList = goingRoster.filter((p) => p.status === 'on_my_way')
  const inCount = goingRoster.filter((p) => p.status === 'in').length
  // huddle shows me first (so "You" is always visible when here), then the rest
  const hereOrdered = me?.status === 'here' ? [me, ...hereList.filter((p) => !p.me)] : hereList
  const huddleShown = hereOrdered.slice(0, HUDDLE_CAP)
  const huddleMore = hereList.length - huddleShown.length
  const otwShown = otwList.slice(0, OTW_CAP)
  const otwMore = otwList.length - otwShown.length
  const feedRows = notes.slice(0, 3) // desktop pulse feed: the latest noted participants
  const desktopCount = over ? madeItCount : goingCount
  const rosterQuery = query.trim().toLowerCase()
  const rosterFiltered = rosterQuery ? roster.filter((p) => p.displayName.toLowerCase().includes(rosterQuery)) : roster

  // Only a resolved geocode with real coordinates renders a map; everything else (unresolved,
  // low_confidence, or missing coords) keeps the stylized tile — no blank or wrongly-pinned map.
  const mappable =
    initial.placeGeoStatus === 'resolved' &&
    typeof initial.placeLat === 'number' &&
    typeof initial.placeLng === 'number'

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(initial.place)}`
  const inviteText = () => pulseMessage(initial.title, initial.place, initial.timeLabel, window.location.href)
  const linkText = () => window.location.href
  // the place is one free-text field ("The Anchor · Bar on Rivington"); lead with the venue name
  // and drop the rest to a quiet subline in the hero's venue chip.
  const [venueName, ...venueRest] = initial.place.split(' · ')
  const venueSub = venueRest.join(' · ')

  return (
    <>
    {/* ── phone tree: warm banner + cream sheet (hidden ≥1100px) ── */}
    <div className="bpd-mobile flex flex-1 flex-col">
      <div className={`bp-hero${over ? ' bp-hero--done' : ''}`}>
        <div className="bp-hero-top">
          <Link
            href={initial.crewToken ? `/p/c/${initial.crewToken}` : '/p'} className="bp-hero-btn"
            aria-label={initial.crewToken ? `Back to ${initial.crewName}` : 'Back to home'}
          >
            ‹
          </Link>
          {initial.crewName && <span className="bp-hero-ctx">{initial.crewName}</span>}
          <div className="bp-hero-actions">
            {heroAvs.length > 0 && (
              <div className="bp-hero-avs" aria-hidden>
                {heroAvs.map((p) => <span key={p.participantId} className="av">{initialsFor(p.displayName)}</span>)}
                {heroExtra > 0 && <span className="av">+{heroExtra}</span>}
              </div>
            )}
            <CopyButton text={linkText} className="bp-hero-btn" label="Copy link" idle="↗" done="✓" />
          </div>
        </div>
      </div>

      <div className="bp-hero-sheet flex flex-1 flex-col px-5 pb-6 pt-7">
        <div className="flex-1">
          <h1 className="bp-title bp-title--big bpm-h1">{initial.title}</h1>

          <div className="bpm-statusline">
            {phase === 'live' && (
              <>
                <span className="live"><span className="bonfire-pulse-dot" />Live now</span>
                <span className="sep" aria-hidden>·</span>
                <span><Remaining iso={initial.expiresAt} /></span>
              </>
            )}
            {phase === 'upcoming' && (
              <>
                <span className="bp-done-tag">upcoming</span>
                <span><StartsIn iso={initial.startAt} /></span>
              </>
            )}
            {phase === 'over' && (
              <>
                <span className="bp-done-tag">wrapped</span>
                <span>{initial.timeLabel}</span>
              </>
            )}
          </div>

          {/* lean presence strip: headcount, the arrived cluster, maps link, and the venue —
              the phone-column condensation of the desktop hero (no fire, no map) */}
          <div className="bpm-lean">
            <div className="going">
              <span className="n">{desktopCount}</span><span className="l">{over ? 'made it' : 'going'}</span>
            </div>
            {hereOrdered.length > 0 && (
              <div className="cluster" aria-label={`${hereList.length} here now`}>
                {huddleShown.slice(0, 3).map((p) => (
                  <span key={p.participantId} className={`av${p.me ? ' self' : ''}`}
                    style={{ background: avatarColorFor(p.participantId) }}>{initialsFor(p.displayName)}</span>
                ))}
                {hereList.length > 3 && <span className="av more">+{hereList.length - 3}</span>}
              </div>
            )}
            <a className="expand" href={mapsHref} target="_blank" rel="noreferrer" aria-label={`Open ${initial.place} in maps`}>↗</a>
            <div className="venue">
              <div className="t">{venueName}</div>
              {venueSub && <div className="s">{venueSub}</div>}
            </div>
          </div>

          {headcount && (
            <HeadcountMeter hc={headcount} people={meterPeople} guests={meterGuests}
              over={over} busy={busy} onTableCalled={tableCalled} />
          )}

          {!over ? (
            (hereList.length > 0 || otwList.length > 0 || inCount > 0) && (
              <div className="bpm-tlcard">
                <StatusPath inN={inCount} otwN={otwList.length} hereN={hereList.length} />
              </div>
            )
          ) : (
            <div className="bp-card bp-card--primary mt-4 px-5 py-4">
              That’s a wrap — <span className="bp-num" style={{ fontSize: 22 }}>{madeItCount}</span>{' '}
              made it.
            </div>
          )}

          {notes.length > 0 && (
            <div className="bpm-feed">
              <button type="button" className="fh" onClick={() => setFeedOpen((o) => !o)} aria-expanded={feedOpen}>
                <span className="bp-overline">Pulse feed · {notes.length}</span>
                <span className={`chev${feedOpen ? ' is-open' : ''}`} aria-hidden>▾</span>
              </button>
              {feedOpen && notes.map((p) => (
                <div key={p.participantId} className="bpd-frow">
                  <span className="av" style={{ background: avatarColorFor(p.participantId) }}>{initialsFor(p.displayName)}</span>
                  <div className="fb">
                    <div className="top">
                      <span className="nm">{p.me ? 'You' : firstName(p.displayName)}</span>
                      <span className={`st ${p.status}`}><span className="d" />{timeFor(p) ?? PULSE_STATUS_LABEL[p.status]}</span>
                    </div>
                    <div className="note">“{p.note}”</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!over && !youOpen && (
            <button type="button" className="bpm-youfab" onClick={() => setYouOpen(true)}>
              <span className="lead">
                <span className="k">Your pulse</span>
                <span className="v">
                  {me
                    ? <>You’re <em style={{ color: YOU_COLOR[me.status] }}>{PULSE_STATUS_LABEL[me.status]}</em></>
                    : 'Join the fire'}
                </span>
              </span>
              <span className="go" aria-hidden>✎</span>
            </button>
          )}
          {!over && youOpen && (
            <div className="bpm-youpanel">
              <div className="head">
                <div className="status">
                  {me
                    ? <>You’re <em style={{ color: YOU_COLOR[me.status] }}>{PULSE_STATUS_LABEL[me.status]}</em></>
                    : phase === 'upcoming' ? 'You’re set for this' : 'Join the fire'}
                </div>
                <button type="button" className="x" onClick={() => setYouOpen(false)} aria-label="Close your pulse panel">✕</button>
              </div>
              {needName && (
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={CAPS.displayName}
                  placeholder="Pick a name your friends will know" className="bp-field mb-2.5" />
              )}
              <StatusSegment statuses={SLIDER_STATUSES} current={me?.status ?? null}
                onPick={(s) => setStatus(s)} disabled={busy} dimmed={me?.status === 'out'} />
              <OptOutToggle on={me?.status === 'out'}
                onToggle={(next) => setStatus(next ? 'out' : 'in')} disabled={busy} />
              {headcount && me && me.status !== 'out' && (
                <PartyChips current={me.partySize} disabled={busy}
                  onPick={(n) => setStatus(me.status, { party: n })} />
              )}
              {me?.status === 'on_my_way' && (
                <div className="mt-3 flex gap-2">
                  <input value={eta} onChange={(e) => setEta(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric"
                    placeholder="ETA (min)" className="bp-field" style={{ width: 128 }} />
                  <button type="button" onClick={() => setStatus('on_my_way', { eta: eta ? Number(eta) : null })} disabled={busy}
                    className="bp-opt">set ETA</button>
                </div>
              )}
              {me?.status === 'here' && (
                <div className="mt-3 flex gap-2">
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={CAPS.note}
                    placeholder="Got us a table, come find me" className="bp-field flex-1" />
                  <button type="button" onClick={() => setStatus('here', { note: note.trim() || null })} disabled={busy}
                    className="bp-opt">save</button>
                </div>
              )}
              {err && <p className="mt-2" style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{err}</p>}
              {me && me.status !== 'out' && (
                <div className="bpd-livenote"><span className="d" aria-hidden />Sharing your live pulse with the crew</div>
              )}
              {showSaveLine && (
                <SaveSpotLine onSave={() => setVerifyOpen(true)} onDismiss={() => setSaveState('dismissed')} />
              )}
            </div>
          )}

          {podsSection}

          <div className="bp-overline mt-6 mb-3">Who’s in</div>
          <div className="bp-tiles pb-1">
            {!over && (
              <div className="bp-tile-wrap">
                <CopyButton text={inviteText} className="bp-tile--add" label="Copy invite message" idle="+" done="✓" />
                <span className="bp-tile-sub">invite</span>
              </div>
            )}
            {roster.map((p) => (
              <div key={p.participantId} className={`bp-tile-wrap${p.status === 'out' ? ' bp-tile-wrap--out' : ''}`}>
                <span className={`bp-tile${p.me ? ' bp-tile--me' : ''}`} style={{ background: avatarColorFor(p.participantId) }}>
                  {initialsFor(p.displayName)}
                  {p.status === 'here' && (
                    <span className="bp-tile-badge bp-tile-badge--here">
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                    </span>
                  )}
                  {p.status === 'on_my_way' && <span className="bp-tile-badge bp-tile-badge--otw">→</span>}
                </span>
                <span className="bp-tile-name">
                  {p.me ? 'You' : firstName(p.displayName)}
                  {p.partySize > 0 && p.status !== 'out' && <span style={{ color: 'var(--dusk)', fontWeight: 700 }}> +{p.partySize}</span>}
                </span>
                <span className={`bp-tile-sub${p.status === 'here' ? ' bp-tile-sub--here' : p.status === 'on_my_way' ? ' bp-tile-sub--otw' : ''}`}>
                  {timeFor(p) ?? PULSE_STATUS_LABEL[p.status]}
                </span>
              </div>
            ))}
          </div>
          {roster.length === 0 && <p className="bp-sub mt-2">No one yet. Be the first.</p>}

          {/* End early — muted, confirm-gated, and set well apart from the status control above so a
              status tap can never end the pulse. Auto-wrap handles the normal end at expires_at. */}
          {!over && (
            <div className="mt-6" style={{ textAlign: 'center' }}>
              <EndEarly onEnd={doWrap} disabled={busy} />
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ── desktop tree: unified map-hero — fire on the venue, faces gather toward it (≥1100px) ── */}
    <div className="bpd-desktop">
      <div className="bpd-head">
        <div className="min-w-0">
          <h1 className="bpd-h1">{initial.title}</h1>
          <div className="bpd-dateline">
            <div className="bpd-dcell">
              <div className="bpd-dk">Status</div>
              <div className={`bpd-dv${phase === 'live' ? ' bpd-dv--live' : ''}`}>
                {phase === 'live' && <><span className="bonfire-pulse-dot" /> Live now</>}
                {phase === 'upcoming' && <span style={{ color: 'var(--dusk)' }}>Upcoming</span>}
                {phase === 'over' && <span style={{ color: 'var(--smoke)' }}>Wrapped</span>}
              </div>
            </div>
            <div className="bpd-dcell">
              <div className="bpd-dk">{phase === 'live' ? 'Winds down in' : phase === 'upcoming' ? 'Starts' : 'When'}</div>
              <div className="bpd-dv">
                {phase === 'live' && <Winddown iso={initial.expiresAt} />}
                {phase === 'upcoming' && <StartsIn iso={initial.startAt} />}
                {phase === 'over' && initial.timeLabel}
              </div>
            </div>
            {initial.crewName && (
              <div className="bpd-dcell">
                <div className="bpd-dk">Crew</div>
                <div className="bpd-dv bpd-dv--crew">{initial.crewName}</div>
              </div>
            )}
          </div>
        </div>
        <div className="bpd-head-r">
          {!over && <CopyButton text={inviteText} className="bpd-invite" label="Copy invite message" idle={<>＋&nbsp;Invite</>} done="✓ Copied" />}
          <CopyButton text={linkText} className="bpd-share" label="Copy link" idle="↗" done="✓" />
          {initial.crewToken && (
            <Link href={`/p/c/${initial.crewToken}`} className="bpd-share" aria-label={`Back to ${initial.crewName}`}>‹</Link>
          )}
          {/* End early lives in the header, deliberately far from the status slider in the YOU panel. */}
          {!over && <EndEarly onEnd={doWrap} disabled={busy} />}
        </div>
      </div>

      {/* reservation strip: between the dateline and the hero, so it never occludes the gather */}
      {headcount && (
        <div style={{ maxWidth: 560, marginBottom: 12 }}>
          <HeadcountMeter hc={headcount} people={meterPeople} guests={meterGuests}
            over={over} busy={busy} onTableCalled={tableCalled} />
        </div>
      )}

      <div className={`bpd-hero${mappable ? ' bpd-hero--map' : ' bpd-hero--cream'}${over ? ' bpd-hero--done' : ''}`}>
        {mappable && <HeroMap lat={initial.placeLat!} lng={initial.placeLng!} />}
        <div className="bpd-hero-rings" aria-hidden><span className="r r1" /><span className="r r2" /><span className="r r3" /></div>
        <div className="bpd-hero-bloom" aria-hidden />
        <div className="bpd-fire" aria-hidden>
          <div className="bpd-fl bpd-f1" /><div className="bpd-fl bpd-f2" /><div className="bpd-fl bpd-f3" /><div className="bpd-fl bpd-fcore" />
        </div>

        {!expanded ? (
          <>
            {/* on the way — the focus: individual markers closing in on the fire, with ETA */}
            {otwShown.map((p, i) => (
              <span key={p.participantId} className="bpd-person bpd-person--on_my_way"
                style={otwSeat(i)} title={p.displayName}>
                <span className="bpd-person-av" style={{ background: avatarColorFor(p.participantId) }}>{initialsFor(p.displayName)}</span>
                {p.etaMinutes
                  ? <span className="bpd-person-eta">→ {p.etaMinutes} min</span>
                  : <span className="bpd-person-nm">{p.me ? 'You' : firstName(p.displayName)}</span>}
              </span>
            ))}
            {otwMore > 0 && (
              <button type="button" className="bpd-more" style={otwSeat(otwShown.length)}
                onClick={() => setExpanded(true)} aria-label="Show everyone on the way">+{otwMore}</button>
            )}

            {/* here — cordoned into a huddle at the fire */}
            {hereList.length > 0 && (
              <div className="bpd-huddle">
                <div className="bpd-huddle-faces">
                  {huddleShown.map((p) => (
                    <span key={p.participantId} className={`bpd-huddle-face${p.me ? ' bpd-huddle-face--me' : ''}`}
                      style={{ background: avatarColorFor(p.participantId) }} title={p.displayName}>{initialsFor(p.displayName)}</span>
                  ))}
                  {huddleMore > 0 && <span className="bpd-huddle-face bpd-huddle-more">+{huddleMore}</span>}
                </div>
                <span className="bpd-huddle-lab"><span className="bonfire-pulse-dot" /> {hereList.length} here now</span>
              </div>
            )}

            {hereList.length === 0 && otwList.length === 0 && (
              <p className="bpd-hero-empty">
                {goingCount > 0 ? 'No one’s here yet, be the first to head over.' : 'No one yet. Be the first to gather.'}
              </p>
            )}

            {/* overlays: count + timeline, maps + search, feed + place, YOU fab/panel */}
            <div className="bpd-hero-count">
              <div className="n">{desktopCount}</div>
              <div className="l">{over ? 'made it' : 'going'}</div>
            </div>
            {!over && (hereList.length > 0 || otwList.length > 0 || inCount > 0) && (
              <div className="bpd-hero-path">
                <StatusPath inN={inCount} otwN={otwList.length} hereN={hereList.length} />
              </div>
            )}
            <div className="bpd-hero-tr">
              {!over && goingCount > 0 && (
                <button type="button" className="bpd-hero-searchpill" onClick={() => setExpanded(true)}>⌕ Everyone</button>
              )}
              <a className="bpd-hero-maps" href={mapsHref} target="_blank" rel="noreferrer">Open in maps ↗</a>
            </div>
            <div className="bpd-hero-bl">
              {feedRows.length > 0 && (
                <div className="bpd-feed">
                  <div className="bp-overline">Pulse feed</div>
                  {feedRows.map((p) => (
                    <div key={p.participantId} className="bpd-frow">
                      <span className="av" style={{ background: avatarColorFor(p.participantId) }}>{initialsFor(p.displayName)}</span>
                      <div className="fb">
                        <div className="top">
                          <span className="nm">{p.me ? 'You' : firstName(p.displayName)}</span>
                          <span className={`st ${p.status}`}><span className="d" />{timeFor(p) ?? PULSE_STATUS_LABEL[p.status]}</span>
                        </div>
                        <div className="note">“{p.note}”</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <span className="bpd-hero-venue">
                <span className="vn">{venueName}</span>
                {venueSub && <span className="vs">{venueSub}</span>}
              </span>
            </div>

            {!over && !youOpen && (
              <button type="button" className="bpd-youfab" onClick={() => setYouOpen(true)}>
                <span className="lead">
                  <span className="k">Your pulse</span>
                  <span className="v">
                    {me
                      ? <>You’re <em style={{ color: YOU_COLOR[me.status] }}>{PULSE_STATUS_LABEL[me.status]}</em></>
                      : 'Join the fire'}
                  </span>
                </span>
                <span className="go" aria-hidden>✎</span>
              </button>
            )}
            {!over && youOpen && (
              <div className="bpd-youpanel">
                <div className="head">
                  <div className="status">
                    {me
                      ? <>You’re <em style={{ color: YOU_COLOR[me.status] }}>{PULSE_STATUS_LABEL[me.status]}</em></>
                      : phase === 'upcoming' ? 'You’re set for this' : 'Join the fire'}
                  </div>
                  <button type="button" className="x" onClick={() => setYouOpen(false)} aria-label="Close your pulse panel">✕</button>
                </div>
                {needName && (
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={CAPS.displayName}
                    placeholder="A name your friends will know" className="bp-field" style={{ marginBottom: 10 }} />
                )}
                <StatusSegment statuses={SLIDER_STATUSES} current={me?.status ?? null}
                  onPick={(s) => setStatus(s)} disabled={busy} dimmed={me?.status === 'out'} className="bp-seg2--desktop" />
                <OptOutToggle on={me?.status === 'out'}
                  onToggle={(next) => setStatus(next ? 'out' : 'in')} disabled={busy} />
                {headcount && me && me.status !== 'out' && (
                  <PartyChips current={me.partySize} disabled={busy}
                    onPick={(n) => setStatus(me.status, { party: n })} />
                )}
                {me?.status === 'on_my_way' && (
                  <div className="mt-3 flex gap-2">
                    <input value={eta} onChange={(e) => setEta(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric"
                      placeholder="ETA (min)" className="bp-field" style={{ width: 108 }} />
                    <button type="button" onClick={() => setStatus('on_my_way', { eta: eta ? Number(eta) : null })} disabled={busy} className="bp-opt">set</button>
                  </div>
                )}
                {me?.status === 'here' && (
                  <div className="mt-3 flex gap-2">
                    <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={CAPS.note}
                      placeholder="Got us a table, come find me" className="bp-field flex-1" />
                    <button type="button" onClick={() => setStatus('here', { note: note.trim() || null })} disabled={busy} className="bp-opt">save</button>
                  </div>
                )}
                {err && <p className="mt-2" style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{err}</p>}
                {me && me.status !== 'out' && (
                  <div className="bpd-livenote"><span className="d" aria-hidden />Sharing your live pulse with the crew</div>
                )}
                {showSaveLine && (
                  <SaveSpotLine onSave={() => setVerifyOpen(true)} onDismiss={() => setSaveState('dismissed')} />
                )}
              </div>
            )}
          </>
        ) : (
          <div className="bpd-hero-roster">
            <div className="bpd-rsearch">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${goingCount} going`} autoFocus />
              <button type="button" className="bpd-rback" onClick={() => { setExpanded(false); setQuery('') }}>‹ fire</button>
            </div>
            <div className="bpd-rscroll">
              {DESKTOP_GROUPS.map(({ key, label }) => {
                const rows = rosterFiltered.filter((p) => p.status === key)
                if (rows.length === 0) return null
                return (
                  <div key={key} className={`bpd-rgroup${key === 'out' ? ' bpd-rgroup--out' : ''}`}>
                    <div className="bpd-rghead">
                      <span className={`sd ${key}`} /><span className="lab">{label}</span><span className="ct">{rows.length}</span><span className="hr" />
                    </div>
                    <div className="bpd-rrows">
                      {rows.map((p) => (
                        <div key={p.participantId} className="bpd-rrow">
                          <span className="a" style={{ background: avatarColorFor(p.participantId) }}>{initialsFor(p.displayName)}</span>
                          <div className="who">
                            <div className="nm">
                              {p.me ? 'You' : p.displayName}
                              {p.partySize > 0 && p.status !== 'out' && <span style={{ color: 'var(--dusk)', fontWeight: 700 }}> +{p.partySize}</span>}
                            </div>
                            <div className={`det ${p.status}`}>
                              {timeFor(p) ?? PULSE_STATUS_LABEL[p.status]}
                              {p.afterCount && ` · ${headcountCopy.afterCountChip}`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {rosterFiltered.length === 0 && <p className="bpd-rempty">No one by that name.</p>}
            </div>
          </div>
        )}
      </div>

      {/* pods ride below the hero: dense cards, several columns at desktop width */}
      {podsSection}
    </div>

    {/* Shared save-your-spot verify sheet (both trees). On success the server may have re-pointed
        the cookie (ghost merge, which now carries this response onto the canonical); the fresh
        viewer comes back verified, so the line self-suppresses and never gates the status tap. */}
    {verifyOpen && (
      <VerifySheet onClose={() => setVerifyOpen(false)} blurb={authCopy.savePrivacyLine}
        onVerified={(v) => { setViewer(v); setSaveState('dismissed'); setVerifyOpen(false) }} />
    )}
    </>
  )
}
