import { builtScreensHtml } from './built-screens.content'

// The review registry — a growable list of visual review artifacts. Adding a review is one entry
// here plus its self-contained HTML. Each `html` is rendered verbatim in an isolated iframe.
export type Review = {
  slug: string
  title: string
  description: string
  dateISO: string
  html: string
}

export const REVIEWS: Review[] = [
  {
    slug: 'built-screens',
    title: 'Built screens — M1 / M3 / D2',
    description:
      'Faithful static renders of the shipped UI for the BUILT insights: the “Again?” tap (again-engine), deliberation caps (plan-coordination), and repetition mechanics (relationship-intelligence, who-is-around).',
    dateISO: '2026-07-17',
    html: builtScreensHtml,
  },
]

export function reviewBySlug(slug: string): Review | undefined {
  return REVIEWS.find((r) => r.slug === slug)
}
