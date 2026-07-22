'use client'
import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { EmberMark } from './ui.client'
import { candidateCopy } from '@/lib/pulse/copy'
import type { PublicIntentCandidate } from '@/lib/pulse/types'

// Intent-resolver candidates on the dashboard home (add-intent-layer). Pull-only — reaching this card
// never sent anyone anything; the mutual match simply surfaces on this visit. "Plan it" seeds the
// normal Phase 1 plan flow (same as ember-seeding and reconnect) and lands the viewer on the plan to
// review and share — nothing is sent silently, and no plan row existed before this tap. Rule 3: the
// card states no fact about a person's availability; the suggested window is a system default only.

const emptySubscribe = () => () => {}

// The suggested window rendered as a neutral default label ("Thu evening") — computed on the client
// so it uses the viewer's own clock, and never attributed to any person.
function WindowHint({ iso }: { iso: string }) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  if (!mounted) return null
  const d = new Date(iso)
  const weekday = d.toLocaleDateString(undefined, { weekday: 'short' })
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 600, color: 'var(--spark)', background: 'var(--spark-tint)',
      borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap',
    }}>
      {candidateCopy.windowHint(`${weekday} evening`)}
    </span>
  )
}

function CandidateCard({ c, onDismiss }: { c: PublicIntentCandidate; onDismiss: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function planIt() {
    setBusy(true)
    try {
      const create = await fetch('/api/pulse/plan', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intent: c.seedIntent, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      const cd = await create.json()
      if (!create.ok) { setBusy(false); return }
      await fetch(`/api/pulse/plan/${cd.token}/publish`, { method: 'POST' })
      router.push(`/p/plan/${cd.token}`)
    } catch { setBusy(false) }
  }

  return (
    <div className="bp-card bp-card--spark px-4 py-3 space-y-2.5">
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <EmberMark size={13} /><span className="bp-overline" style={{ margin: 0 }}>{candidateCopy.overline}</span>
        {c.suggestedWindow && <span className="ml-auto"><WindowHint iso={c.suggestedWindow.startsAt} /></span>}
      </div>
      <p style={{ fontSize: 14, color: 'var(--coal)', margin: 0 }}>{candidateCopy.line(c.people, c.activity)}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="bp-btn bp-btn--primary" style={{ flex: 1 }} disabled={busy}
          onClick={planIt}>{candidateCopy.planCta}</button>
        <button type="button" className="bp-btn bp-btn--ghost" style={{ flex: 1 }} disabled={busy}
          onClick={onDismiss}>{candidateCopy.dismissCta}</button>
      </div>
    </div>
  )
}

export function CandidatesCard({ initial }: { initial: PublicIntentCandidate[] }) {
  // "Not now" is a local dismissal only — nothing is written (a candidate is derived, not a row).
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const shown = initial.filter((c) => !dismissed.has(c.key))
  if (shown.length === 0) return null
  return (
    <div className="mt-3 space-y-2">
      {shown.map((c) => (
        <CandidateCard key={c.key} c={c} onDismiss={() => setDismissed((s) => new Set(s).add(c.key))} />
      ))}
    </div>
  )
}
