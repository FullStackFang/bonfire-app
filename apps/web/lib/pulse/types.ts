// Domain row types (camelCase — postgres.camel transforms snake_case columns) and the
// public serialize shapes. The serialize* shapes are the ONLY thing sent to the client;
// internal columns (created_by, tokens of others, version) never leak — mirroring the
// asker's serialize discipline.

export type BoardStatus = 'around' | 'busy' | 'away' | 'out'
export type PulseStatus = 'in' | 'on_my_way' | 'here' | 'out'

export const BOARD_STATUSES: readonly BoardStatus[] = ['around', 'busy', 'away', 'out']
export const PULSE_STATUSES: readonly PulseStatus[] = ['in', 'on_my_way', 'here', 'out']

export type Participant = {
  id: string
  token: string
  displayName: string | null
  phone: string | null // E.164; tier-1 (verified) identity only — NEVER serialized to other viewers
  phoneVerifiedAt: Date | null
  createdAt: Date
}

export type PhoneVerification = {
  id: string
  phone: string
  codeHash: string
  expiresAt: Date
  attempts: number
  consumedAt: Date | null
  createdAt: Date
}

export type Crew = {
  id: string
  token: string
  name: string
  version: string // bigint — opaque monotonic ETag value
  createdBy: string
  createdAt: Date
  archivedAt: Date | null
}

export type Pulse = {
  id: string
  token: string
  crewId: string | null
  title: string
  place: string
  timeLabel: string
  expiresAt: Date
  closedAt: Date | null
  version: string // bigint — opaque monotonic ETag value
  createdBy: string
  clientUuid: string
  createdAt: Date
}

export type Presence = {
  crewId: string
  participantId: string
  status: BoardStatus
  note: string | null
  updatedAt: Date
}

export type PulseResponse = {
  pulseId: string
  participantId: string
  status: PulseStatus
  etaMinutes: number | null
  note: string | null
  updatedAt: Date
}

export type AvailabilityBaseline = {
  id: string
  participantId: string
  daysOfWeek: number[] // 0=Sunday..6=Saturday
  startTime: string // 'HH:MM:SS' local wall clock in `timezone`
  endTime: string
  timezone: string // IANA, captured from the browser at creation
  label: string | null
  createdAt: Date
}

export type AvailabilityException = {
  id: string
  participantId: string
  state: 'free' | 'busy'
  startsAt: Date
  endsAt: Date
  allDay: boolean
  label: string | null
  createdAt: Date
}

// Enriched read rows (joined with the participant's display name).
export type PresenceRow = Presence & { displayName: string | null }
export type PulseResponseRow = PulseResponse & { displayName: string | null }

// ---- public (client-facing) shapes ----

// `verified` is the viewer's OWN tier only (drives the inline verify step) — never another
// participant's. No phone number ever appears in any public shape.
export type PublicViewer = { participantId: string; displayName: string | null; verified: boolean } | null

export type PublicPresence = {
  participantId: string
  displayName: string
  status: BoardStatus
  note: string | null
  me: boolean
}

export type PublicPulseListItem = {
  token: string
  title: string
  place: string
  timeLabel: string
  expiresAt: string
}

// Roster rows carry display names ONLY — never phones (spec: phone-identity).
export type PublicCrewMember = {
  participantId: string
  displayName: string
  me: boolean
}

export type PublicBoard = {
  token: string
  name: string
  presence: PublicPresence[]
  pulses: PublicPulseListItem[]
  members: PublicCrewMember[]
  viewer: PublicViewer
}

export type PublicPulseResponse = {
  participantId: string
  displayName: string
  status: PulseStatus
  etaMinutes: number | null
  note: string | null
  me: boolean
}

export type PublicPulse = {
  token: string
  title: string
  place: string
  timeLabel: string
  expiresAt: string
  live: boolean
  closedAt: string | null
  crewToken: string | null
  crewName: string | null
  participants: PublicPulseResponse[]
  madeItCount: number
  viewer: PublicViewer
}

