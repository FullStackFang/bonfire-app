'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TTL_PRESETS, DEFAULT_TTL_PRESET, CAPS } from '@/lib/pulse/copy'
import { resolveExpiry } from '@/lib/pulse/time'
import { EmberMark } from '../ui.client'
import { VerifySheet } from '../verify.client'
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
  const [timeLabel, setTimeLabel] = useState('')
  const [ttlKey, setTtlKey] = useState(DEFAULT_TTL_PRESET.key)

  // Stable across re-submits so a double-tap is idempotent (one pulse).
  const [clientUuid] = useState(() => crypto.randomUUID())

  // Crew creation is a durable act: tier-0 gets the inline verify step, then we retry.
  const [gate, setGate] = useState<'verify' | 'onboard' | null>(null)

  // Delivery step for a standalone pulse: the message + link are the whole delivery
  // (no crew, no SMS — nothing is ever sent by creating).
  const [delivery, setDelivery] = useState<{ path: string; message: string } | null>(null)
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
        // Resolve the TTL preset to an absolute instant in THIS device's timezone before posting.
        const preset = TTL_PRESETS.find((p) => p.key === ttlKey) ?? DEFAULT_TTL_PRESET
        const expiresAt = resolveExpiry(preset, new Date()).toISOString()
        const res = await fetch('/api/pulse/pulses', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(), place: place.trim(), timeLabel: timeLabel.trim(),
            expiresAt, clientUuid,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data?.error ?? 'something went wrong'); return }
        setDelivery({ path: data.path, message: data.message })
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
          <input value={timeLabel} onChange={(e) => setTimeLabel(e.target.value)} maxLength={CAPS.pulseTimeLabel}
            className="bp-field" placeholder="When — “8:30pm” (or “now”)" />
          <div>
            <div className="bp-overline mt-4 mb-2">Stays live for</div>
            <div className="bp-seg">
              {TTL_PRESETS.map((p) => (
                <button key={p.key} type="button" onClick={() => setTtlKey(p.key)}
                  className={`bp-opt${ttlKey === p.key ? ' bp-opt--sel' : ''}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{error}</p>}

      <button className="bp-btn bp-btn--primary w-full"
        disabled={busy || (mode === 'crew' ? !name.trim() : !title.trim() || !place.trim() || !timeLabel.trim())}>
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
