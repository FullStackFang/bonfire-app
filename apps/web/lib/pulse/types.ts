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

// Geocode confidence for a pulse's free-text place. Only `resolved` renders a map; `low_confidence`
// keeps a coordinate but is non-mappable; `unresolved` has null coordinates. Mirrors lib/pulse/geo.
export type PlaceGeoStatus = 'resolved' | 'low_confidence' | 'unresolved'

export type Pulse = {
  id: string
  token: string
  crewId: string | null
  title: string
  place: string
  timeLabel: string // machine-derived display snapshot (deriveWhenLabel); legacy rows keep free text
  startAt: Date // absolute start instant (coalesces to createdAt for legacy rows)
  expiresAt: Date // absolute END instant — the pulse auto-wraps here (reused as the end column)
  timezone: string | null // creator's IANA tz, captured at creation
  closedAt: Date | null
  version: string // bigint — opaque monotonic ETag value
  createdBy: string
  clientUuid: string
  createdAt: Date
  placeLat: number | null
  placeLng: number | null
  placeGeoStatus: PlaceGeoStatus
  // Venue facts (add-restaurant-pods): facts about the venue, never a gate on people. All three
  // null = exactly the pulse before this capability. Creation-time only in v1.
  seatsCap: number | null
  countNeededBy: Date | null
  tableCalledAt: Date | null
}

// A pulse's lifecycle phase for a given `now`: upcoming (before start), live (within the window),
// or over (past end or wrapped). `isLive` (lib/pulse/time.ts) is exactly `phase === 'live'`. The
// pulse auto-wraps into `over` at `expiresAt` with no cron — it just falls out of every live list.
export type PulsePhase = 'upcoming' | 'live' | 'over'

export function pulsePhase(
  pulse: { startAt: Date; expiresAt: Date; closedAt: Date | null }, now: Date,
): PulsePhase {
  if (pulse.closedAt != null || now.getTime() >= pulse.expiresAt.getTime()) return 'over'
  if (now.getTime() < pulse.startAt.getTime()) return 'upcoming'
  return 'live'
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
  // Guests riding on this response (0–3). Counts, never identities — no roster row, status, or
  // name exists for a guest. Only counts while status ≠ 'out'.
  partySize: number
  updatedAt: Date
}

// ---- pods (add-restaurant-pods; "pod" is a provisional product noun — see copy.POD_NOUN) ----

export type PodKind = 'car' | 'walk' | 'meetup' | 'other'
export const POD_KINDS: readonly PodKind[] = ['car', 'walk', 'meetup', 'other']

export type Pod = {
  id: string
  pulseId: string
  kind: PodKind
  label: string
  seats: number | null // null = uncapped; a set value is the only hard capacity in the pulse system
  ownerParticipantId: string
  createdAt: Date
}

export type PodMember = {
  podId: string
  pulseId: string
  participantId: string
  joinedAt: Date
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
export type PodMemberRow = PodMember & { displayName: string | null }

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
  startAt: string
  expiresAt: string
  phase: PulsePhase
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
  // Guests riding on this response (0–3); renders as a "+N" chip. Editable on the viewer's own row.
  partySize: number
  // True when the pulse has a passed count cutoff and this party was NOT in the locked count
  // (joined or re-dated after count_needed_by). Always false when no cutoff / cutoff not passed.
  afterCount: boolean
  me: boolean
}

// The headcount block on a pulse with venue facts; null when neither fact is set (facts unset =
// exactly the pulse before this capability). All numbers are computed at read time (design D3).
export type PublicPulseHeadcount = {
  people: number // non-'out' responses
  guests: number // Σ party_size over non-'out' responses
  headcount: number // people + guests — the reservation number
  seatsCap: number | null
  countNeededBy: string | null
  // Locked count snapshot: headcount over parties whose updated_at <= count_needed_by. Null until
  // the cutoff passes. afterCount is the remainder (headcount - locked), the "after the count" side.
  lockedCount: number | null
  afterCount: number | null
  tableCalledAt: string | null
}

// A pod member: display name + their EXISTING pulse status/ETA only (read-time join over
// responses — day-of grouping is derived, never stored). Never a phone.
export type PublicPulsePodMember = {
  participantId: string
  displayName: string
  status: PulseStatus | null
  etaMinutes: number | null
  me: boolean
}

