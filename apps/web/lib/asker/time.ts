import type { CadenceTemplate } from './types'

const NY = 'America/New_York'

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: NY,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
})

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export type NyParts = { year: number; month: number; day: number; hour: number; minute: number; dow: number }

export function nyParts(d: Date): NyParts {
  const p: Record<string, string> = {}
  for (const { type, value } of partsFmt.formatToParts(d)) p[type] = value
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour) % 24, minute: Number(p.minute), dow: DOW[p.weekday],
  }
}

/** UTC instant for a wall-clock time in NY. Offset-probe technique; exact except inside DST jumps. */
export function zonedNyToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const w = nyParts(new Date(guess))
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute)
  return new Date(guess - (wallAsUtc - guess))
}

export function nyDayKey(d: Date): string {
  const p = nyParts(d)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export function nyDayStartUtc(d: Date): Date {
  const p = nyParts(d)
  return zonedNyToUtc(p.year, p.month, p.day, 0, 0)
}

export function nyWeekStartUtc(d: Date): Date {
  const p = nyParts(d)
  const daysBackToMonday = (p.dow + 6) % 7
  const dayStart = zonedNyToUtc(p.year, p.month, p.day, 0, 0)
  return new Date(dayStart.getTime() - daysBackToMonday * 86_400_000)
}

export function isoWeek(d: Date): string {
  // ISO week of the NY calendar date
  const p = nyParts(d)
  const utcMidday = new Date(Date.UTC(p.year, p.month - 1, p.day, 12))
  const dayNum = (utcMidday.getUTCDay() + 6) % 7 // Mon=0
  utcMidday.setUTCDate(utcMidday.getUTCDate() - dayNum + 3) // nearest Thursday
  const isoYear = utcMidday.getUTCFullYear()
  const jan4 = new Date(Date.UTC(isoYear, 0, 4, 12))
  const jan4Day = (jan4.getUTCDay() + 6) % 7
  const week1Thu = new Date(jan4.getTime() + (3 - jan4Day) * 86_400_000)
  const week = 1 + Math.round((utcMidday.getTime() - week1Thu.getTime()) / (7 * 86_400_000))
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

export function slotKey(week: string, templateIndex: number): string {
  return `${week}-t${templateIndex}`
}

/** Next NY-time occurrence of (dow, hour:00) strictly after `now`. */
export function nextOccurrence(now: Date, dow: number, hour: number, minute = 0): Date {
  const p = nyParts(now)
  for (let i = 0; i < 8; i++) {
    // anchor at NY noon to dodge DST edges when stepping days
    const anchor = new Date(zonedNyToUtc(p.year, p.month, p.day, 12, 0).getTime() + i * 86_400_000)
    const ap = nyParts(anchor)
    if (ap.dow !== dow) continue
    const candidate = zonedNyToUtc(ap.year, ap.month, ap.day, hour, minute)
    if (candidate.getTime() > now.getTime()) return candidate
  }
  throw new Error('nextOccurrence: no slot found in 8 days')
}

/** True when `now` falls in [askHour:00, askHour+2:00) NY on askDow. Tick cadence is 15 min and the
 *  scheduler (GitHub Actions) can delay ticks past the hour; the two-hour window plus the
 *  cadence_slot unique key (re-fires are no-ops) means jitter can never silently skip a week. */
export function matchesAskWindow(t: CadenceTemplate, now: Date): boolean {
  const p = nyParts(now)
  return p.dow === t.askDow && p.hour >= t.askHour && p.hour < t.askHour + 2
}
