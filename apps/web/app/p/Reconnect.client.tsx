'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmberMark } from './ui.client'
import type { PublicReconnect } from '@/lib/pulse/types'

// Relationship-intelligence card on the dashboard home (Phase 3). Opt-in, one suggestion at a time,
// warm and non-guilting. "Plan it" seeds the normal Phase 1 plan flow — nothing is sent silently.

const linkBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }

export function ReconnectCard({ initial, hasPeople }: { initial: PublicReconnect; hasPeople: boolean }) {
  const router = useRouter()
  const [rc, setRc] = useState<PublicReconnect>(initial)
  const [busy, setBusy] = useState(false)

  async function act(body: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch('/api/pulse/reconnect', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await res.json()
      if (res.ok) setRc(d.reconnect)
    } catch { /* leave state as-is */ } finally { setBusy(false) }
  }

  async function planIt(name: string) {
    setBusy(true)
    try {
      const create = await fetch('/api/pulse/plan', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intent: `catch up with ${name}`, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      const cd = await create.json()
      if (!create.ok) { setBusy(false); return }
      await fetch(`/api/pulse/plan/${cd.token}/publish`, { method: 'POST' })
      router.push(`/p/plan/${cd.token}`)
    } catch { setBusy(false) }
  }

  // Opt-in prompt — only worth showing once there are people it could be about.
  if (!rc.enabled) {
    if (!hasPeople) return null
    return (
      <div className="bp-card px-4 py-3 mt-3" style={{ fontSize: 13 }}>
        <span style={{ color: 'var(--smoke)' }}>Want a nudge when it’s been a while with someone? </span>
        <button type="button" disabled={busy} onClick={() => act({ action: 'enable' })}
          style={{ ...linkBtn, fontWeight: 600, color: 'var(--ember-deep)' }}>Turn on</button>
      </div>
    )
  }

  const s = rc.suggestion
  if (!s) return null
  const line = s.daysSince == null
    ? `You and ${s.displayName} haven’t gotten together yet.`
    : `You haven’t seen ${s.displayName} in ${s.daysSince} days.`

  return (
    <div className="bp-card bp-card--spark px-4 py-3 mt-3 space-y-2.5">
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <EmberMark size={13} /><span className="bp-overline" style={{ margin: 0 }}>Reconnect</span>
      </div>
      <p style={{ fontSize: 14, color: 'var(--coal)', margin: 0 }}>{line} Want to plan something?</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="bp-btn bp-btn--primary" style={{ flex: 1 }} disabled={busy}
          onClick={() => planIt(s.displayName)}>Plan it</button>
        <button type="button" className="bp-btn bp-btn--ghost" style={{ flex: 1 }} disabled={busy}
          onClick={() => act({ action: 'dismiss' })}>Not now</button>
      </div>
      <button type="button" disabled={busy} onClick={() => act({ action: 'mute', participantId: s.participantId })}
        style={{ ...linkBtn, fontSize: 11.5, color: 'var(--smoke)' }}>Don’t suggest {s.displayName}</button>
    </div>
  )
}
