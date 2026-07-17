'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmberMark, PlanOptionBody } from '../../ui.client'
import type { PublicPlan } from '@/lib/pulse/types'

// Opener flow: state intent -> AI proposes options -> review & publish -> share the no-account link.
// House voice: statements, sentence case, no hype. Presence is never asked here — the opener is just
// picking what to propose; friends declare availability on the link.

type Phase = 'intent' | 'review' | 'share'

export function PlanNew({ initialIntent = '' }: { initialIntent?: string }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('intent')
  const [intent, setIntent] = useState(initialIntent)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<PublicPlan | null>(null)
  const [share, setShare] = useState<{ url: string; path: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function propose(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !intent.trim()) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/pulse/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          intent: intent.trim(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.error ?? 'something went wrong'); return }
      setPlan(data.plan)
      setPhase('review')
    } catch {
      setError('network error — try again')
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    if (busy || !plan) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/pulse/plan/${plan.token}/publish`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data?.error ?? 'something went wrong'); return }
      setPlan(data.plan)
      setShare({ url: data.url, path: data.path })
      setPhase('share')
    } catch {
      setError('network error — try again')
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'share' && share && plan) {
    const message = `${plan.creatorName ?? 'I'} put together a plan — tap the times you’re free: ${share.url}`
    return (
      <div className="space-y-2.5">
        <div className="bp-overline mb-1">Your plan is live</div>
        <h1 className="bp-title">Share it with your friends</h1>
        <p style={{ fontSize: 13.5, color: 'var(--smoke)', margin: '4px 0 8px' }}>
          Anyone with the link can pick the times that work — no account, no download.
        </p>
        <div className="bp-card px-4 py-3" style={{ fontSize: 13.5, lineHeight: 1.45, wordBreak: 'break-word' }}>
          {message}
        </div>
        <button type="button" className="bp-btn bp-btn--primary w-full"
          onClick={async () => {
            try { await navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
          }}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <button type="button" className="bp-btn bp-btn--ghost w-full" onClick={() => router.push(share.path)}>
          Open the plan
        </button>
      </div>
    )
  }

  if (phase === 'review' && plan) {
    return (
      <div className="space-y-3">
        <div className="bp-overline mb-1">Here are the best options</div>
        <h1 className="bp-title">{plan.intentText}</h1>
        <div className="space-y-2 mt-2">
          {plan.options.map((o) => (
            <div key={o.id} className="bp-card px-4 py-3"><PlanOptionBody o={o} /></div>
          ))}
        </div>
        {error && <p style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{error}</p>}
        <div className="bp-foot space-y-2 pt-1">
          <button type="button" className="bp-btn bp-btn--primary w-full" disabled={busy} onClick={publish}>
            <EmberMark size={15} />
            {busy ? '…' : 'Looks good — share it'}
          </button>
          <button type="button" className="bp-btn bp-btn--ghost w-full" disabled={busy}
            onClick={() => { setPhase('intent'); setPlan(null) }}>
            Start over
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={propose} className="space-y-4">
      <div className="bp-overline mb-1">New plan</div>
      <h1 className="bp-title">Make plans without the group chat</h1>
      <p style={{ fontSize: 13.5, color: 'var(--smoke)', margin: '2px 0 6px' }}>
        Say what you want. Bonfire finds the best times and a place.
      </p>
      <textarea value={intent} onChange={(e) => setIntent(e.target.value)} maxLength={500} rows={3}
        className="bp-field" autoFocus
        placeholder="Dinner with Sarah and Mike next week" />
      {error && <p style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{error}</p>}
      <button className="bp-btn bp-btn--primary w-full" disabled={busy || !intent.trim()}>
        <EmberMark size={15} />
        {busy ? 'Finding times…' : 'Find the best times'}
      </button>
    </form>
  )
}
