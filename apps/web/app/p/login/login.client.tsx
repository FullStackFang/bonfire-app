'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authCopy, CAPS } from '@/lib/pulse/copy'
import { formatPhoneDisplay } from '@/lib/pulse/phone-format'
import { EmberMark } from '../ui.client'
import { useVerifyFlow } from '../verify.client'

// Full-page verify flow on the shared useVerifyFlow() hook — same endpoints, error mapping,
// and step transitions as VerifySheet; only the markup differs. On confirm the cookie is
// already set/re-pointed by the API; a nameless viewer (brand-new account) gets an inline
// name step first, then push + refresh renders the (possibly ghost-merged) identity's dash.

export function LoginFlow() {
  const router = useRouter()
  const [nameStep, setNameStep] = useState(false)
  const [name, setName] = useState('')
  const [nameBusy, setNameBusy] = useState(false)
  const [nameErr, setNameErr] = useState<string | null>(null)
  const { step, phone, setPhone, code, setCode, busy, err, sendCode, confirm, restart, resendIn, resend } =
    useVerifyFlow((viewer) => {
      // Returning users (incl. ghost merge) already have a name — straight to the dash.
      if (viewer.displayName) { router.push('/p'); router.refresh() }
      else setNameStep(true)
    })

  function goHome() {
    router.push('/p'); router.refresh()
  }

  async function submitName() {
    if (nameBusy || !name.trim()) return
    setNameBusy(true); setNameErr(null)
    try {
      const res = await fetch('/api/pulse/name', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setNameErr(data?.error ?? 'try again'); return }
      goHome()
    } catch {
      setNameErr('network error')
    } finally { setNameBusy(false) }
  }

  return (
    <main className="mx-auto min-h-full w-full max-w-md px-4 pt-12 pb-8">
      <div className="mb-8 flex flex-col items-center gap-2">
        <EmberMark glow size={40} />
        <span className="bp-wordmark">BONFIRE</span>
      </div>

      {nameStep ? (
        <>
          <h1 className="bp-title mb-6 text-center">{authCopy.nameHeading}</h1>
          <form onSubmit={(e) => { e.preventDefault(); submitName() }}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={CAPS.displayName}
              autoComplete="name" placeholder={authCopy.namePlaceholder} aria-label="Your name"
              className="bp-field mb-2.5" autoFocus />
            {nameErr && <p className="mb-2.5" style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{nameErr}</p>}
            <button type="submit" disabled={nameBusy || !name.trim()} className="bp-btn bp-btn--primary w-full">
              {authCopy.nameCta}
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="bp-title mb-1 text-center">{authCopy.signInHeading}</h1>
          <p className="bp-sub mb-6 text-center">{authCopy.signInBlurb}</p>

          <form onSubmit={(e) => { e.preventDefault(); if (step === 'phone') sendCode(); else confirm() }}>
            {/* The phone section persists through the code step — disabled, never replaced. */}
            <div className="mb-2.5 flex gap-2">
              {/* Static US/CA prefix — normalizePhone assumes bare 10 digits are +1. */}
              <span className="bp-field flex items-center" style={{ width: 'auto', flexShrink: 0 }} aria-hidden>
                🇺🇸🇨🇦 +1
              </span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel"
                autoComplete="tel" placeholder={authCopy.phonePlaceholder} aria-label="Phone number"
                className="bp-field" disabled={step === 'code'} autoFocus />
            </div>

            {step === 'phone' ? (
              <>
                {err && <p className="mb-2.5" style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{err}</p>}
                <button type="submit" disabled={busy || !phone.trim()} className="bp-btn bp-btn--primary w-full">
                  {authCopy.sendCodeCta}
                </button>
                <p className="mt-2.5 text-center" style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--smoke)' }}>
                  {authCopy.consentLine}
                </p>
              </>
            ) : (
              <>
                <p className="mb-4" style={{ fontSize: 13, color: 'var(--smoke)' }}>
                  {authCopy.sentTo(formatPhoneDisplay(phone))}
                </p>
                <label htmlFor="login-code" className="mb-1.5 block" style={{ fontSize: 13, fontWeight: 600 }}>
                  {authCopy.codeLabel}
                </label>
                <input id="login-code" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric" autoComplete="one-time-code" placeholder={authCopy.codePlaceholder}
                  className="bp-field mb-2.5" autoFocus />
                {err && <p className="mb-2.5" style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{err}</p>}
                <button type="submit" disabled={busy || code.trim().length < 6} className="bp-btn bp-btn--primary w-full">
                  {authCopy.confirmCta}
                </button>
                {resendIn > 0 ? (
                  <p className="mt-3 text-center" style={{ fontSize: 13, color: 'var(--smoke)' }}>
                    {authCopy.resendCountdown(resendIn)}
                  </p>
                ) : (
                  <button type="button" onClick={resend} disabled={busy} className="bp-btn bp-btn--ghost mt-2 w-full">
                    {authCopy.resendCta}
                  </button>
                )}
                <button type="button" onClick={restart} className="bp-btn bp-btn--ghost mt-1 w-full" disabled={busy}>
                  {authCopy.differentNumberCta}
                </button>
              </>
            )}
          </form>
        </>
      )}
    </main>
  )
}
