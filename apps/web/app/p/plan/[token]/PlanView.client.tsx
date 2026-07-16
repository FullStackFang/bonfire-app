'use client'
import { useState } from 'react'
import { usePulsePoll } from '@/lib/pulse/usePulsePoll'
import { EmberMark, PlanOptionBody, splitPlanLabel } from '../../ui.client'
import type { PublicPlan, PublicPlanOption } from '@/lib/pulse/types'

// The no-account link view. C1-C: friends mark WHICH OPTIONS THEY'RE FREE FOR (availability, never
// RSVP). There is no decline control — a non-response is simply no availability marked, and absence
// is never displayed. When an option crosses the threshold the plan strikes; the poll surfaces
// "it's on" without a reload.

function googleCalUrl(plan: PublicPlan, winner: PublicPlanOption): string {
  const start = winner.startsAt ? new Date(winner.startsAt) : null
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const text = encodeURIComponent(plan.intentText)
  const loc = encodeURIComponent(winner.venue?.name ?? '')
  if (!start) return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}`
  const end = new Date(start.getTime() + 2 * 3600_000)
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(start)}/${fmt(end)}&location=${loc}`
}

export function PlanView({ initial, token }: { initial: PublicPlan; token: string }) {
  const [plan, setPlan] = useState<PublicPlan>(initial)
  const [busyOption, setBusyOption] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Poll for others' availability + the strike. Never clobber while the viewer's own tap is in
  // flight (busyOption set) — the POST response is authoritative for that moment.
  usePulsePoll<{ plan: PublicPlan }>(`/api/pulse/plan/${token}/state`, (data) => {
    if (!busyOption && data?.plan) setPlan(data.plan)
  })

  async function markAvailable(optionId: string) {
    if (busyOption) return
    setBusyOption(optionId); setError(null)
    try {
      const res = await fetch(`/api/pulse/plan/${token}/pick`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ optionId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.error ?? 'something went wrong'); return }
      setPlan(data.plan)
    } catch {
      setError('network error — try again')
    } finally {
      setBusyOption(null)
    }
  }

  // Struck — "it's on".
  if (plan.struck && plan.winner) {
    const w = plan.winner
    const { time, venue } = splitPlanLabel(w.label, w.venue?.name)
    return (
      <div className="space-y-3">
        <div className="bp-overline bp-live mb-1"><EmberMark size={12} /> it’s on</div>
        <h1 className="bp-title">{time}</h1>
        {venue && <p style={{ fontWeight: 600, fontSize: 15, margin: '2px 0 0' }}>{venue}</p>}
        <p style={{ fontSize: 13.5, color: 'var(--smoke)' }}>
          {w.availableCount === 1 ? '1 person is in.' : `${w.availableCount} of you are in.`} No more back and forth.
        </p>
        <a className="bp-btn bp-btn--primary w-full" href={googleCalUrl(plan, w)} target="_blank" rel="noreferrer"
          style={{ textDecoration: 'none' }}>
          Add to calendar
        </a>
      </div>
    )
  }

  // Not shared yet (opener preview of a proposing plan).
  if (plan.state === 'proposing') {
    return (
      <div className="space-y-3">
        <div className="bp-overline mb-1">Not shared yet</div>
        <h1 className="bp-title">{plan.intentText}</h1>
        <p style={{ fontSize: 13.5, color: 'var(--smoke)' }}>Publish this plan to get a link you can share.</p>
        <div className="space-y-2 mt-1">
          {plan.options.map((o) => (
            <div key={o.id} className="bp-card px-4 py-3"><PlanOptionBody o={o} /></div>
          ))}
        </div>
      </div>
    )
  }

  // Open — mark availability.
  return (
    <div className="space-y-3">
      <div className="brandrow" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
        <EmberMark size={13} />
        <span className="bp-overline" style={{ margin: 0 }}>Bonfire · shared plan</span>
      </div>
      <h1 className="bp-title">
        {plan.creatorName ? `${plan.creatorName} is planning something` : 'You’re invited'}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--smoke)', margin: '2px 0 6px' }}>
        Tap the times you’re free for. No account needed.
      </p>
      <div className="space-y-2">
        {plan.options.map((o) => (
          <button key={o.id} type="button" disabled={!!busyOption}
            onClick={() => markAvailable(o.id)}
            className={`bp-opt-card${o.mine ? ' bp-opt-card--sel' : ''}${busyOption === o.id ? ' bp-opt-card--busy' : ''}`}>
            <PlanOptionBody o={o} showCount />
          </button>
        ))}
      </div>
      {plan.viewer && plan.options.some((o) => o.mine) && (
        <p style={{ fontSize: 12.5, color: 'var(--smoke)' }}>
          Thanks{plan.viewer.displayName ? `, ${plan.viewer.displayName}` : ''} — we’ll lock it in once enough people are free.
        </p>
      )}
      {error && <p style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{error}</p>}
    </div>
  )
}
