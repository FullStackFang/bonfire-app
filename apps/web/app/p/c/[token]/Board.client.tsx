'use client'
import { useMemo, useState } from 'react'
import { createStore, useStore } from 'zustand'
import Link from 'next/link'
import { BOARD_STATUSES, pulsePhase, type BoardStatus, type PublicBoard, type PublicCrewMember, type PublicPresence, type PublicPulseListItem, type PublicViewer } from '@/lib/pulse/types'
import { BOARD_STATUS_LABEL, CAPS } from '@/lib/pulse/copy'
import { usePulsePoll } from '@/lib/pulse/usePulsePoll'
import { WhenPicker, type WhenValue } from '../../WhenPicker.client'
import { BrandRow, EmberMark, EndsAt, PresenceItem, ShareChip, Sheet, StatusPill } from '../../ui.client'
import { VerifySheet } from '../../verify.client'
import { AvailabilityCorrectionSheet, OnboardingAvailabilitySheet, Toast } from '../../availability.client'

// ---- per-mount store ----
type BoardStore = {
  presence: PublicPresence[]
  pulses: PublicPulseListItem[]
  members: PublicCrewMember[]
  viewer: PublicViewer
  holdMine: boolean // optimistic lock: a poll must not clobber my in-flight own row
  setViewer: (v: PublicViewer) => void
  setHold: (b: boolean) => void
  upsertMine: (row: PublicPresence) => void
  addPulse: (p: PublicPulseListItem) => void
  setMembers: (m: PublicCrewMember[]) => void
  applyServer: (b: PublicBoard) => void
}

function makeStore(initial: PublicBoard) {
  return createStore<BoardStore>((set) => ({
    presence: initial.presence,
    pulses: initial.pulses,
    members: initial.members,
    viewer: initial.viewer,
    holdMine: false,
    setViewer: (v) => set({ viewer: v }),
    setHold: (b) => set({ holdMine: b }),
    upsertMine: (row) => set((s) => ({
      presence: [row, ...s.presence.filter((p) => p.participantId !== row.participantId)],
    })),
    addPulse: (pu) => set((s) => ({
      pulses: s.pulses.some((x) => x.token === pu.token) ? s.pulses : [...s.pulses, pu],
    })),
    setMembers: (m) => set({ members: m }),
    applyServer: (b) => set((s) => {
      const myId = s.viewer?.participantId ?? b.viewer?.participantId ?? null
      let presence = b.presence
      if (s.holdMine && myId) {
        const mine = s.presence.find((p) => p.participantId === myId)
        if (mine) presence = [mine, ...b.presence.filter((p) => p.participantId !== myId)]
      }
      return { presence, pulses: b.pulses, members: b.members, viewer: b.viewer ?? s.viewer }
    }),
  }))
}