// A pod as serialized inside the pulse state payload. Nothing anywhere identifies participants
// who joined no pod beyond their absence from these rosters.
export type PublicPulsePod = {
  id: string
  kind: PodKind
  label: string
  seats: number | null
  ownerParticipantId: string
  members: PublicPulsePodMember[]
  mine: boolean // viewer is a member
  owned: boolean // viewer is the owner
}

export type PublicPulse = {
  token: string
  title: string
  place: string
  timeLabel: string
  startAt: string
  expiresAt: string
  phase: PulsePhase
  live: boolean // back-compat: === (phase === 'live')
  closedAt: string | null
  crewToken: string | null
  crewName: string | null
  participants: PublicPulseResponse[]
  madeItCount: number
  viewer: PublicViewer
  // Location map: coordinates + confidence. Only `resolved` (with non-null coords) renders a map;
  // everything else falls back to the stylized place tile.
  placeLat: number | null
  placeLng: number | null
  placeGeoStatus: PlaceGeoStatus
  // Venue facts + reservation math; null when the pulse carries no venue facts.
  headcount: PublicPulseHeadcount | null
  // Pods on this pulse (may be empty — zero pods renders exactly as before the capability).
  pods: PublicPulsePod[]
}

// Dash shapes carry ONLY the viewer's own participation (my status, my note) — never another
// participant's id, response, or roster row (spec: pulse-dashboard privacy bound).
export type PublicDashPulse = {
  token: string
  title: string
  place: string
  timeLabel: string
  startAt: string
  expiresAt: string
  phase: PulsePhase
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

export type PlanState = 'proposing' | 'open' | 'struck' | 'expired' | 'completed'
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
  struckAt: Date | null // when the strike happened — drives the timeless completion fallback
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

// ---- again engine (close-plan-loop) ----

export type Ember = {
  id: string
  planId: string
  intentSnapshot: string
  createdAt: Date
}

export type EmberTap = {
  emberId: string
  participantId: string
  tappedAt: Date
}

// The ONLY ember shape sent to a client, and only ever the VIEWER'S OWN standing. A non-tapper
// (or signed-out viewer) always receives the empty shape — no count, no names, no hint that
// anyone else has or hasn't tapped. `coTappers` (display names) fills in only once the ember is
// mutual (>= 2 taps), and only for tappers. Silence is structurally invisible (again-engine spec).
export type PublicEmber = {
  tapped: boolean
  mutual: boolean
  coTappers: string[]
}

// A plan on the opener's dash: their own plans only, with the viewer's own ember standing on
// completed ones (subject to PublicEmber's visibility rules — never anyone's non-response).
export type PublicDashPlan = {
  token: string
  intentText: string
  state: PlanState
  winnerLabel: string | null
  ember: PublicEmber | null
}

// ---- intent layer (add-intent-layer) ----

// The directed "see them again" tap. Stored as one row per directed pair; all visibility rules
// live in lib/pulse/person-intent.ts (mirroring the ember). `source` is context only, never shown.
export type PersonIntent = {
  fromParticipantId: string
  toParticipantId: string
  sourcePlanId: string
  createdAt: Date
}

// The ONLY person-intent shape sent to a client, and only ever the VIEWER'S OWN standing. `tapped`
// is whether the viewer tapped this person; `mutual` is true only once both directed rows exist.
// A one-sided intent TOWARD the viewer resolves to { tapped: false, mutual: false } — indistinguishable
// from silence (person-intent spec). Tap order and timestamps never appear.
export type PublicPersonIntent = { tapped: boolean; mutual: boolean }

// A tappable co-attendee on the afterglow screen (zone two): a winning-option marker other than the
// viewer. Attendance is mutually known (they were there), so the face itself leaks nothing; it carries
// only the VIEWER'S OWN tap state and any mutual reveal — never whether anyone else tapped anyone.
export type PublicFace = {
  participantId: string
  displayName: string
  tapped: boolean
  mutual: boolean
}

// A draft-plan candidate the resolver derived at read time (never materialized). `kind` ranks the
// signal (compound > ember > person); `people` are the co-owned names; `activity` is the ember's
// snapshot when present; `seedIntent` seeds the plan proposer on accept; `suggestedWindow` is a
// system-chosen default (a better time), NEVER a stated fact about a person's availability.
export type PublicIntentCandidate = {
  key: string
  kind: 'compound' | 'ember' | 'person'
  people: string[]
  activity: string | null
  seedIntent: string
  suggestedWindow: { startsAt: string; endsAt: string } | null
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
