'use client'
import { useEffect, useRef, useState } from 'react'
import { DURATION_PRESETS, DEFAULT_DURATION_KEY } from '@/lib/pulse/copy'
import { resolveWhen, type WhenMode, type DayPick } from '@/lib/pulse/time'

// The "When" control: one Now/Later mode toggle plus a duration. Now starts immediately; Later picks
// a Today/Tomorrow day + a wall-clock time. It resolves to absolute { startAt, endsAt } in THIS
// device's timezone (the creator's) and reports them — plus validity — to the parent, which posts
// them and disables submit while a Later start is not in the future. Shared by /p/new and the crew
// board's drop sheet so the two create paths stay identical.

export type WhenValue = {
  startAt: Date
  endsAt: Date
  timezone: string
  valid: boolean // false only when a Later start has already passed
}

function parseTime(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(':')
  return { hour: Number(h) || 0, minute: Number(m) || 0 }
}

export function WhenPicker({ onChange }: { onChange: (v: WhenValue) => void }) {
  const [mode, setMode] = useState<WhenMode>('now')
  const [durationKey, setDurationKey] = useState<string>(DEFAULT_DURATION_KEY)
  const [day, setDay] = useState<DayPick>('today')
  const [time, setTime] = useState('20:00')

  // Resolve on every input change and hand the parent the absolute instants + validity. onChange is
  // held in a ref so it isn't an effect dependency (a fresh closure each render must not re-fire it).
  const cb = useRef(onChange)
  useEffect(() => { cb.current = onChange }, [onChange])
  useEffect(() => {
    const now = new Date()
    const { hour, minute } = parseTime(time)
    const startPick = mode === 'later' ? { day, hour, minute } : null
    const { startAt, endsAt } = resolveWhen(mode, durationKey, startPick, now)
    const valid = mode === 'now' || startAt.getTime() > now.getTime()
    cb.current({ startAt, endsAt, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, valid })
  }, [mode, durationKey, day, time])

  // Live "is the picked Later time already past?" — recomputed each render (any interaction re-renders).
  let past = false
  if (mode === 'later') {
    const now = new Date()
    const { hour, minute } = parseTime(time)
    const { startAt } = resolveWhen('later', durationKey, { day, hour, minute }, now)
    past = startAt.getTime() <= now.getTime()
  }

  return (
    <div className="space-y-2.5">
      <div className="bp-overline mt-2 mb-1">When</div>
      <div className="bp-seg">
        <button type="button" onClick={() => setMode('now')}
          className={`bp-opt flex-1${mode === 'now' ? ' bp-opt--sel' : ''}`}>Now</button>
        <button type="button" onClick={() => setMode('later')}
          className={`bp-opt flex-1${mode === 'later' ? ' bp-opt--sel' : ''}`}>Later</button>
      </div>

      {mode === 'later' && (
        <div className="flex gap-2">
          <div className="bp-seg flex-1">
            <button type="button" onClick={() => setDay('today')}
              className={`bp-opt flex-1${day === 'today' ? ' bp-opt--sel' : ''}`}>Today</button>
            <button type="button" onClick={() => setDay('tomorrow')}
              className={`bp-opt flex-1${day === 'tomorrow' ? ' bp-opt--sel' : ''}`}>Tomorrow</button>
          </div>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
            aria-label="Start time" className="bp-field" style={{ width: 120 }} />
        </div>
      )}

      <div className="bp-overline mt-3 mb-1">{mode === 'now' ? 'Stays live for' : 'Runs for'}</div>
      <div className="bp-seg">
        {DURATION_PRESETS.map((d) => (
          <button key={d.key} type="button" onClick={() => setDurationKey(d.key)}
            className={`bp-opt flex-1${durationKey === d.key ? ' bp-opt--sel' : ''}`}>{d.label}</button>
        ))}
      </div>

      {past && (
        <p style={{ fontSize: 13, color: 'var(--ember-deep)' }}>
          That time’s already passed — pick a later time or Tomorrow.
        </p>
      )}
    </div>
  )
}