export function Board({ initial, crewToken, autoCompose = false }: {
  initial: PublicBoard
  crewToken: string
  autoCompose?: boolean // Who's-Around handoff: open the composer; opening sends nothing
}) {
  const [store] = useState(() => makeStore(initial))

  const presence = useStore(store, (s) => s.presence)
  const pulses = useStore(store, (s) => s.pulses)
  const members = useStore(store, (s) => s.members)
  const viewer = useStore(store, (s) => s.viewer)
  // Actions are stable (created once); pull them off the store directly.
  const { upsertMine, setHold, setViewer, addPulse, setMembers, applyServer } = store.getState()

  // Live freshness: others' changes land within a few seconds; applyServer protects my in-flight tap.
  usePulsePoll<PublicBoard>(`/api/pulse/c/${crewToken}/state`, applyServer)

  const me = useMemo(() => presence.find((p) => p.me) ?? null, [presence])
  const others = useMemo(() => presence.filter((p) => !p.me), [presence])
  const isMember = useMemo(
    () => !!viewer && members.some((m) => m.participantId === viewer.participantId),
    [members, viewer],
  )

  const [sheet, setSheet] = useState<'pulse' | 'status' | 'verify' | 'onboard' | 'fix' | null>(
    autoCompose ? 'pulse' : null,
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const needName = !viewer?.displayName

  async function joinCrew(asViewer: PublicViewer): Promise<void> {
    const res = await fetch('/api/pulse/crew-membership', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ crewToken }),
    })
    if (res.ok && asViewer) {
      setMembers([
        ...members.filter((m) => m.participantId !== asViewer.participantId),
        { participantId: asViewer.participantId, displayName: asViewer.displayName ?? 'you', me: true },
      ])
    }
  }

  async function leaveCrew() {
    if (busy || !viewer) return
    setBusy(true)
    try {
      const res = await fetch('/api/pulse/crew-membership', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ crewToken }),
      })
      if (res.ok) setMembers(members.filter((m) => m.participantId !== viewer.participantId))
    } finally { setBusy(false) }
  }

  function tapJoin() {
    if (viewer?.verified) { void joinCrew(viewer); return }
    setSheet('verify') // tier-0 sees the verify prompt; joining resumes after
  }

  async function onVerified(v: NonNullable<PublicViewer>, merged: boolean) {
    setViewer(v)
    await joinCrew(v)
    // One skippable question after the FIRST phone verify; a ghost merge means the
    // canonical identity already answered (or skipped) it.
    setSheet(merged ? null : 'onboard')
  }

  async function saveStatus(status: BoardStatus, nextNote: string, nm?: string): Promise<boolean> {
    if (busy) return false
    if (needName && !nm) { setErr('Add your name first.'); return false }
    setErr(null)
    const optimistic = !!viewer
    if (optimistic) {
      upsertMine({
        participantId: viewer!.participantId, displayName: viewer!.displayName ?? nm ?? 'you',
        status, note: nextNote.trim() || null, me: true,
      })
      setHold(true)
    }
    setBusy(true)
    try {
      const res = await fetch('/api/pulse/presence', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ crewToken, status, note: nextNote.trim() || undefined, name: nm }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setErr(data?.error ?? 'try again'); setHold(false); return false }
      setViewer(data.viewer)
      upsertMine({
        participantId: data.viewer.participantId, displayName: data.viewer.displayName,
        status, note: nextNote.trim() || null, me: true,
      })
      setHold(false)
      return true
    } catch {
      setErr('network error'); setHold(false); return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-4">
      <div className="flex-1">
        <BrandRow><ShareChip /></BrandRow>

        <h1 className="bp-title mt-3">{initial.name}</h1>
        <p className="bp-sub mt-1">
          {presence.length === 0 ? 'no one on the link yet' : `${presence.length} on the link`}
        </p>

        {/* Crew roster strip. Joining is explicit and verified-tier; leaving is quiet.
            Nothing here notifies anyone, and no one is framed for not joining. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="bp-sub">
            {members.length === 0 ? 'no crew yet' : `${members.length} in the crew`}
          </span>
          {isMember ? (
            <>
              <Link href={`/p/c/${crewToken}/around`} className="bp-pin-chip" style={{ textDecoration: 'none' }}>
                who’s around
              </Link>
              <button type="button" className="bp-pin-chip" onClick={() => setSheet('fix')}>
                i’m free / away
              </button>
              <button type="button" className="bp-pin-chip" onClick={leaveCrew} disabled={busy}
                style={{ opacity: 0.6 }}>
                leave
              </button>
            </>
          ) : (
            <button type="button" className="bp-pin-chip" onClick={tapJoin} disabled={busy}>
              join the crew
            </button>
          )}
        </div>

        {/* Live pulses */}
        <div className="bp-overline mt-6 mb-2">
          <span className="bp-live"><span className="bonfire-pulse-dot" />Live now</span>
        </div>
        {pulses.length === 0 && <p className="bp-sub">Nothing live yet. Drop a pulse below.</p>}
        <ul className="space-y-2">
          {pulses.map((p) => (
            <li key={p.token}>
              <Link href={`/p/s/${p.token}`} className="bp-card bp-card--spark block px-4 py-3.5" style={{ color: 'inherit' }}>
                <span className="flex items-baseline gap-2">
                  <span className="bp-num" style={{ fontSize: 18 }}>{p.title}</span>
                  <span className="ml-auto"><EndsAt iso={p.expiresAt} /></span>
                </span>
                <span className="mt-0.5 block" style={{ fontSize: 12, color: 'var(--smoke)' }}>
                  <b style={{ color: 'var(--coal)', fontWeight: 600 }}>{p.place}</b> · {p.timeLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Presence roster */}
        <div className="bp-overline mt-6 mb-2">Who’s up to what</div>
        <div className="space-y-2 pb-4">
          {me && (
            <PresenceItem
              name={me.displayName} seed={me.participantId} you note={me.note}
              pill={<StatusPill kind="board" status={me.status} label={BOARD_STATUS_LABEL[me.status]} />}
            />
          )}
          {others.map((p) => (
            <PresenceItem
              key={p.participantId} name={p.displayName} seed={p.participantId} note={p.note}
              pill={<StatusPill kind="board" status={p.status} label={BOARD_STATUS_LABEL[p.status]} />}
            />
          ))}
          {others.length === 0 && <p className="bp-sub">Just you so far. Drop the link in your chat.</p>}
        </div>
      </div>

      {/* Footer toolbar */}
      <div className="bp-foot flex gap-2.5">
        <button type="button" className="bp-btn bp-btn--primary flex-1" onClick={() => setSheet('pulse')}>
          <EmberMark size={15} />Drop a pulse
        </button>
        <button type="button" className="bp-btn bp-btn--outline bp-btn--icon" onClick={() => setSheet('status')} aria-label="Set your status">
          ◔
        </button>
      </div>

      {/* mount fresh per open so drafts initialize from the live roster row */}
      {sheet === 'pulse' && (
        <PulseSheet onClose={() => setSheet(null)} crewToken={crewToken} crewName={initial.name} onCreated={addPulse} />
      )}
      {sheet === 'status' && (
        <StatusSheet onClose={() => { setSheet(null); setErr(null) }}
          me={me} needName={needName} busy={busy} err={err} onSave={saveStatus} />
      )}
      {sheet === 'verify' && (
        <VerifySheet onClose={() => setSheet(null)} onVerified={onVerified}
          blurb="Joining a crew takes one quick text. Your number is never shown to anyone." />
      )}
      {sheet === 'onboard' && (
        <OnboardingAvailabilitySheet onClose={() => setSheet(null)}
          onSaved={() => { setSheet(null); setToast('Saved. Nobody was pinged.') }} />
      )}
      {sheet === 'fix' && (
        <AvailabilityCorrectionSheet onClose={() => setSheet(null)}
          onSaved={(m) => { setSheet(null); setToast(m) }} />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}

function StatusSheet({ onClose, me, needName, busy, err, onSave }: {
  onClose: () => void
  me: PublicPresence | null
  needName: boolean
  busy: boolean
  err: string | null
  onSave: (status: BoardStatus, note: string, name?: string) => Promise<boolean>
}) {
  const [picked, setPicked] = useState<BoardStatus>(me?.status ?? 'around')
  const [note, setNote] = useState(me?.note ?? '')
  const [name, setName] = useState('')

  async function save() {
    const ok = await onSave(picked, note, needName ? name.trim() : undefined)
    if (ok) onClose()
  }

  return (
    <Sheet open onClose={onClose} title="Set your status" blurb="Self-reported, never GPS. Add a note if you like.">
      {needName && (
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={CAPS.displayName}
          placeholder="Pick a name your friends will know" className="bp-field mb-2.5" autoFocus />
      )}
      <div className="bp-seg mb-4">
        {BOARD_STATUSES.map((s) => (
          <button key={s} type="button" disabled={busy}
            className={`bp-opt${picked === s ? ' bp-opt--sel' : ''}`}
            onClick={() => setPicked(s)}>
            {BOARD_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={CAPS.note}
        placeholder="Optional note — “by the harbor”" className="bp-field mb-2.5" />
      {err && <p className="mb-2.5" style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{err}</p>}
      <button type="button" onClick={save} disabled={busy} className="bp-btn bp-btn--primary w-full">
        Save status
      </button>
    </Sheet>
  )
}

type DeliveryFacts = {
  token: string
  url: string
  message: string
  sms: { available: boolean; memberCount: number; quietHours: boolean }
}

function PulseSheet({ onClose, crewToken, crewName, onCreated }: {
  onClose: () => void
  crewToken: string
  crewName: string
  onCreated: (p: PublicPulseListItem) => void
}) {
  const [title, setTitle] = useState('')
  const [place, setPlace] = useState('')
  const [when, setWhen] = useState<WhenValue | null>(null)
  const [busy, setBusy] = useState(false)
  const [clientUuid, setClientUuid] = useState(() => crypto.randomUUID())
  // The delivery step: creator-controlled, explicit about who gets texted. Copy is always
  // available; "Text the crew" only for a verified member outside quiet hours.
  const [delivery, setDelivery] = useState<DeliveryFacts | null>(null)
  const [copied, setCopied] = useState(false)
  const [smsState, setSmsState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [smsErr, setSmsErr] = useState<string | null>(null)

  async function create() {
    if (busy || !title.trim() || !place.trim() || !when || !when.valid) return
    setBusy(true)
    try {
      const res = await fetch('/api/pulse/pulses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), place: place.trim(),
          startAt: when.startAt.toISOString(), endsAt: when.endsAt.toISOString(),
          crewToken, clientUuid, timezone: when.timezone,
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.token) {
        // Optimistic card: derive its phase/label locally the same way the server serializes it.
        const phase = pulsePhase({ startAt: when.startAt, expiresAt: when.endsAt, closedAt: null }, new Date())
        onCreated({
          token: data.token, title: title.trim(), place: place.trim(), timeLabel: data.timeLabel ?? '',
          startAt: when.startAt.toISOString(), expiresAt: when.endsAt.toISOString(), phase,
        })
        setClientUuid(crypto.randomUUID())
        setDelivery({ token: data.token, url: data.url, message: data.message, sms: data.sms })
      }
    } finally { setBusy(false) }
  }

  async function copyMessage() {
    if (!delivery) return
    try {
      await navigator.clipboard.writeText(delivery.message)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  async function textCrew() {
    if (!delivery || smsState === 'sending' || smsState === 'sent') return
    setSmsState('sending'); setSmsErr(null)
    try {
      const res = await fetch('/api/pulse/pulse-sms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pulseToken: delivery.token,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setSmsState('error'); setSmsErr(data?.error ?? 'try again'); return }
      setSmsState('sent')
    } catch {
      setSmsState('error'); setSmsErr('network error')
    }
  }

  if (delivery) {
    return (
      <Sheet open onClose={onClose} title="It’s live. Now tell people."
        blurb="You choose who hears about it — nothing was sent yet.">
        <div className="bp-card mb-2.5 px-4 py-3" style={{ fontSize: 13.5, lineHeight: 1.45, wordBreak: 'break-word' }}>
          {delivery.message}
        </div>
        <button type="button" onClick={copyMessage} className="bp-btn bp-btn--primary w-full">
          {copied ? 'Copied' : 'Copy message + link'}
        </button>
        {delivery.sms.quietHours && (
          <p className="mt-2.5" style={{ fontSize: 13, color: 'var(--smoke)' }}>
            Texting is off during quiet hours (10pm–8am). The link still works anywhere.
          </p>
        )}
        {delivery.sms.available && delivery.sms.memberCount > 0 && (
          <>
            <button type="button" onClick={textCrew} className="bp-btn bp-btn--outline mt-2 w-full"
              disabled={smsState === 'sending' || smsState === 'sent'}>
              {smsState === 'sent' ? 'Texts sent' : smsState === 'sending' ? 'Sending…' : 'Text the crew'}
            </button>
            <p className="mt-1.5" style={{ fontSize: 12.5, color: 'var(--smoke)' }}>
              This texts the {delivery.sms.memberCount} {delivery.sms.memberCount === 1 ? 'person' : 'people'} in {crewName}. Once, ever, per pulse.
            </p>
          </>
        )}
        {smsErr && <p className="mt-2" style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{smsErr}</p>}
        <button type="button" onClick={onClose} className="bp-btn bp-btn--ghost mt-2 w-full">
          Done
        </button>
      </Sheet>
    )
  }

  return (
    <Sheet open onClose={onClose} title="Drop a pulse" blurb="A one-line plan. Not an invite — people opt themselves in.">
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={CAPS.pulseTitle}
        placeholder="What’s the plan?" className="bp-field mb-2.5" autoFocus />
      <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={CAPS.pulsePlace}
        placeholder="Where?" className="bp-field mb-2.5" />
      <div className="mb-4"><WhenPicker onChange={setWhen} /></div>
      <button type="button" onClick={create} className="bp-btn bp-btn--primary w-full"
        disabled={busy || !title.trim() || !place.trim() || !when?.valid}>
        <EmberMark size={15} />Drop it
      </button>
    </Sheet>
  )
}
