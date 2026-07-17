'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePulsePoll } from '@/lib/pulse/usePulsePoll'
import { emberSeedIntent } from '@/lib/pulse/ember-seed'
import { emberCopy } from '@/lib/pulse/copy'
import { EmberMark, PlanOptionBody, splitPlanLabel } from '../../ui.client'
import type { PublicEmber, PublicPlan, PublicPlanOption } from '@/lib/pulse/types'

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

export function PlanView({ initial, initialEmber = null, token }: {
  initial: PublicPlan; initialEmber?: PublicEmber | null; token: string
}) {
  const router = useRouter()
  const [plan, setPlan] = useState<PublicPlan>(initial)
  const [ember, setEmber] = useState<PublicEmber | null>(initialEmber)
  const [busyOption, setBusyOption] = useState<string | null>(null)
  const [busyEmber, setBusyEmber] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Poll for others' availability + the strike + the mutual-ember reveal. Never clobber while the
  // viewer's own tap is in flight — the POST response is authoritative for that moment.
  usePulsePoll<{ plan: PublicPlan; ember?: PublicEmber | null }>(`/api/pulse/plan/${token}/state`, (data) => {
    if (!busyOption && !busyEmber && data?.plan) {
      setPlan(data.plan)
      setEmber(data.ember ?? null)
    }
  })

  // The "again" tap and its withdrawal (close-plan-loop). Server enforces eligibility.
  async function sendEmber(method: 'POST' | 'DELETE') {
    if (busyEmber) return
    setBusyEmber(true); setError(null)
    try {
      const res = await fetch(`/api/pulse/plan/${token}/ember`, { method })
      const data = await res.json()
      if (!res.ok) { setError(data?.error ?? 'something went wrong'); return }
      setEmber(data.ember)
    } catch {
      setError('network error — try again')
    } finally {
      setBusyEmber(false)
    }
  }

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

  // Completed — the afterglow (again-engine spec). One warm line crediting the gathering and, for
  // winning-option markers only, the single "do this again?" control. No roster, no feedback form,
  // and never a word about who hasn't tapped — a non-tapper's view carries no ember data at all.
  if (plan.state === 'completed' && plan.winner) {
    const w = plan.winner
    const { time, venue } = splitPlanLabel(w.label, w.venue?.name)
    return (
      <div className="space-y-3">
        <div className="bp-overline mb-1"><EmberMark size={12} /> {emberCopy.overline}</div>
        <h1 className="bp-title">{time}</h1>
        {venue && <p style={{ fontWeight: 600, fontSize: 15, margin: '2px 0 0' }}>{venue}</p>}
        <p style={{ fontSize: 13.5, color: 'var(--smoke)' }}>{emberCopy.blurb}</p>
        {ember?.tapped ? (
          <div className="space-y-2">
            <p style={{ fontWeight: 600, fontSize: 14.5 }}>
              {ember.mutual ? emberCopy.mutualLine(ember.coTappers) : emberCopy.soloLine}
            </p>
            {!ember.mutual && (
              <p style={{ fontSize: 12.5, color: 'var(--smoke)' }}>{emberCopy.soloBlurb}</p>
            )}
            {ember.mutual && (
              <button type="button" className="bp-btn bp-btn--primary w-full" disabled={busyEmber}
                onClick={() => router.push(
                  `/p/plan/new?intent=${encodeURIComponent(emberSeedIntent(plan.intentText, ember.coTappers))}`,
                )}>
                <EmberMark size={15} />
                {emberCopy.nextCta}
              </button>
            )}
            <button type="button" className="bp-btn bp-btn--ghost w-full" disabled={busyEmber}
              onClick={() => sendEmber('DELETE')}>
              {emberCopy.untapCta}
            </button>
          </div>
        ) : w.mine ? (
          <button type="button" className="bp-btn bp-btn--primary w-full" disabled={busyEmber}
            onClick={() => sendEmber('POST')}>
            <EmberMark size={15} />
            {busyEmber ? '…' : emberCopy.tapCta}
          </button>
        ) : null}
        {error && <p style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{error}</p>}
      </div>
    )
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
