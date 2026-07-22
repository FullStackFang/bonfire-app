import { DURATION_PRESETS, DEFAULT_DURATION_KEY, type DurationPreset } from './copy'

// A pulse is LIVE iff it is unwrapped and before its expiry. Expired/wrapped pulses simply
// drop out of every active list (no GC cron needed for correctness, given the partial index).
// Note: `isLive` does NOT gate on start_at — an upcoming pulse (not yet started) is still "not over"
// and stays shareable/response-collecting. The upcoming/live split is `pulsePhase` (lib/pulse/types).
export function isLive(pulse: { closedAt: Date | null; expiresAt: Date }, now: Date): boolean {
  return pulse.closedAt == null && pulse.expiresAt.getTime() > now.getTime()
}

export type WhenMode = 'now' | 'later'
export type DayPick = 'today' | 'tomorrow'
export type StartPick = { day: DayPick; hour: number; minute: number }

// End of d's LOCAL day (23:59:59.999), clamped to never be at/before `d`. This is the `til late`
// end instant and the old resolveExpiry 'eod' clamp, relocated here.
function endOfLocalDay(d: Date): Date {
  const e = new Date(d)
  e.setHours(23, 59, 59, 999)
  return e.getTime() > d.getTime() ? e : new Date(d.getTime() + 3_600_000)
}

// Resolve the two-mode "When" control to an absolute { startAt, endsAt } pair in the creator's
// LOCAL wall clock. This MUST run client-side (the browser's resolved timezone is the creator's) so
// that "til late" means the creator's day, not server UTC.
//   Now:   start = now;                 end = start + duration (or end of start's local day)
//   Later: start = picked day + time;   end = start + duration (or end of start's local day)
export function resolveWhen(
  mode: WhenMode, durationKey: string, startPick: StartPick | null, now: Date,
): { startAt: Date; endsAt: Date } {
  const preset: DurationPreset =
    DURATION_PRESETS.find((p) => p.key === durationKey) ??
    DURATION_PRESETS.find((p) => p.key === DEFAULT_DURATION_KEY)!
  let startAt: Date
  if (mode === 'now' || !startPick) {
    startAt = new Date(now)
  } else {
    startAt = new Date(now)
    if (startPick.day === 'tomorrow') startAt.setDate(startAt.getDate() + 1)
    startAt.setHours(startPick.hour, startPick.minute, 0, 0)
  }
  const endsAt = preset.kind === 'til_late'
    ? endOfLocalDay(startAt)
    : new Date(startAt.getTime() + (preset.hours ?? 2) * 3_600_000)
  // Clamp: end must be strictly after start (the presets can't produce ≤0, but stay safe).
  return { startAt, endsAt: endsAt.getTime() > startAt.getTime() ? endsAt : new Date(startAt.getTime() + 3_600_000) }
}

// ── timezone-aware formatting helpers for the derived label (server derives it in the creator's tz) ──
const YMD = new Map<string, Intl.DateTimeFormat>()
function ymdFmt(tz: string): Intl.DateTimeFormat {
  let f = YMD.get(tz)
  if (!f) { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }); YMD.set(tz, f) }
  return f
}
// 'YYYY-MM-DD' for d in tz — the local calendar day, for same-day / tomorrow comparisons.
function zymd(d: Date, tz: string): string {
  return ymdFmt(tz).format(d)
}
// { h: 0-23, m: 0-59 } for d in tz.
function zhm(d: Date, tz: string): { h: number; m: number } {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d)
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? '0')
  return { h: g('hour') % 24, m: g('minute') }
}
// Short clock label for d in tz: "9pm" (drops :00) or "8:30pm".
function zclock(d: Date, tz: string): string {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(d)
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  const h = g('hour'); const m = g('minute'); const ap = g('dayPeriod').toLowerCase()
  return m === '00' ? `${h}${ap}` : `${h}:${m}${ap}`
}

// Derive the human "when" display snapshot from the two instants, in the creator's timezone. Written
// once at creation and read unchanged by every downstream surface (dashboard, OG unfurl) so machine
// time and displayed time can never diverge. Examples: "Now · ~2h", "Tonight 8:30pm · ~2h",
// "Tomorrow 9pm · til late". `now` fixes the "Now" / day framing at creation time.
export function deriveWhenLabel(startAt: Date, endsAt: Date, timezone: string, now: Date = new Date()): string {
  const tz = timezone || 'UTC'
  // Duration part. `til late` is exactly the end-of-local-day instant (23:59); anything else is ~Nh.
  const end = zhm(endsAt, tz)
  const dur = (end.h === 23 && end.m === 59)
    ? 'til late'
    : `~${Math.max(1, Math.round((endsAt.getTime() - startAt.getTime()) / 3_600_000))}h`
  // Start part. A start at/just-before `now` is a Now pulse; otherwise frame by local day.
  let start: string
  if (startAt.getTime() <= now.getTime() + 60_000) {
    start = 'Now'
  } else {
    const clock = zclock(startAt, tz)
    const sameDay = zymd(startAt, tz) === zymd(now, tz)
    if (sameDay) start = zhm(startAt, tz).h >= 17 ? `Tonight ${clock}` : `Today ${clock}`
    else start = `Tomorrow ${clock}` // horizon is capped at end of tomorrow
  }
  return `${start} · ${dur}`
}

// "8:30pm" — short absolute clock label for an already-resolved instant, in the viewer's local tz.
const clockFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

export function expiresClock(expiresAt: Date): string {
  return clockFmt.format(expiresAt).toLowerCase().replace(' ', '')
}

// ── live-state labels (computed fresh from the instants vs `now`, never from the stored snapshot) ──

// Upcoming: how long until a not-yet-started pulse begins. "starts in 20 min" under an hour, else
// the wall-clock start "starts at 8:30pm" (viewer's local tz).
export function startsLabel(startAt: Date, now: Date): string {
  const ms = startAt.getTime() - now.getTime()
  if (ms <= 0) return 'starting now'
  const min = Math.round(ms / 60_000)
  return min < 60 ? `starts in ${min} min` : `starts at ${expiresClock(startAt)}`
}

// Live: how much of a running pulse is left. "for another 45 min" under an hour, else "for another
// 2 hrs". Coarser than the ticking hero clock on purpose — a calm at-a-glance read.
export function remainingLabel(endsAt: Date, now: Date): string {
  const ms = endsAt.getTime() - now.getTime()
  if (ms <= 0) return 'ended'
  const min = Math.round(ms / 60_000)
  if (min < 60) return `for another ${min} min`
  const hrs = Math.round(min / 60)
  return `for another ${hrs} hr${hrs === 1 ? '' : 's'}`
}
