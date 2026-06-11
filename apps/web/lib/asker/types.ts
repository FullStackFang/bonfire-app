export type Verb = { emoji: string; label: string }

// dow: 0=Sun..6=Sat, hours in America/New_York
export type CadenceTemplate = {
  askDow: number
  askHour: number
  verb: string // emoji from verbSet, or 'rotate'
  proposeDow: number
  proposeHour: number
}

export type Circle = {
  id: string
  name: string
  verbSet: Verb[]
  kThreshold: number
  cadence: CadenceTemplate[]
}

export type Member = {
  id: string
  circleId: string
  name: string
  phone: string
  token: string
}

export type RoundState = 'queued' | 'open' | 'struck' | 'expired'
export type RoundSource = 'scheduled' | 'kindled'

export type Round = {
  id: string
  circleId: string
  verbEmoji: string
  verbLabel: string
  proposedAt: Date
  closesAt: Date
  detail: string | null
  source: RoundSource
  state: RoundState
  cadenceSlot: string | null
}

export type EventState = 'on' | 'fell_through' | 'done'

export type EventRow = {
  id: string
  roundId: string
  circleId: string
  happensAt: Date
  venueId: string | null
  state: EventState
  needsHold: boolean
  holdOpenedAt: Date | null
  holdDecidedAt: Date | null
  exitPollsSentAt: Date | null
}

export type AttendanceState = 'in' | 'confirmed' | 'out' | 'omw' | 'here'

export type Attendance = {
  eventId: string
  memberId: string
  state: AttendanceState
  etaMinutes: number | null
}

export type SmsKind =
  | 'welcome' | 'ask' | 'strike' | 'hold' | 't0'
  | 'fell_through' | 'exit_poll' | 'later_nudge'

export const NON_EVENT_KINDS: SmsKind[] = ['welcome', 'ask', 'later_nudge']
