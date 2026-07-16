'use client'
import { useEffect, useState } from 'react'
import { authCopy } from '@/lib/pulse/copy'
import { formatPhoneDisplay } from '@/lib/pulse/phone-format'
import type { PublicViewer } from '@/lib/pulse/types'
import { Sheet } from './ui.client'

// Inline phone-verify step (enter phone → enter code), mounted lazily by DURABLE acts only
// (declare availability, create/join crew, text the crew). Consumption paths never render this.
// On success the server may have re-pointed the device cookie (ghost merge) — the fresh viewer
// comes back in the payload and is handed to the caller.

// UX pacing only — the real resend guard is the server's per-phone issue limit.
const RESEND_WAIT_S = 30

/** The issue/confirm state machine against /api/pulse/verify, shared by every verify surface
 *  (this sheet and the /p/login page) so error mapping and step transitions never drift. */
export function useVerifyFlow(onVerified: (viewer: NonNullable<PublicViewer>, merged: boolean) => void) {
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sentAt, setSentAt] = useState<number | null>(null)
  const [resendIn, setResendIn] = useState(0)

  // Countdown keyed on the last-send timestamp: each tick re-derives the remaining seconds
  // from the wall clock, so a strict-mode remount just recomputes. Cleaned up on unmount.
  useEffect(() => {
    if (sentAt === null) return
    const tick = () => setResendIn(Math.max(0, RESEND_WAIT_S - Math.round((Date.now() - sentAt) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [sentAt])

  async function issue(): Promise<boolean> {
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/pulse/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setErr(data?.error ?? 'try again'); return false }
      return true
    } catch {
      setErr('network error')
      return false
    } finally { setBusy(false) }
  }

  function markSent() {
    setSentAt(Date.now())
    setResendIn(RESEND_WAIT_S) // avoid a one-render flash of the active resend affordance
  }

  async function sendCode() {
    if (busy || !phone.trim()) return
    if (await issue()) { setStep('code'); markSent() }
  }

  /** Re-issue to the same phone from the code step. The countdown restarts either way — a
   *  throttled resend surfaces the mapped error and the server limit stays the real guard. */
  async function resend() {
    if (busy || step !== 'code') return
    await issue()
    markSent()
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

  function restart() {
    setStep('phone'); setCode(''); setErr(null)
  }

  return { step, phone, setPhone, code, setCode, busy, err, sendCode, confirm, restart, resendIn, resend }
}

export function VerifySheet({ onClose, onVerified, blurb }: {
  onClose: () => void
  onVerified: (viewer: NonNullable<PublicViewer>, merged: boolean) => void
  blurb?: string
}) {
  const { step, phone, setPhone, code, setCode, busy, err, sendCode, confirm, restart, resendIn, resend } =
    useVerifyFlow(onVerified)

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
          <p className="mt-2.5" style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--smoke)' }}>
            {authCopy.consentLine}
          </p>
        </>
      ) : (
        <>
          <p className="mb-2.5" style={{ fontSize: 13, color: 'var(--smoke)' }}>
            {authCopy.sentTo(formatPhoneDisplay(phone))}
          </p>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code"
            className="bp-field mb-2.5" autoFocus />
          {err && <p className="mb-2.5" style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{err}</p>}
          <button type="button" onClick={confirm} disabled={busy || code.trim().length < 6}
            className="bp-btn bp-btn--primary w-full">
            Verify
          </button>
          {resendIn > 0 ? (
            <p className="mt-2 text-center" style={{ fontSize: 13, color: 'var(--smoke)' }}>
              {authCopy.resendCountdown(resendIn)}
            </p>
          ) : (
            <button type="button" onClick={resend} disabled={busy}
              className="bp-btn bp-btn--ghost mt-2 w-full">
              {authCopy.resendCta}
            </button>
          )}
          <button type="button" onClick={restart}
            className="bp-btn bp-btn--ghost mt-1 w-full" disabled={busy}>
            Use a different number
          </button>
        </>
      )}
    </Sheet>
  )
}
