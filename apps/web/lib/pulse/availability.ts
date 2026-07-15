// The coarse availability engine. Pure — no I/O, no date library; the repo layer fetches rows
// and maps over members/windows. Ports to Expo unchanged.
//
// Resolution order (spec: availability):
//   1. calendar busy-blocks when a calendar source exists (high confidence — stub in v1)
//   2. overlapping exceptions (latest correction wins): busy → busy+label; free → free at LOW
//   3. baseline overlap in the baseline's stored timezone → busy+label
//   4. baselines declared but none overlap → probably_free at LOW
//   5. nothing declared → unknown (never blocks, never reads as a "no")

export type AvailabilityState = 'free' | 'probably_free' | 'busy' | 'unknown'
export type Confidence = 'high' | 'low'

export type ResolvedAvailability = {
  availability: AvailabilityState
  confidence: Confidence
  label?: string
}

export type BaselineInput = {
  daysOfWeek: number[] // 0=Sunday..6=Saturday, in `timezone`
  startTime: string // 'HH:MM' local wall clock in `timezone`
  endTime: string // 'HH:MM'; <= startTime means the window crosses midnight
  timezone: string // IANA, captured from the browser at creation
  label: string | null
}

export type ExceptionInput = {
  state: 'free' | 'busy'
  startsAt: Date
  endsAt: Date
  label: string | null
  createdAt?: Date // latest correction wins when several overlap
}

export type CalendarBlock = { startsAt: Date; endsAt: Date; label?: string }

export type AvailabilityWindow = { startsAt: Date; endsAt: Date }

export type ResolveInput = {
  baselines: BaselineInput[]
  exceptions: ExceptionInput[]
  calendarBlocks: CalendarBlock[] // always [] in v1 — the branch exists, the data never does
  window: AvailabilityWindow
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd

// ---- timezone math via Intl part extraction (no date library) ----

const partFormatters = new Map<string, Intl.DateTimeFormat>()
function formatterFor(timezone: string): Intl.DateTimeFormat {
  let f = partFormatters.get(timezone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
    partFormatters.set(timezone, f)
  }
  return f
}

type WallParts = { y: number; m: number; d: number; hh: number; mm: number }

function wallPartsIn(timezone: string, at: Date): WallParts {
  const parts = formatterFor(timezone).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { y: get('year'), m: get('month'), d: get('day'), hh: get('hour') % 24, mm: get('minute') }
}

/** The absolute instant of a local wall time in a timezone. Iterative offset correction —
 *  exact away from DST transitions; lands on a consistent side across them. */
function instantOfWallTime(timezone: string, y: number, m: number, d: number, hh: number, mm: number): number {
  const target = Date.UTC(y, m - 1, d, hh, mm)
  let t = target
  for (let i = 0; i < 2; i++) {
    const w = wallPartsIn(timezone, new Date(t))
    const rendered = Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm)
    t += target - rendered
  }
  return t
}

const dowOf = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay()

function parseHhMm(s: string): { hh: number; mm: number } {
  const [hh = '0', mm = '0'] = s.split(':')
  return { hh: Number(hh), mm: Number(mm) }
}

/** Does a recurring baseline window overlap the absolute window? Enumerates the calendar dates
 *  (in the baseline's timezone) the window ± 1 day touches and tests each occurrence. */
function baselineOverlaps(b: BaselineInput, window: AvailabilityWindow): boolean {
  const start = parseHhMm(b.startTime)
  const end = parseHhMm(b.endTime)
  const crossesMidnight =
    end.hh < start.hh || (end.hh === start.hh && end.mm <= start.mm)

  const seen = new Set<string>()
  const DAY = 86_400_000
  for (let t = window.startsAt.getTime() - DAY; t <= window.endsAt.getTime() + DAY; t += DAY) {
    const w = wallPartsIn(b.timezone, new Date(t))
    const key = `${w.y}-${w.m}-${w.d}`
    if (seen.has(key)) continue
    seen.add(key)
    if (!b.daysOfWeek.includes(dowOf(w.y, w.m, w.d))) continue

    const occStart = instantOfWallTime(b.timezone, w.y, w.m, w.d, start.hh, start.mm)
    const occEnd = crossesMidnight
      ? instantOfWallTime(b.timezone, w.y, w.m, w.d + 1, end.hh, end.mm) // Date.UTC rolls the date over
      : instantOfWallTime(b.timezone, w.y, w.m, w.d, end.hh, end.mm)
    if (overlaps(occStart, occEnd, window.startsAt.getTime(), window.endsAt.getTime())) return true
  }
  return false
}

export function resolveAvailability(input: ResolveInput): ResolvedAvailability {
  const { baselines, exceptions, calendarBlocks, window } = input
  const ws = window.startsAt.getTime()
  const we = window.endsAt.getTime()

  // 1. Calendar (stub in v1: calendarBlocks is always empty, so this always falls through).
  const block = calendarBlocks.find((c) => overlaps(c.startsAt.getTime(), c.endsAt.getTime(), ws, we))
  if (block) return { availability: 'busy', confidence: 'high', ...(block.label ? { label: block.label } : {}) }

  // 2. Exceptions — the latest overlapping correction wins.
  const hit = exceptions
    .filter((e) => overlaps(e.startsAt.getTime(), e.endsAt.getTime(), ws, we))
    .reduce<ExceptionInput | null>((best, e) => {
      if (!best) return e
      const a = best.createdAt?.getTime() ?? 0
      const b = e.createdAt?.getTime() ?? 0
      return b >= a ? e : best
    }, null)
  if (hit) {
    return hit.state === 'busy'
      ? { availability: 'busy', confidence: 'high', ...(hit.label ? { label: hit.label } : {}) }
      : { availability: 'free', confidence: 'low', ...(hit.label ? { label: hit.label } : {}) }
  }

  // 3–4. Baseline.
  const busyBaseline = baselines.find((b) => baselineOverlaps(b, window))
  if (busyBaseline) {
    return { availability: 'busy', confidence: 'high', ...(busyBaseline.label ? { label: busyBaseline.label } : {}) }
  }
  if (baselines.length > 0) return { availability: 'probably_free', confidence: 'low' }

  // 5. Nothing declared.
  return { availability: 'unknown', confidence: 'low' }
}
