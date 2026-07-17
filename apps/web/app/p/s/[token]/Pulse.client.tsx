'use client'
import { useMemo, useState } from 'react'
import { createStore, useStore } from 'zustand'
import Link from 'next/link'
import { PULSE_STATUSES, type PulseStatus, type PublicPulse, type PublicPulseResponse, type PublicViewer } from '@/lib/pulse/types'
import { PULSE_STATUS_LABEL, CAPS, pulseMessage } from '@/lib/pulse/copy'
import { usePulsePoll } from '@/lib/pulse/usePulsePoll'
import { EmberMark, EndsAt, avatarColorFor, initialsFor } from '../../ui.client'

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
// the fire ring holds at most this many faces; the rest fold into a +N chip
const RING_CAP = 8

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n

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

  // ── desktop hearth: faces ring the fire (present-first); overflow → +N chip ──
  const otwCount = roster.filter((p) => p.status === 'on_my_way').length
  const ringOverflow = goingRoster.length > RING_CAP
  const ringShown = ringOverflow ? goingRoster.slice(0, RING_CAP - 1) : goingRoster
  const ringSlots = ringShown.length + (ringOverflow ? 1 : 0)
  const ringPos = (i: number) => {
    const a = ((-90 + (360 * i) / Math.max(ringSlots, 1)) * Math.PI) / 180
    return { left: `${50 + 34 * Math.cos(a)}%`, top: `${50 + 37 * Math.sin(a)}%` }
  }
  const desktopCount = live ? goingCount : madeItCount
  const rosterQuery = query.trim().toLowerCase()
  const rosterFiltered = rosterQuery ? roster.filter((p) => p.displayName.toLowerCase().includes(rosterQuery)) : roster

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(initial.place)}`
  const inviteText = () => pulseMessage(initial.title, initial.place, initial.timeLabel, window.location.href)
  const linkText = () => window.location.href

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
              <div className="bp-seg">
                {PULSE_STATUSES.map((s) => (
                  <button key={s} type="button" onClick={() => setStatus(s)} disabled={busy}
                    className={`bp-opt${me?.status === s ? ' bp-opt--sel' : ''}`}>
                    {PULSE_STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
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

    {/* ── desktop tree: contained commit + living hearth (shown ≥1100px) ── */}
    <div className="bpd-desktop">
      <div className="bpd-head">
        <div className="min-w-0">
          <h1 className="bpd-h1">{initial.title}</h1>
          <div className="bpd-sub">
            {live
              ? <><span className="bp-live-tag"><span className="bonfire-pulse-dot" /> live</span><span>·</span><span>{initial.timeLabel}</span><span>·</span><EndsAt iso={initial.expiresAt} /></>
              : <><span className="bp-done-tag">wrapped</span><span>·</span><span>{initial.timeLabel}</span></>}
          </div>
          <a className="bpd-place" href={mapsHref} target="_blank" rel="noreferrer">
            <span className="pin">◉</span>{initial.place}<span className="maps">maps ↗</span>
          </a>
        </div>
        <div className="bpd-head-r">
          {live && <CopyButton text={inviteText} className="bpd-invite" label="Copy invite message" idle={<>＋&nbsp;Invite</>} done="✓ Copied" />}
          <CopyButton text={linkText} className="bpd-share" label="Copy link" idle="↗" done="✓" />
          {initial.crewToken && (
            <Link href={`/p/c/${initial.crewToken}`} className="bpd-share" aria-label={`Back to ${initial.crewName}`}>‹</Link>
          )}
        </div>
      </div>

      <div className="bpd-grid">
        {/* left — commit */}
        <div className="bpd-card bpd-commit">
          {live ? (
            <>
              <div className="bp-overline">You</div>
              {me && <div className="bpd-youstate">You’re <b style={{ color: YOU_COLOR[me.status] }}>{PULSE_STATUS_LABEL[me.status]}</b></div>}
              {needName && (
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={CAPS.displayName}
                  placeholder="Pick a name your friends will know" className="bp-field" style={{ marginTop: me ? 0 : 12 }} />
              )}
              <button type="button" className="bpd-cta" onClick={() => setStatus('in')} disabled={busy}>
                <span className="emo">🔥</span>{me ? PULSE_STATUS_LABEL[me.status] : 'I’m in'}
              </button>
              <div className="bpd-seg">
                {PULSE_STATUSES.filter((s) => s !== 'in').map((s) => (
                  <button key={s} type="button" onClick={() => setStatus(s)} disabled={busy}
                    className={`bp-opt${me?.status === s ? ' bp-opt--sel' : ''}`}>{PULSE_STATUS_LABEL[s]}</button>
                ))}
              </div>
              {me?.status === 'on_my_way' && (
                <div className="mt-3 flex gap-2">
                  <input value={eta} onChange={(e) => setEta(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric"
                    placeholder="ETA (min)" className="bp-field" style={{ width: 128 }} />
                  <button type="button" onClick={() => setStatus('on_my_way', { eta: eta ? Number(eta) : null })} disabled={busy} className="bp-opt">set ETA</button>
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

              {notes.length > 0 && (
                <div className="bpd-notes">
                  <div className="bp-overline" style={{ marginBottom: 2 }}>Notes</div>
                  {notes.map((p) => (
                    <p key={p.participantId} className="bp-quote">“{p.note}”<span className="by">— {p.me ? 'you' : firstName(p.displayName)}</span></p>
                  ))}
                </div>
              )}

              <div className="bpd-foot-wrap">
                <button type="button" className="bp-wrap-row" onClick={doWrap} disabled={busy}>
                  <span className="k">That’s a wrap</span><span className="s">ends it for everyone</span>
                </button>
              </div>
            </>
          ) : (
            <div className="bp-card bp-card--primary px-5 py-4" style={{ fontSize: 16 }}>
              That’s a wrap — <span className="bp-num" style={{ fontSize: 24 }}>{madeItCount}</span> made it.
            </div>
          )}
        </div>

        {/* right — the living hearth */}
        <div className="bpd-card bpd-hearth">
          <div className="bpd-hearth-head">
            <span className="bpd-hcount">{desktopCount}</span>
            <span className="bpd-hlab">
              {live
                ? <><b>{hereCount} here</b> now{otwCount > 0 && <> · {otwCount} on the way</>} · going</>
                : <>made it</>}
            </span>
            {live && ringOverflow && !expanded && (
              <button type="button" className="bpd-search-pill" onClick={() => setExpanded(true)}>⌕ Search {goingCount}</button>
            )}
          </div>

          {!expanded ? (
            <div className="bpd-stage">
              <div className="bpd-bloom" aria-hidden />
              <div className="bpd-fire" aria-hidden>
                <div className="bpd-fl bpd-f1" /><div className="bpd-fl bpd-f2" /><div className="bpd-fl bpd-f3" /><div className="bpd-fl bpd-fcore" />
              </div>
              {ringShown.map((p, i) => (
                <span key={p.participantId}
                  className={`bpd-orb${p.status === 'here' ? ' bpd-orb--here' : ''}${p.me ? ' bpd-orb--me' : ''}`}
                  style={{ ...ringPos(i), background: avatarColorFor(p.participantId) }} title={p.displayName}>
                  {initialsFor(p.displayName)}
                  {p.status === 'here' && (
                    <span className="bp-tile-badge bp-tile-badge--here">
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                    </span>
                  )}
                  {p.status === 'on_my_way' && <span className="bp-tile-badge bp-tile-badge--otw">→</span>}
                  <span className="bpd-orb-nm">{p.me ? 'You' : firstName(p.displayName)}</span>
                </span>
              ))}
              {ringOverflow && (
                <button type="button" className="bpd-orb bpd-more" style={ringPos(ringSlots - 1)}
                  onClick={() => setExpanded(true)} aria-label="Show everyone">
                  +{goingRoster.length - (RING_CAP - 1)}
                </button>
              )}
              {goingRoster.length === 0 && (
                <p className="bp-sub" style={{ position: 'absolute', left: 0, right: 0, top: '50%', textAlign: 'center' }}>No one yet. Be the first.</p>
              )}
            </div>
          ) : (
            <div className="bpd-roster">
              <div className="bpd-rsearch">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${goingCount} going`} autoFocus />
                <button type="button" className="bpd-rback" onClick={() => { setExpanded(false); setQuery('') }}>‹ fire</button>
              </div>
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
          )}
        </div>
      </div>
    </div>
    </>
  )
}
