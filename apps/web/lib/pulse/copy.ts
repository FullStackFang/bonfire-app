import type { BoardStatus, PulseStatus } from './types'

// Single source for display text. The enums are fixed in the DB; these labels are cheap to change.

export const BOARD_STATUS_LABEL: Record<BoardStatus, string> = {
  around: 'around',
  busy: 'busy',
  away: 'away',
  out: 'out',
}

export const PULSE_STATUS_LABEL: Record<PulseStatus, string> = {
  in: "in",
  on_my_way: 'on my way',
  here: 'here',
  out: 'out',
}

// TTL presets. `kind` tells the client how to resolve an absolute `expiresAt` from the
// creator's LOCAL wall clock (see lib/pulse/time.ts resolveExpiry) — never computed in server UTC.
export type TtlPreset = {
  key: string
  label: string
  kind: 'duration' | 'eod'
  hours?: number // for kind 'duration'
  dayOffset?: number // for kind 'eod' (0 = today, 1 = tomorrow)
}

export const TTL_PRESETS: readonly TtlPreset[] = [
  { key: '3h', label: 'next 3 hrs', kind: 'duration', hours: 3 },
  { key: '6h', label: 'next 6 hrs', kind: 'duration', hours: 6 },
  { key: 'eod', label: 'end of today', kind: 'eod', dayOffset: 0 },
  { key: 'tomorrow', label: 'end of tomorrow', kind: 'eod', dayOffset: 1 },
]

export const DEFAULT_TTL_PRESET = TTL_PRESETS[0]

// Text length caps (chars). Enforced at the API layer (slice) AND the DB (CHECK).
export const CAPS = {
  displayName: 40,
  crewName: 60,
  pulseTitle: 60,
  pulsePlace: 60,
  pulseTimeLabel: 30,
  note: 80,
  availabilityLabel: 40,
} as const

// Open Graph / unfurl copy. EVERGREEN only — never a live count or roster. Built solely from
// creator-set fields (a participant note must never reach a card that unfurls in other chats).
export const BRAND = 'Bonfire'

export const ogCopy = {
  crewTitle: (name: string) => name,
  crewDescription: () => "Tap to see who's around.",
  pulseTitle: (title: string) => title,
  pulseDescription: (place: string, timeLabel: string) => `${place} · ${timeLabel}`,
}

// Prewritten chat-drop message for a pulse (the free delivery path — paste into any chat).
// Also the SMS body for "Text the crew". Creator-set fields only.
export const pulseMessage = (title: string, place: string, timeLabel: string, url: string) =>
  `🔥 ${title} — ${place} · ${timeLabel}. Tap in: ${url}`

// Dashboard (/p) strings. Content rules: statements not questions where possible, EARLIER is
// quiet history (never a flake record, no "missed"), and nobody is guilted into anything.
export const dashCopy = {
  title: 'Your bonfire',
  liveOverline: 'Live now',
  crewsOverline: 'Your crews',
  earlierOverline: 'Earlier',
  droppedByYou: 'dropped by you',
  liveEmpty: 'Nothing live right now.',
  crewsEmpty: 'No crews yet — they form where people keep showing up.',
  emptyTitle: 'Nothing here yet',
  emptyBlurb: 'Start a board or drop a pulse, share the link in your chat, and it all shows up here.',
  startCta: 'Start something',
  recoveryPrompt: 'Been here before?',
  recoveryCta: 'Get your stuff back',
  recoveryBlurb: 'Verify your number and your crews and pulses follow you to this device. Never shown to anyone.',
}

// Afterglow + ember strings (close-plan-loop): the post-event view of /p/plan/[token] and the
// "again" tap. House voice: statements not questions in outcomes — the one sanctioned question
// is the button itself (SYSTEM-THESIS §iv). No guilt, no roster, never a word about who didn't tap.
const listNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? 'someone')
  : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

export const emberCopy = {
  overline: 'that happened',
  blurb: 'Hope it was a good one.',
  tapCta: 'do this again?',
  soloLine: 'You’re in for another one.',
  soloBlurb: 'If someone else is in too, you’ll both see it here.',
  mutualLine: (names: string[]) => `${listNames(names)} ${names.length === 1 ? 'is' : 'are'} in too.`,
  nextCta: 'Start the next one',
  untapCta: 'never mind',
  // Dash presences (opener's plans). Expired stays quiet history — no "missed", no blame.
  plansOverline: 'Your plans',
  planStateLine: {
    proposing: 'not shared yet',
    open: 'gathering availability',
    expired: 'closed',
  } as const,
  planStruck: (label: string | null) => (label ? `it’s on — ${label}` : 'it’s on'),
  planCompleted: 'that happened',
  planEmberLine: (names: string[]) => `${listNames(names)} ${names.length === 1 ? 'is' : 'are'} in for another one`,
}

// Navbar destinations. Plain words only — never the internal terms "pulse"/"crew". The bar is
// icon-only, so these ride the aria-labels; the list pages reuse them as their titles. Empty
// states teach the next action rather than announcing emptiness.
export const navCopy = {
  home: 'Home',
  events: 'Events',
  groups: 'Groups',
  login: 'Log in',
  account: 'Account',
  eventsTitle: 'Events',
  groupsTitle: 'Groups',
  eventsEmptyTitle: 'No events yet',
  eventsEmptyBlurb: 'Drop a pulse to gather people now — it shows up here and in whatever chat you share it to.',
  groupsEmptyTitle: 'No groups yet',
  groupsEmptyBlurb: 'Groups form where the same people keep showing up. Start a board, share the link, and one begins.',
  startCta: 'Start something',
}

// Sign-in (/p/login) and account (/p/account) strings. Sign-in and sign-up are one flow —
// the heading says both so nobody has to know which they are. Phones are always masked.
export const authCopy = {
  signInHeading: 'Sign in or sign up',
  signInBlurb: "We'll text you a 6-digit code. Never shown to anyone.",
  phonePlaceholder: '(555) 010-2030',
  sendCodeCta: 'Text me a code',
  consentLine: 'By tapping "Text me a code" you agree to receive a one-time verification text. Msg & data rates may apply.',
  sentTo: (displayPhone: string) => `We sent ${displayPhone} a code via SMS.`,
  codeLabel: 'Verification Code',
  codePlaceholder: '6-digit code',
  confirmCta: 'Verify',
  resendCountdown: (seconds: number) => `Didn't receive your code? Resend it in ${seconds}s`,
  resendCta: "Didn't receive your code? Resend it",
  differentNumberCta: 'Use a different number',
  nameHeading: "What's your name?",
  namePlaceholder: 'Your name',
  nameCta: 'Continue',
  accountTitle: 'Account',
  phoneLabel: 'Phone',
  signOutCta: 'Sign out',
  signOutBlurb: 'Signs this device out. Your crews and availability stay with your number — sign back in anytime.',
}
