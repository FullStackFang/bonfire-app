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
