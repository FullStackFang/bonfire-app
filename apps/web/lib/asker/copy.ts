import { nyParts, nyDayKey } from './time'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function hourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12}${hour < 12 ? 'am' : 'pm'}`
}

function daypart(hour: number): string {
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'night'
}

/** "Thursday night" | "tonight" | "today" */
export function whenLabel(at: Date, now: Date): string {
  const p = nyParts(at)
  if (nyDayKey(at) === nyDayKey(now)) return daypart(p.hour) === 'night' ? 'tonight' : 'today'
  return `${DAY_NAMES[p.dow]} ${daypart(p.hour)}`
}

/** "Thursday 7pm" | "tonight 7pm" | "today 12pm" */
export function whenShort(at: Date, now: Date): string {
  const p = nyParts(at)
  const day = nyDayKey(at) === nyDayKey(now)
    ? (daypart(p.hour) === 'night' ? 'tonight' : 'today')
    : DAY_NAMES[p.dow]
  return `${day} ${hourLabel(p.hour)}`
}

export function joinNames(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`
}

export const copy = {
  ask: (emoji: string, at: Date, now: Date, link: string) =>
    `${emoji} ${whenLabel(at, now)} — anyone? Nobody sees your answer till it's on. → ${link}`,
  strikeIn: (emoji: string, at: Date, now: Date, otherNames: string[], link: string) =>
    `It's ON: ${emoji} ${whenShort(at, now)} — ${joinNames(['you', ...otherNames])}. → ${link}`,
  strikeJoin: (emoji: string, at: Date, now: Date, inNames: string[], link: string) =>
    `It's ON: ${emoji} ${whenShort(at, now)}. ${joinNames(inNames)} ${inNames.length === 1 ? 'is' : 'are'} in — join? → ${link}`,
  hold: (emoji: string, at: Date, now: Date, link: string) =>
    `${whenShort(at, now)}: ${emoji} — still in? → ${link}`,
  t0Someone: (hereName: string, link: string) => `${hereName}'s already there. → ${link}`,
  t0Nobody: (emoji: string, at: Date, now: Date, link: string) =>
    `Starting now: ${emoji} ${whenShort(at, now)}. → ${link}`,
  fellThrough: () => "Tonight thinned out — happens. I'll ask again soon.",
  exitPoll: (link: string) => `Honest question: would last night have happened without this? → ${link}`,
  welcome: (circleName: string, link: string) => `You're in ${circleName}. Keep this link — it's yours: ${link}`,
  laterNudge: (emoji: string, at: Date, now: Date, link: string) =>
    `${emoji} ${whenShort(at, now)} is still open — in? → ${link}`,
}
