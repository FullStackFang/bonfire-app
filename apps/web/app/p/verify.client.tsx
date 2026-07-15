'use client'
import { useState } from 'react'
import type { PublicViewer } from '@/lib/pulse/types'
import { Sheet } from './ui.client'

// Inline phone-verify step (enter phone → enter code), mounted lazily by DURABLE acts only
// (declare availability, create/join crew, text the crew). Consumption paths never render this.
// On success the server may have re-pointed the device cookie (ghost merge) — the fresh viewer
// comes back in the payload and is handed to the caller.

export function VerifySheet({ onClose, onVerified, blurb }: {
  onClose: () => void
  onVerified: (viewer: NonNullable<PublicViewer>, merged: boolean) => void
  blurb?: string
}) {
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function sendCode() {
    if (busy || !phone.trim()) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/pulse/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setErr(data?.error ?? 'try again'); return }
      setStep('code')
    } catch {
      setErr('network error')
    } finally { setBusy(false) }
  }

  async function confirm() {
    if (busy || code.trim().length < 6) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/pulse/verify', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setErr(data?.error ?? 'try again')
        if (data?.code === 'expired' || data?.code === 'too_many_attempts' || data?.code === 'no_code') {
          setStep('phone'); setCode('')
        }
        return
      }
      onVerified(data.viewer, !!data.merged)
    } catch {
      setErr('network error')
    } finally { setBusy(false) }
  }

  return (
    <Sheet open onClose={onClose} title="Verify your number"
      blurb={blurb ?? 'One quick text so your crew and availability stick with you. Never shown to anyone.'}>
      {step === 'phone' ? (
        <>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel"
            placeholder="Your phone — (555) 010-2030" className="bp-field mb-2.5" autoFocus />
          {err && <p className="mb-2.5" style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{err}</p>}
          <button type="button" onClick={sendCode} disabled={busy || !phone.trim()}
            className="bp-btn bp-btn--primary w-full">
            Text me a code
          </button>
        </>
      ) : (
        <>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code"
            className="bp-field mb-2.5" autoFocus />
          {err && <p className="mb-2.5" style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{err}</p>}
          <button type="button" onClick={confirm} disabled={busy || code.trim().length < 6}
            className="bp-btn bp-btn--primary w-full">
            Verify
          </button>
          <button type="button" onClick={() => { setStep('phone'); setCode(''); setErr(null) }}
            className="bp-btn bp-btn--ghost mt-2 w-full" disabled={busy}>
            Use a different number
          </button>
        </>
      )}
    </Sheet>
  )
}
