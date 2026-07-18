'use client'
import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createStore, useStore } from 'zustand'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { PULSE_STATUSES, type PulseStatus, type PublicPulse, type PublicPulseResponse, type PublicViewer } from '@/lib/pulse/types'
import { PULSE_STATUS_LABEL, CAPS, pulseMessage } from '@/lib/pulse/copy'
import { usePulsePoll } from '@/lib/pulse/usePulsePoll'
import { EmberMark, EndsAt, avatarColorFor, initialsFor } from '../../ui.client'

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
// The fire sits at the hero's centre; participants ring it by status. Positions are % of the hero
// box, tuned so the four corners stay clear for overlays (count / maps / venue+notes / commit).
// deg convention: 0=right, 90=down, 180=left, 270=up (screen space, y grows down).
function gPos(cx: number, cy: number, rx: number, ry: number, deg: number): React.CSSProperties {
  const a = (deg * Math.PI) / 180
  return { left: `${cx + rx * Math.cos(a)}%`, top: `${cy + ry * Math.sin(a)}%` }
}
// even angular spread of n items across [a, b]; a lone item lands at the midpoint
function gFan(a: number, b: number, n: number, i: number): number {
  if (n <= 1) return (a + b) / 2
  return a + ((b - a) * i) / (n - 1)
}
// The approaching ring: `on_my_way` markers spread across the upper arc (they close in on the fire
// from around it), skipping the top-right pills and the bottom-right commit card.
function otwSeat(n: number, i: number): React.CSSProperties {
  return gPos(50, 44, 38, 29, gFan(202, 338, n, i))
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

type PulseStore = {
  participants: PublicPulseResponse[]
  viewer: PublicViewer
  live: boolean
  madeItCount: number
  holdMine: boolean
  setViewer: (v: PublicViewer) => void
  setHold: (b: boolean) => void
  upsertMine: (row: PublicPulseResponse) => void
  wrap: (madeItCount: number) => void
  applyServer: (p: PublicPulse) => void
}

function makeStore(initial: PublicPulse) {
  return createStore<PulseStore>((set) => ({
    participants: initial.participants,
    viewer: initial.viewer,
    live: initial.live,
    madeItCount: initial.madeItCount,
    holdMine: false,
    setViewer: (v) => set({ viewer: v }),
    setHold: (b) => set({ holdMine: b }),
    upsertMine: (row) => set((s) => ({
      participants: [row, ...s.participants.filter((p) => p.participantId !== row.participantId)],
    })),
    wrap: (madeItCount) => set({ live: false, madeItCount }),
    applyServer: (pu) => set((s) => {
      const myId = s.viewer?.participantId ?? pu.viewer?.participantId ?? null
      let participants = pu.participants
      if (s.holdMine && myId) {
        const mine = s.participants.find((p) => p.participantId === myId)
        if (mine) participants = [mine, ...pu.participants.filter((p) => p.participantId !== myId)]
      }
      return { participants, live: pu.live, madeItCount: pu.madeItCount, viewer: pu.viewer ?? s.viewer }
    }),
  }))
}

export function PulseView({ initial, pulseToken }: { initial: PublicPulse; pulseToken: string }) {
  const [store] = useState(() => makeStore(initial))

  const participants = useStore(store, (s) => s.participants)
  const viewer = useStore(store, (s) => s.viewer)
  const live = useStore(store, (s) => s.live)
  const madeItCount = useStore(store, (s) => s.madeItCount)
  const { upsertMine, setHold, setViewer, wrap, applyServer } = store.getState()

  usePulsePoll<PublicPulse>(`/api/pulse/s/${pulseToken}/state`, applyServer)

  const me = useMemo(() => participants.find((p) => p.me) ?? null, [participants])
  const roster = useMemo(() => [...participants].sort((a, b) =>
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.etaMinutes ?? 999) - (b.etaMinutes ?? 999)
  ), [participants])
  const goingCount = roster.filter((p) => p.status !== 'out').length
  const hereCount = roster.filter((p) => p.status === 'here').length
  const notes = roster.filter((p) => p.note)

  const [name, setName] = useState('')
  const [eta, setEta] = useState<string>(me?.etaMinutes ? String(me.etaMinutes) : '')
  const [note, setNote] = useState(me?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false) // desktop hearth → searchable roster
  const [query, setQuery] = useState('')
  const needName = !viewer?.displayName

  async function setStatus(status: PulseStatus, extra: { eta?: number | null; note?: string | null } = {}) {
    if (busy || !live) return
    const nm = needName ? name.trim() : undefined
    if (needName && !nm) { setErr('Add your name first.'); return }
    setErr(null)
    const etaVal = status === 'on_my_way' ? (extra.eta ?? (eta ? Number(eta) : null)) : null
    const noteVal = extra.note !== undefined ? extra.note : (status === 'here' ? (note.trim() || null) : me?.note ?? null)
    const optimistic = !!viewer
    if (optimistic) {
      upsertMine({
        participantId: viewer!.participantId, displayName: viewer!.displayName ?? nm ?? 'you',
        status, etaMinutes: etaVal, note: noteVal, me: true,
      })
      setHold(true)
    }
    setBusy(true)
    try {
      const res = await fetch('/api/pulse/pulse-response', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pulseToken, status, etaMinutes: etaVal ?? undefined, note: noteVal ?? undefined, name: nm }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setErr(data?.error ?? 'try again'); setHold(false); return }
      setViewer(data.viewer)
      upsertMine({
        participantId: data.viewer.participantId, displayName: data.viewer.displayName,
        status, etaMinutes: etaVal, note: noteVal, me: true,
      })
      setHold(false)
    } catch {
      setErr('network error'); setHold(false)
    } finally {
      setBusy(false)
    }
  }

  async function doWrap() {
    if (busy || !live) return
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
  const heroNotes = notes.slice(0, 2)
  const desktopCount = live ? goingCount : madeItCount
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
      <div className={`bp-hero${live ? '' : ' bp-hero--done'}`}>
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
          <h1 className="bp-title bp-title--big">{initial.title}</h1>

          <div className="bp-when">
            {live
              ? <span className="bp-live-tag"><span className="bonfire-pulse-dot" /> live</span>
              : <span className="bp-done-tag">wrapped</span>}
            <span>{initial.timeLabel}</span>
            {live && <EndsAt iso={initial.expiresAt} />}
          </div>

          <a className="bp-map mt-4" href={mapsHref} target="_blank" rel="noreferrer">
            <EmberMark size={22} glow />
            <span className="bp-map-tag">{initial.place}</span>
            <span className="bp-map-hint">open in maps ↗</span>
          </a>

          <div className="bp-rule" />

          <div className="bp-going">
            <span className="l">
              <span className="bp-num" style={{ fontSize: 21 }}>{goingCount}</span> going
              {hereCount > 0 && <span className="tot">{hereCount} here</span>}
            </span>
            {me && (
              <span className="r">
                You’re <b style={{ color: YOU_COLOR[me.status] }}>{PULSE_STATUS_LABEL[me.status]}</b>
              </span>
            )}
          </div>

          {!live && (
            <div className="bp-card bp-card--primary mt-4 px-5 py-4">
              That’s a wrap — <span className="bp-num" style={{ fontSize: 22 }}>{madeItCount}</span>{' '}
              made it.
            </div>
          )}

          {live && (
            <section className="bp-card bp-card--primary mt-4 p-4">
              <div className="bp-overline mb-2.5">You</div>
              {needName && (
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={CAPS.displayName}
                  placeholder="Pick a name your friends will know" autoFocus className="bp-field mb-2.5" />
              )}
              <StatusSegment statuses={SLIDER_STATUSES} current={me?.status ?? null}
                onPick={(s) => setStatus(s)} disabled={busy} dimmed={me?.status === 'out'} />
              <OptOutToggle on={me?.status === 'out'}
                onToggle={(next) => setStatus(next ? 'out' : 'in')} disabled={busy} />
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
            </section>
          )}

          <div className="bp-overline mt-6 mb-3">Who’s in</div>
          <div className="bp-tiles pb-1">
            {live && (
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
                <span className="bp-tile-name">{p.me ? 'You' : firstName(p.displayName)}</span>
                <span className={`bp-tile-sub${p.status === 'here' ? ' bp-tile-sub--here' : p.status === 'on_my_way' ? ' bp-tile-sub--otw' : ''}`}>
                  {timeFor(p) ?? PULSE_STATUS_LABEL[p.status]}
                </span>
              </div>
            ))}
          </div>
          {roster.length === 0 && <p className="bp-sub mt-2">No one yet. Be the first.</p>}

          {notes.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {notes.map((p) => (
                <p key={p.participantId} className="bp-quote">
                  “{p.note}”<span className="by">— {p.me ? 'you' : firstName(p.displayName)}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        {live && (
          <button type="button" className="bp-wrap-row mt-6" onClick={doWrap} disabled={busy}>
            <span className="k">That’s a wrap</span>
            <span className="s">ends it for everyone</span>
          </button>
        )}
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
              <div className={`bpd-dv${live ? ' bpd-dv--live' : ''}`}>
                {live
                  ? <><span className="bonfire-pulse-dot" /> Live now</>
                  : <span style={{ color: 'var(--smoke)' }}>Wrapped</span>}
              </div>
            </div>
            <div className="bpd-dcell">
              <div className="bpd-dk">{live ? 'Winds down in' : 'When'}</div>
              <div className="bpd-dv">{live ? <Winddown iso={initial.expiresAt} /> : initial.timeLabel}</div>
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
          {live && <CopyButton text={inviteText} className="bpd-invite" label="Copy invite message" idle={<>＋&nbsp;Invite</>} done="✓ Copied" />}
          <CopyButton text={linkText} className="bpd-share" label="Copy link" idle="↗" done="✓" />
          {initial.crewToken && (
            <Link href={`/p/c/${initial.crewToken}`} className="bpd-share" aria-label={`Back to ${initial.crewName}`}>‹</Link>
          )}
        </div>
      </div>

      <div className={`bpd-hero${mappable ? ' bpd-hero--map' : ' bpd-hero--cream'}${live ? '' : ' bpd-hero--done'}`}>
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
                style={otwSeat(otwShown.length + (otwMore > 0 ? 1 : 0), i)} title={p.displayName}>
                <span className="bpd-person-av" style={{ background: avatarColorFor(p.participantId) }}>{initialsFor(p.displayName)}</span>
                {p.etaMinutes
                  ? <span className="bpd-person-eta">→ {p.etaMinutes} min</span>
                  : <span className="bpd-person-nm">{p.me ? 'You' : firstName(p.displayName)}</span>}
              </span>
            ))}
            {otwMore > 0 && (
              <button type="button" className="bpd-more" style={otwSeat(otwShown.length + 1, otwShown.length)}
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

            {/* overlays: count + breakdown, maps + search, venue + notes, commit */}
            <div className="bpd-hero-count">
              <div className="n">{desktopCount}</div>
              <div className="l">{live ? 'going' : 'made it'}</div>
              {live && (hereList.length > 0 || otwList.length > 0 || inCount > 0) && (
                <div className="bpd-hero-breakdown">
                  {hereList.length > 0 && <span className="b b--here"><span className="bonfire-pulse-dot" />{hereList.length} here</span>}
                  {otwList.length > 0 && <span className="b b--otw">→ {otwList.length} on the way</span>}
                  {inCount > 0 && <span className="b b--in">{inCount} in</span>}
                </div>
              )}
            </div>
            <div className="bpd-hero-tr">
              {live && goingCount > 0 && (
                <button type="button" className="bpd-hero-searchpill" onClick={() => setExpanded(true)}>⌕ Everyone</button>
              )}
              <a className="bpd-hero-maps" href={mapsHref} target="_blank" rel="noreferrer">Open in maps ↗</a>
            </div>
            <div className="bpd-hero-bl">
              {heroNotes.map((p) => (
                <span key={p.participantId} className="bpd-hero-note">“{p.note}”<span className="by">— {p.me ? 'you' : firstName(p.displayName)}</span></span>
              ))}
              <span className="bpd-hero-venue">
                <span className="vn">{venueName}</span>
                {venueSub && <span className="vs">{venueSub}</span>}
              </span>
            </div>

            {live && (
              <div className="bpd-commit">
                <div className="bp-overline">You</div>
                {me
                  ? <div className="bpd-youstate">You’re <b style={{ color: YOU_COLOR[me.status] }}>{PULSE_STATUS_LABEL[me.status]}</b></div>
                  : <div className="bpd-youstate bpd-youstate--empty">Slide to join the fire</div>}
                {needName && (
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={CAPS.displayName}
                    placeholder="A name your friends will know" className="bp-field" style={{ marginBottom: 4 }} />
                )}
                <StatusSegment statuses={SLIDER_STATUSES} current={me?.status ?? null}
                  onPick={(s) => setStatus(s)} disabled={busy} dimmed={me?.status === 'out'} className="bp-seg2--desktop" />
                <OptOutToggle on={me?.status === 'out'}
                  onToggle={(next) => setStatus(next ? 'out' : 'in')} disabled={busy} />
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
                <button type="button" className="bp-wrap-row bpd-commit-wrap" onClick={doWrap} disabled={busy}>
                  <span className="k">That’s a wrap</span><span className="s">ends it for everyone</span>
                </button>
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
                            <div className="nm">{p.me ? 'You' : p.displayName}</div>
                            <div className={`det ${p.status}`}>{timeFor(p) ?? PULSE_STATUS_LABEL[p.status]}</div>
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
    </div>
    </>
  )
}
