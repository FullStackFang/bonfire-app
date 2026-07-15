import type { TtlPreset } from './copy'

// A pulse is LIVE iff it is unwrapped and before its expiry. Expired/wrapped pulses simply
// drop out of every active list (no GC cron needed for correctness, given the partial index).
export function isLive(pulse: { closedAt: Date | null; expiresAt: Date }, now: Date): boolean {
  return pulse.closedAt == null && pulse.expiresAt.getTime() > now.getTime()
}

// Resolve a TTL preset to an absolute instant from the creator's LOCAL wall clock. This MUST
// run client-side (the browser's resolved timezone is the creator's timezone) so that "end of
// day" means the creator's day — not server UTC, which would expire mid-evening for a US user.
export function resolveExpiry(preset: TtlPreset, now: Date): Date {
  if (preset.kind === 'duration') {
    const hours = preset.hours ?? 3
    return new Date(now.getTime() + hours * 3_600_000)
  }
  // 'eod' — end of (today + dayOffset) at 23:59:59 in the creator's local time.
  const d = new Date(now)
  d.setDate(d.getDate() + (preset.dayOffset ?? 0))
  d.setHours(23, 59, 59, 999)
  // Never return a past instant (e.g. "end of today" at 23:59:59.5).
  return d.getTime() > now.getTime() ? d : new Date(now.getTime() + 3_600_000)
}

// "8:30pm" — short absolute clock label for an already-resolved expiry, in the viewer's tz.
const clockFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

export function expiresClock(expiresAt: Date): string {
  return clockFmt.format(expiresAt).toLowerCase().replace(' ', '')
}
