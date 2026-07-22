'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CAPS, authCopy } from '@/lib/pulse/copy'
import { formatPhoneDisplay } from '@/lib/pulse/phone-format'
import { WhenPicker, type WhenValue } from '../WhenPicker.client'
import { EmberMark } from '../ui.client'
import { VerifySheet, useVerifyFlow } from '../verify.client'
import { OnboardingAvailabilitySheet } from '../availability.client'

type Mode = 'crew' | 'pulse'

export function CreateForm() {
  const [mode, setMode] = useState<Mode>('crew')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // crew fields
  const [name, setName] = useState('')
  // pulse fields
  const [title, setTitle] = useState('')
  const [place, setPlace] = useState('')
  const [when, setWhen] = useState<WhenValue | null>(null)
  // Optional venue facts behind a single "booking a table?" disclosure. Facts about the venue,
  // never a gate on people; both unset = exactly today's form. Creation-time only in v1.
  const [reservation, setReservation] = useState(false)
  const [seatsCap, setSeatsCap] = useState<number | null>(null)
  const [countNeededBy, setCountNeededBy] = useState('') // datetime-local value, local wall clock

  // Stable across re-submits so a double-tap is idempotent (one pulse).
  const [clientUuid] = useState(() => crypto.randomUUID())

  // Crew creation is a durable act: tier-0 gets the inline verify step, then we retry.
  const [gate, setGate] = useState<'verify' | 'onboard' | null>(null)

  // Delivery step for a standalone pulse: the message + link are the whole delivery
  // (no crew, no SMS — nothing is ever sent by creating). `verified` gates the save step:
  // an already-verified creator sees only the delivery actions.
  const [delivery, setDelivery] = useState<{ path: string; message: string; verified: boolean } | null>(null)
  const [copied, setCopied] = useState(false)

  async function createCrew(): Promise<void> {
    const res = await fetch('/api/pulse/crews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    const data = await res.json()
    if (res.status === 403 && data?.code === 'verify_required') { setGate('verify'); return }
    if (!res.ok) { setError(data?.error ?? 'something went wrong'); return }
    router.push(data.path)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (mode === 'crew') {
        await createCrew()
      } else {
        // The WhenPicker resolved absolute start/end instants in this device's timezone; the server
        // derives the human label from them. Refuse a Later start that has slipped into the past.
        if (!when || !when.valid) { setError('Pick a start time in the future'); return }
        // datetime-local parses as local wall clock — the same resolution rule as the when itself.
        const cutoff = reservation && countNeededBy ? new Date(countNeededBy) : null
        if (cutoff && cutoff.getTime() > when.endsAt.getTime()) {
          setError('The count needs to land before the pulse ends'); return
        }
        const res = await fetch('/api/pulse/pulses', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(), place: place.trim(),
            startAt: when.startAt.toISOString(), endsAt: when.endsAt.toISOString(),
            timezone: when.timezone, clientUuid,
            seatsCap: reservation && seatsCap ? seatsCap : undefined,
            countNeededBy: cutoff ? cutoff.toISOString() : undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data?.error ?? 'something went wrong'); return }
        setDelivery({ path: data.path, message: data.message, verified: !!data.verified })
      }
    } catch {
      setError('network error — try again')
    } finally {
      setBusy(false)
    }
  }

  if (delivery) {
    return (
      <div className="space-y-2.5">
        {/* Save step first (Partiful "sign up to save"), then the message + link escape. Never
            shown to a verified creator — their pulse already persists to their phone identity. */}
        {!delivery.verified && (
          <>
            <SaveYourPulse />
            <div className="bp-overline text-center" style={{ paddingTop: 2 }}>{authCopy.saveSkipCta}</div>
          </>
        )}
        <div className="bp-card px-4 py-3" style={{ fontSize: 13.5, lineHeight: 1.45, wordBreak: 'break-word' }}>
          {delivery.message}
        </div>
        <button type="button" className="bp-btn bp-btn--primary w-full"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(delivery.message)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            } catch {}
          }}>
          {copied ? 'Copied' : 'Copy message + link'}
        </button>
        <button type="button" className="bp-btn bp-btn--ghost w-full" onClick={() => router.push(delivery.path)}>
          Open the pulse
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bp-seg">
        <button type="button" onClick={() => setMode('crew')}
          className={`bp-opt flex-1${mode === 'crew' ? ' bp-opt--sel' : ''}`}>
          A board
        </button>
        <button type="button" onClick={() => setMode('pulse')}
          className={`bp-opt flex-1${mode === 'pulse' ? ' bp-opt--sel' : ''}`}>
          A pulse
        </button>
      </div>

      {mode === 'crew' ? (
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={CAPS.crewName}
          className="bp-field" placeholder="Board name — “Greece ’26”" autoFocus />
      ) : (
        <div className="space-y-2.5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={CAPS.pulseTitle}
            className="bp-field" placeholder="What — “Sunset at the windmills”" autoFocus />
          <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={CAPS.pulsePlace}
            className="bp-field" placeholder="Where — “Oia”" />
          <WhenPicker onChange={setWhen} />

          {/* Venue facts, collapsed behind one disclosure — unset keeps today's form exactly. */}
          {!reservation ? (
            <button type="button" className="bp-btn bp-btn--ghost w-full" onClick={() => setReservation(true)}
              style={{ fontSize: 13.5 }}>
              Booking a table? Add the details
            </button>
          ) : (
            <div className="bp-card px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="bp-overline">The reservation</span>
                <button type="button" aria-label="Remove reservation details"
                  onClick={() => { setReservation(false); setSeatsCap(null); setCountNeededBy('') }}
                  style={{ fontSize: 13, color: 'var(--smoke)', background: 'none', border: 'none', padding: 2, cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span style={{ fontSize: 13.5 }}>Table for</span>
                <div className="flex items-center gap-1.5">
                  <button type="button" className="bp-opt" aria-label="Fewer seats"
                    onClick={() => setSeatsCap((n) => (n && n > 2 ? n - 1 : null))}>−</button>
                  <span className="bp-num" style={{ minWidth: 34, textAlign: 'center', fontSize: 17 }}>
                    {seatsCap ?? '—'}
                  </span>
                  <button type="button" className="bp-opt" aria-label="More seats"
                    onClick={() => setSeatsCap((n) => Math.min(50, (n ?? 7) + 1))}>+</button>
                </div>
              </div>
              <label className="flex items-center justify-between gap-2" style={{ fontSize: 13.5 }}>
                <span>Count needed by</span>
                <input type="datetime-local" value={countNeededBy} onChange={(e) => setCountNeededBy(e.target.value)}
                  className="bp-field" style={{ width: 'auto', fontSize: 13 }} aria-label="Count needed by" />
              </label>
              <p className="bp-sub" style={{ fontSize: 12, lineHeight: 1.4 }}>
                Facts for the group, not a limit — nobody gets blocked from joining.
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{error}</p>}

      <button className="bp-btn bp-btn--primary w-full"
        disabled={busy || (mode === 'crew' ? !name.trim() : !title.trim() || !place.trim() || !when?.valid)}>
        <EmberMark size={15} />
        {busy ? '…' : mode === 'crew' ? 'Make the board' : 'Drop the pulse'}
      </button>

      {gate === 'verify' && (
        <VerifySheet onClose={() => setGate(null)}
          blurb="A board sticks around, so it needs a real person behind it. One quick text."
          onVerified={(_v, merged) => {
            // First-ever verify → the one skippable availability question, then create.
            if (merged) { setGate(null); void createCrew() } else { setGate('onboard') }
          }} />
      )}
      {gate === 'onboard' && (
        <OnboardingAvailabilitySheet
          onClose={() => { setGate(null); void createCrew() }}
          onSaved={() => { setGate(null); void createCrew() }} />
      )}
    </form>
  )
}

// The skippable "save your pulse" step on the delivery screen: an inline verify (not a sheet —
// the delivery screen is already a full surface). Reuses the app-wide useVerifyFlow. A nameless
// account gets a name step after verifying (like LoginFlow); on success it flips to an
// acknowledgement. Never blocks delivery — the pulse exists and its link works regardless.
function SaveYourPulse() {
  const [saved, setSaved] = useState(false)
  const [needName, setNeedName] = useState(false)
  const [name, setName] = useState('')
  const [nameBusy, setNameBusy] = useState(false)
  const [nameErr, setNameErr] = useState<string | null>(null)
  const { step, phone, setPhone, code, setCode, busy, err, sendCode, confirm, restart, resendIn, resend } =
    useVerifyFlow((viewer) => {
      // Ghost merge now carries the just-made pulse onto the canonical (see repo.reassignPulseFootprint),
      // so "saved" is honest whether this verify created the identity in place or merged into one.
      if (viewer.displayName) setSaved(true)
      else setNeedName(true)
    })

  async function submitName() {
    if (nameBusy || !name.trim()) return
    setNameBusy(true); setNameErr(null)
    try {
      const res = await fetch('/api/pulse/name', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setNameErr(data?.error ?? 'try again'); return }
      setSaved(true)
    } catch {
      setNameErr('network error')
    } finally { setNameBusy(false) }
  }

  if (saved) {
    return (
      <div className="bp-card bp-card--primary px-4 py-3" style={{ fontSize: 13.5, lineHeight: 1.45 }}>
        {authCopy.savedAck}
      </div>
    )
  }

  if (needName) {
    return (
      <form className="bp-card px-4 py-4" onSubmit={(e) => { e.preventDefault(); submitName() }}>
        <div className="bp-title mb-1" style={{ fontSize: 17 }}>{authCopy.nameHeading}</div>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={CAPS.displayName}
          autoComplete="name" placeholder={authCopy.namePlaceholder} aria-label="Your name"
          className="bp-field mb-2.5 mt-2" autoFocus />
        {nameErr && <p className="mb-2.5" style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{nameErr}</p>}
        <button type="submit" disabled={nameBusy || !name.trim()} className="bp-btn bp-btn--primary w-full">
          {authCopy.nameCta}
        </button>
      </form>
    )
  }

  return (
    <div className="bp-card px-4 py-4">
      <div className="bp-title mb-1" style={{ fontSize: 17 }}>{authCopy.savePulseHeading}</div>
      <p className="bp-sub mb-3" style={{ marginTop: 2 }}>{authCopy.savePulseBlurb}</p>
      {step === 'phone' ? (
        <form onSubmit={(e) => { e.preventDefault(); sendCode() }}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel"
            placeholder={authCopy.phonePlaceholder} aria-label="Phone number" className="bp-field mb-2.5" />
          {err && <p className="mb-2.5" style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{err}</p>}
          <button type="submit" disabled={busy || !phone.trim()} className="bp-btn bp-btn--primary w-full">
            {authCopy.sendCodeCta}
          </button>
          <p className="mt-2.5" style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--smoke)' }}>
            {authCopy.savePrivacyLine}
          </p>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); confirm() }}>
          <p className="mb-2.5" style={{ fontSize: 13, color: 'var(--smoke)' }}>
            {authCopy.sentTo(formatPhoneDisplay(phone))}
          </p>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" placeholder={authCopy.codePlaceholder}
            aria-label="Verification code" className="bp-field mb-2.5" autoFocus />
          {err && <p className="mb-2.5" style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{err}</p>}
          <button type="submit" disabled={busy || code.trim().length < 6} className="bp-btn bp-btn--primary w-full">
            {authCopy.confirmCta}
          </button>
          {resendIn > 0 ? (
            <p className="mt-2 text-center" style={{ fontSize: 13, color: 'var(--smoke)' }}>
              {authCopy.resendCountdown(resendIn)}
            </p>
          ) : (
            <button type="button" onClick={resend} disabled={busy} className="bp-btn bp-btn--ghost mt-2 w-full">
              {authCopy.resendCta}
            </button>
          )}
          <button type="button" onClick={restart} disabled={busy} className="bp-btn bp-btn--ghost mt-1 w-full">
            {authCopy.differentNumberCta}
          </button>
        </form>
      )}
    </div>
  )
}
