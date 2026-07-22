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

// Duration presets. `kind` tells the client how to resolve the pulse's END instant from its START
// (see lib/pulse/time.ts resolveWhen): 'duration' adds fixed hours; 'til_late' runs to the end of
// the start's LOCAL day — never server UTC. Replaces the former "stays live for" TTL segment.
export type DurationPreset = {
  key: string
  label: string
  kind: 'duration' | 'til_late'
  hours?: number // for kind 'duration'
}

export const DURATION_PRESETS: readonly DurationPreset[] = [
  { key: '1h', label: '1h', kind: 'duration', hours: 1 },
  { key: '2h', label: '2h', kind: 'duration', hours: 2 },
  { key: 'late', label: 'til late', kind: 'til_late' },
]

export const DEFAULT_DURATION_KEY = '2h'

// Text length caps (chars). Enforced at the API layer (slice) AND the DB (CHECK).
export const CAPS = {
  displayName: 40,
  crewName: 60,
  pulseTitle: 60,
  pulsePlace: 60,
  pulseTimeLabel: 30,
  note: 80,
  availabilityLabel: 40,
  podLabel: 40,
} as const

// ---- restaurant pods (add-restaurant-pods) ----

// "Pod" is a PROVISIONAL noun — every user-visible instance renders through this constant so a
// product rename (circle / camp / wave / …) is a one-line change. DB object names keep `pod`.
// House rules: no "RSVP" anywhere, no "crew" in pod defaults, statements not questions.
export const POD_NOUN = 'pod'

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const podCopy = {
  sectionTitle: `${capitalize(POD_NOUN)}s`,
  openCta: `open a ${POD_NOUN}`,
  kindLabel: { car: 'car', walk: 'walking', meetup: 'meet-up', other: 'group' } as const,
  labelPlaceholder: `name your ${POD_NOUN}`,
  seatsLabel: 'seats',
  seatsUncapped: 'no cap',
  joinCta: 'hop in',
  leaveCta: 'hop out',
  fullChip: 'full',
  // Shown to the mover only — joining while in another pod silently moves you (one pod at a time).
  movedLine: (label: string) => `moved to ${label}`,
  editCta: 'edit',
  deleteCta: 'disband',
  memberCount: (n: number) => `~${n} ${n === 1 ? 'person' : 'people'}`,
  // Day-of grouping, derived read-time from members' existing statuses (never stored).
  rollingLine: (etaMinutes: number, n: number) =>
    `${etaMinutes} min out · ~${n} ${n === 1 ? 'person' : 'people'}`,
  hereLine: (n: number) => `${n} here now`,
}

// Headcount meter + count snapshot + table-called. Over-cap is a passive line — never a block,
// waitlist, or send. The snapshot locks the NUMBER, not the door.
export const headcountCopy = {
  meterLine: (people: number, guests: number) =>
    guests > 0 ? `${people} in · +${guests} ${guests === 1 ? 'guest' : 'guests'}` : `${people} in`,
  seatsLine: (headcount: number, cap: number) => `${headcount} of ${cap} seats`,
  overflowLine: (over: number) =>
    `${over} over the table — someone should call the restaurant.`,
  lockedChip: (n: number) => `Headcount locked · ${n}`,
  afterCountChip: 'after the count',
  afterCountLine: (n: number) => `+${n} after the count`,
  countNeededBy: (label: string) => `count needed by ${label}`,
  tableCalledCta: 'table called',
  tableCalledDone: 'table called ✓',
  partyPrompt: 'anyone with you?',
  partyChips: ['Just me', '+1', '+2', '+3'] as const,
}

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

// Afterglow zone two (add-intent-layer): tappable co-attendee faces — the person half of recurrence.
// Warm and skippable, never a checklist. No counters, no progress, no "you haven't tapped anyone"
// state; a face never says whether the other person tapped (one-sided is invisible), only "you both"
// once it's mutual. The reassurance line is doing real work — it tells the tapper nothing is exposed.
export const personIntentCopy = {
  heading: 'See anyone again?',
  blurb: 'Tap someone you’d want to see again. They only find out if they tap you back.',
  mutualBadge: 'you both',
  tapLabel: (name: string) => `See ${name} again`,
  untapLabel: (name: string) => `Never mind ${name}`,
}

// Intent-resolver candidates on the dashboard (add-intent-layer). Warm, never a checklist. Rule 3
// (campfire-knowledge): the card shows only what the viewer co-owns — the mutual signal, the people,
// the shared activity — plus a system-chosen time. NEVER the age of an intent, never "X is free
// Thursday", never any availability state attributed to a person. The window is offered as a default
// ("how about…"), felt as good timing — not read as a fact about anyone.
export const candidateCopy = {
  overline: 'Worth another',
  line: (people: string[], activity: string | null): string => {
    const who = listNames(people)
    return activity
      ? `You and ${who} both wanted another — ${activity}.`
      : `You and ${who} both want to see each other again.`
  },
  windowHint: (label: string) => `How about ${label}?`,
  planCta: 'Plan it',
  dismissCta: 'Not now',
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
  // Partiful-style "save" nudges after an anonymous create/join. Statements, no guilt, no flame —
  // an offer to keep the thing you just made, never a wall in front of it.
  savePulseHeading: 'Save your pulse',
  savePulseBlurb: 'Add your number and this pulse follows you to any device.',
  savePrivacyLine: 'Your number is only used to verify you and for event updates — never shown to anyone.',
  saveSpotLine: 'Save your spot — add your number so this follows you.',
  saveSkipCta: 'or just grab the link',
  savedAck: 'Saved. This pulse is yours on any device you verify this number.',
}
