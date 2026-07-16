'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePulsePoll } from '@/lib/pulse/usePulsePoll'
import { EmberMark } from '../ui.client'
import type { PublicAround, AroundWindow } from '@/lib/pulse/types'

// Network discovery surface (Phase 2). Coarse "who's around" — NO location, no distances. Mark
// yourself around, see your people who are around, and "go live" to start something that converges
// via the Phase 1 plan engine. House voice; no out-list, no shaming.

const WINDOWS: { key: AroundWindow; label: string }[] = [
  { key: 'now', label: 'Now' },
  { key: 'tonight', label: 'Tonight' },
  { key: 'this_week', label: 'This week' },
]
const ACTIVITIES = ['Coffee', 'Drinks', 'Dinner', 'Walk', 'Anything']

export function AroundView({ initial }: { initial: PublicAround }) {
  const router = useRouter()
  const [around, setAround] = useState<PublicAround>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locale, setLocale] = useState(initial.mine?.locale ?? '')

  // go-live picks
  const [activity, setActivity] = useState<string | null>(null)
  const [goWhen, setGoWhen] = useState<AroundWindow>('tonight')

  usePulsePoll<{ around: PublicAround }>(`/api/pulse/around/state`, (d) => {
    if (!busy && d?.around) setAround(d.around)
  })

  async function post(body: unknown) {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/pulse/around', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.error ?? 'something went wrong'); return }
      setAround(data.around)
    } catch { setError('network error — try again') } finally { setBusy(false) }
  }

  async function goLive() {
    if (busy || !activity) return
    setBusy(true); setError(null)
    try {
      const whenLabel = WINDOWS.find((w) => w.key === goWhen)!.label.toLowerCase()
      const intent = `${activity.toLowerCase()} ${whenLabel} with people around`
      const create = await fetch('/api/pulse/plan', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intent, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      const cd = await create.json()
      if (!create.ok) { setError(cd?.error ?? 'could not start'); return }
      await fetch(`/api/pulse/plan/${cd.token}/publish`, { method: 'POST' })
      router.push(`/p/plan/${cd.token}`)
    } catch { setError('network error — try again') } finally { setBusy(false) }
  }

  const mine = around.mine

  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <EmberMark size={14} />
        <div className="bp-overline" style={{ margin: 0 }}>Who’s around</div>
      </div>

      {/* I'm around */}
      <div className="bp-card px-4 py-3 space-y-2.5">
        <div style={{ fontWeight: 600, fontSize: 14 }}>{mine ? 'You’re around' : 'Are you around?'}</div>
        <div className="bp-seg">
          {WINDOWS.map((w) => (
            <button key={w.key} type="button" disabled={busy}
              onClick={() => post({ window: w.key, locale: locale.trim() || null })}
              className={`bp-opt flex-1${mine?.aroundWindow === w.key ? ' bp-opt--sel' : ''}`}>
              {w.label}
            </button>
          ))}
        </div>
        <input value={locale} onChange={(e) => setLocale(e.target.value)} maxLength={60}
          className="bp-field" placeholder="Where? — “Toronto” (optional)"
          onBlur={() => { if (mine) post({ window: mine.aroundWindow, locale: locale.trim() || null }) }} />
        {mine && (
          <button type="button" className="bp-btn bp-btn--ghost w-full" disabled={busy}
            onClick={() => post({ clear: true })}>Not around anymore</button>
        )}
      </div>

      {/* People around */}
      <div>
        <div className="bp-overline mb-2">Your people</div>
        {around.people.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--smoke)' }}>No one’s marked around yet. When your people are, they’ll show here.</p>
        ) : (
          <div className="bp-list">
            {around.people.map((p) => (
              <div key={p.participantId} className="person" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--coal)' }}>{p.displayName}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--smoke)' }}>{p.label}{p.locale ? ` · ${p.locale}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Go live */}
      <div className="bp-card--spark bp-card px-4 py-3 space-y-2.5">
        <div style={{ fontWeight: 600, fontSize: 14 }}>Start something</div>
        <div className="bp-overline" style={{ margin: 0 }}>What are you up for</div>
        <div className="chipwrap" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ACTIVITIES.map((a) => (
            <button key={a} type="button" onClick={() => setActivity(a)}
              className={`bp-opt${activity === a ? ' bp-opt--sel' : ''}`}>{a}</button>
          ))}
        </div>
        <div className="bp-overline" style={{ margin: '4px 0 0' }}>When</div>
        <div className="bp-seg">
          {WINDOWS.map((w) => (
            <button key={w.key} type="button" onClick={() => setGoWhen(w.key)}
              className={`bp-opt flex-1${goWhen === w.key ? ' bp-opt--sel' : ''}`}>{w.label}</button>
          ))}
        </div>
        <button type="button" className="bp-btn bp-btn--primary w-full" disabled={busy || !activity} onClick={goLive}>
          <EmberMark size={15} />{busy ? '…' : 'Go live'}
        </button>
      </div>

      {error && <p style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{error}</p>}
    </div>
  )
}
