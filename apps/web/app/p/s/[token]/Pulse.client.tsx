'use client'
import { useMemo, useState } from 'react'
import { createStore, useStore } from 'zustand'
import Link from 'next/link'
import { PULSE_STATUSES, type PulseStatus, type PublicPulse, type PublicPulseResponse, type PublicViewer } from '@/lib/pulse/types'
import { PULSE_STATUS_LABEL, CAPS } from '@/lib/pulse/copy'
import { usePulsePoll } from '@/lib/pulse/usePulsePoll'
import { BrandRow, EndsAt, PresenceItem, ShareChip, StatusPill } from '../../ui.client'

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
  const others = useMemo(() => participants.filter((p) => !p.me), [participants])

  const [name, setName] = useState('')
  const [eta, setEta] = useState<string>(me?.etaMinutes ? String(me.etaMinutes) : '')
  const [note, setNote] = useState(me?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
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

  return (
    <div className="flex flex-1 flex-col px-4 pt-4">
      <div className="flex-1">
        <BrandRow><ShareChip /></BrandRow>

        {initial.crewToken && (
          <Link href={`/p/c/${initial.crewToken}`} className="mt-3 inline-block"
            style={{ fontSize: 12.5, color: 'var(--smoke)' }}>
            ← {initial.crewName}
          </Link>
        )}

        <h1 className="bp-title mt-1">{initial.title}</h1>
        <p className="bp-sub mt-1 flex items-baseline gap-2">
          <span><b style={{ color: 'var(--coal)', fontWeight: 600 }}>{initial.place}</b> · {initial.timeLabel}</span>
          {live && <EndsAt iso={initial.expiresAt} />}
        </p>

        {!live && (
          <div className="bp-card bp-card--primary mt-5 px-5 py-4">
            That’s a wrap — <span className="bp-num" style={{ fontSize: 22 }}>{madeItCount}</span>{' '}
            made it.
          </div>
        )}

        {live && (
          <section className="bp-card bp-card--primary mt-5 p-4">
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

        <div className="bp-overline mt-6 mb-2">Who’s in</div>
        <div className="space-y-2 pb-4">
          {others.length === 0 && <p className="bp-sub">No one yet. Be the first.</p>}
          {others.map((p) => (
            <PresenceItem
              key={p.participantId} name={p.displayName} seed={p.participantId} note={p.note}
              live={p.status === 'here'}
              pill={<StatusPill kind="pulse" status={p.status} label={PULSE_STATUS_LABEL[p.status]} time={timeFor(p)} />}
            />
          ))}
        </div>
      </div>

      {live && (
        <div className="bp-foot flex items-center justify-center">
          <button type="button" onClick={doWrap} disabled={busy} className="bp-btn bp-btn--ghost">
            that’s a wrap
          </button>
        </div>
      )}
    </div>
  )
}