// Dash shapes carry ONLY the viewer's own participation (my status, my note) — never another
// participant's id, response, or roster row (spec: pulse-dashboard privacy bound).
export type PublicDashPulse = {
  token: string
  title: string
  place: string
  timeLabel: string
  expiresAt: string
  crewName: string | null
  myStatus: PulseStatus | null
  droppedByMe: boolean
}

export type PublicDashCrew = {
  token: string
  name: string
  myStatus: BoardStatus | null
  myNote: string | null
}

export type PublicDash = {
  live: PublicDashPulse[]
  crews: PublicDashCrew[]
  earlier: PublicDashPulse[]
  viewer: PublicViewer
}

// ---- plan coordination (growth-story Phase 1) ----

export type PlanState = 'proposing' | 'open' | 'struck' | 'expired'
export type PlanOptionKind = 'time' | 'place' | 'time_place'

// A small venue blob carried on place/time_place options.
export type PlanVenue = { name: string; area?: string | null }

export type Plan = {
  id: string
  token: string
  creatorParticipantId: string
  intentText: string
  context: unknown | null
  state: PlanState
  confirmThreshold: number
  struckOptionId: string | null
  version: string // bigint — opaque monotonic ETag value
  createdAt: Date
  closesAt: Date | null
}

export type PlanOption = {
  id: string
  planId: string
  kind: PlanOptionKind
  startsAt: Date | null
  venue: PlanVenue | null
  label: string
  aiRank: number
  aiRationale: string | null
  source: 'ai' | 'opener'
  createdAt: Date
}

export type PlanPick = {
  id: string
  planId: string
  optionId: string
  participantId: string
  createdAt: Date
}

// ---- public (client-facing) plan shapes ----

// An option as shown on the link view: availability framing (availableCount + `mine`),
// never RSVP. No participant ids or names of who marked it — absence is never surfaced.
export type PublicPlanOption = {
  id: string
  kind: PlanOptionKind
  label: string
  startsAt: string | null
  venue: PlanVenue | null
  aiRationale: string | null
  availableCount: number
  mine: boolean // did the viewer mark availability for this option
  won: boolean // is this the struck (winning) option
}

export type PublicPlan = {
  token: string
  intentText: string
  creatorName: string | null
  state: PlanState
  options: PublicPlanOption[]
  struck: boolean
  winner: PublicPlanOption | null
  viewer: PublicViewer
}

// ---- network discovery ("who's around", growth-story Phase 2) ----

export type AroundWindow = 'now' | 'tonight' | 'this_week'
export const AROUND_WINDOWS: readonly AroundWindow[] = ['now', 'tonight', 'this_week']

// Coarse, self-reported presence — no device location ever. One signal per participant.
export type Around = {
  participantId: string
  locale: string | null
  aroundWindow: AroundWindow
  aroundUntil: Date
  updatedAt: Date
}

// A person on the discovery roster: name + a COARSE signal + optional self-typed locale.
// Never a distance, never coordinates, never absence.
export type PublicPersonAround = {
  participantId: string
  displayName: string
  locale: string | null
  label: string // "around now" / "around tonight" / "around this week"
  me: boolean
}

// The discovery surface: the viewer's own around signal (if any) + their people who are around.
export type PublicAround = {
  mine: { aroundWindow: AroundWindow; locale: string | null } | null
  people: PublicPersonAround[]
  viewer: PublicViewer
}

// ---- relationship intelligence ("reconnect", growth-story Phase 3) ----

export type ReconnectPrefs = {
  participantId: string
  enabled: boolean
  lastShownAt: Date | null
  muted: string[]
  updatedAt: Date
}

// A crew-mate you haven't gotten together with recently. daysSince is null when you've shared a crew
// but never co-attended a struck plan ("haven't gotten together yet"). Never sourced from contacts.
export type PublicReconnectSuggestion = {
  participantId: string
  displayName: string
  daysSince: number | null
}

export type PublicReconnect = {
  enabled: boolean
  suggestion: PublicReconnectSuggestion | null
}
