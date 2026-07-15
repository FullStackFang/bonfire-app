'use client'
import { useEffect, useState } from 'react'
import { CAPS } from '@/lib/pulse/copy'
import { Sheet } from './ui.client'

// The two PASSIVE availability flows. Neither ever notifies anyone — saving writes a row and
// shows a silent toast, nothing else.

const DAYS = [
  { dow: 1, label: 'Mon' }, { dow: 2, label: 'Tue' }, { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' }, { dow: 5, label: 'Fri' }, { dow: 6, label: 'Sat' }, { dow: 0, label: 'Sun' },
]

function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** Silent, self-dismissing confirmation. */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
      background: 'var(--coal)', color: 'var(--cream)', borderRadius: 999,
      padding: '9px 18px', fontSize: 13.5, boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
    }}>
      {message}
    </div>
  )
}

/** One question, asked once after the first phone verify. Skippable. Not a schedule editor. */
export function OnboardingAvailabilitySheet({ onClose, onSaved }: {
  onClose: () => void // skip — creates nothing
  onSaved: () => void
}) {
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:30')
  const [label, setLabel] = useState('work')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const toggle = (dow: number) =>
    setDays((d) => (d.includes(dow) ? d.filter((x) => x !== dow) : [...d, dow]))

  async function save() {
    if (busy || days.length === 0) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/pulse/availability/baseline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          daysOfWeek: days, startTime, endTime,
          timezone: browserTimezone(), label: label.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setErr(data?.error ?? 'try again'); return }
      onSaved()
    } catch {
      setErr('network error')
    } finally { setBusy(false) }
  }

  return (
    <Sheet open onClose={onClose} title="When are you usually tied up?"
      blurb="One answer, once. Your people see “busy” instead of silence — never the details.">
      <div className="bp-seg mb-2.5" style={{ flexWrap: 'wrap' }}>
        {DAYS.map((d) => (
          <button key={d.dow} type="button" disabled={busy}
            className={`bp-opt${days.includes(d.dow) ? ' bp-opt--sel' : ''}`}
            onClick={() => toggle(d.dow)}>
            {d.label}
          </button>
        ))}
      </div>
      <div className="mb-2.5 flex items-center gap-2">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bp-field" disabled={busy} />
        <span style={{ color: 'var(--smoke)', fontSize: 13 }}>to</span>
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bp-field" disabled={busy} />
      </div>
      <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={CAPS.availabilityLabel}
        placeholder="Label — “work”" className="bp-field mb-2.5" disabled={busy} />
      {err && <p className="mb-2.5" style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{err}</p>}
      <button type="button" onClick={save} disabled={busy || days.length === 0}
        className="bp-btn bp-btn--primary w-full">
        Save
      </button>
      <button type="button" onClick={onClose} disabled={busy} className="bp-btn bp-btn--ghost mt-2 w-full">
        Skip for now
      </button>
    </Sheet>
  )
}

/** "I'm free" / "I'm away" quick correction, with a date range for vacations. */
export function AvailabilityCorrectionSheet({ onClose, onSaved }: {
  onClose: () => void
  onSaved: (message: string) => void // caller shows the silent toast
}) {
  const [state, setState] = useState<'free' | 'busy'>('free')
  const [scope, setScope] = useState<'today' | 'range'>('today')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    if (busy) return
    let startsAt: Date
    let endsAt: Date
    if (scope === 'today') {
      startsAt = new Date()
      endsAt = new Date()
      endsAt.setHours(23, 59, 59, 999)
    } else {
      if (!fromDate || !toDate) { setErr('Pick the dates.'); return }
      startsAt = new Date(`${fromDate}T00:00:00`) // local midnight — device timezone
      endsAt = new Date(`${toDate}T23:59:59.999`)
      if (endsAt <= startsAt) { setErr('End date is before start.'); return }
    }
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/pulse/availability/exception', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          state, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
          allDay: true, label: label.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setErr(data?.error ?? 'try again'); return }
      onSaved(state === 'free' ? 'Marked free. Nobody was pinged.' : 'Marked away. Nobody was pinged.')
    } catch {
      setErr('network error')
    } finally { setBusy(false) }
  }

  return (
    <Sheet open onClose={onClose} title="Fix your availability"
      blurb="A quiet correction — it changes what people see, it never messages anyone.">
      <div className="bp-seg mb-2.5">
        <button type="button" className={`bp-opt flex-1${state === 'free' ? ' bp-opt--sel' : ''}`}
          disabled={busy} onClick={() => setState('free')}>
          I’m free
        </button>
        <button type="button" className={`bp-opt flex-1${state === 'busy' ? ' bp-opt--sel' : ''}`}
          disabled={busy} onClick={() => setState('busy')}>
          I’m away
        </button>
      </div>
      <div className="bp-seg mb-2.5">
        <button type="button" className={`bp-opt flex-1${scope === 'today' ? ' bp-opt--sel' : ''}`}
          disabled={busy} onClick={() => setScope('today')}>
          Rest of today
        </button>
        <button type="button" className={`bp-opt flex-1${scope === 'range' ? ' bp-opt--sel' : ''}`}
          disabled={busy} onClick={() => setScope('range')}>
          Pick dates
        </button>
      </div>
      {scope === 'range' && (
        <div className="mb-2.5 flex items-center gap-2">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bp-field" disabled={busy} />
          <span style={{ color: 'var(--smoke)', fontSize: 13 }}>to</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bp-field" disabled={busy} />
        </div>
      )}
      <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={CAPS.availabilityLabel}
        placeholder="Label — “vacation” (optional)" className="bp-field mb-2.5" disabled={busy} />
      {err && <p className="mb-2.5" style={{ fontSize: 13, color: 'var(--ember-deep)' }}>{err}</p>}
      <button type="button" onClick={save} disabled={busy} className="bp-btn bp-btn--primary w-full">
        Save
      </button>
    </Sheet>
  )
}
