import { isLive } from './time'
import type { CrewMemberRow, DashCrewRow, DashPulseRow } from './repo'
import type {
  Crew, Pulse, PresenceRow, PulseResponseRow,
  PublicBoard, PublicCrewMember, PublicDash, PublicDashCrew, PublicDashPulse,
  PublicPulse, PublicPresence, PublicPulseResponse, PublicViewer,
} from './types'

// The only thing sent to the client. Internal columns (created_by, version, other tokens)
// never leave the server — mirroring the asker's serialize discipline.

const nameOf = (displayName: string | null): string => displayName ?? 'someone'

export function serializePresence(rows: PresenceRow[], meId: string | null): PublicPresence[] {
  return rows.map((r) => ({
    participantId: r.participantId,
    displayName: nameOf(r.displayName),
    status: r.status,
    note: r.note,
    me: r.participantId === meId,
  }))
}

export function serializeResponses(rows: PulseResponseRow[], meId: string | null): PublicPulseResponse[] {
  return rows.map((r) => ({
    participantId: r.participantId,
    displayName: nameOf(r.displayName),
    status: r.status,
    etaMinutes: r.etaMinutes,
    note: r.note,
    me: r.participantId === meId,
  }))
}

// Display names only — a member's phone never reaches any payload.
export function serializeMembers(rows: CrewMemberRow[], meId: string | null): PublicCrewMember[] {
  return rows.map((r) => ({
    participantId: r.participantId,
    displayName: nameOf(r.displayName),
    me: r.participantId === meId,
  }))
}

export function serializeBoard(
  crew: Crew,
  presence: PresenceRow[],
  pulses: Pulse[],
  members: CrewMemberRow[],
  viewer: PublicViewer,
): PublicBoard {
  return {
    token: crew.token,
    name: crew.name,
    presence: serializePresence(presence, viewer?.participantId ?? null),
    members: serializeMembers(members, viewer?.participantId ?? null),
    pulses: pulses.map((p) => ({
      token: p.token,
      title: p.title,
      place: p.place,
      timeLabel: p.timeLabel,
      expiresAt: p.expiresAt.toISOString(),
    })),
    viewer,
  }
}

// Dash payload: tokens, names, labels, and MY status only. The repo rows already carry no other
// participant's data; this drops the internal ids and Date objects on the way out.
const toDashPulse = (p: DashPulseRow): PublicDashPulse => ({
  token: p.token,
  title: p.title,
  place: p.place,
  timeLabel: p.timeLabel,
  expiresAt: p.expiresAt.toISOString(),
  crewName: p.crewName,
  myStatus: p.myStatus,
  droppedByMe: p.createdByMe,
})

export function serializeDash(
  crews: DashCrewRow[],
  pulses: { live: DashPulseRow[]; earlier: DashPulseRow[] },
  viewer: PublicViewer,
): PublicDash {
  const toCrew = (c: DashCrewRow): PublicDashCrew => ({
    token: c.token, name: c.name, myStatus: c.myStatus, myNote: c.myNote,
  })
  return {
    live: pulses.live.map(toDashPulse),
    crews: crews.map(toCrew),
    earlier: pulses.earlier.map(toDashPulse),
    viewer,
  }
}

export function serializePulse(
  pulse: Pulse,
  responses: PulseResponseRow[],
  viewer: PublicViewer,
  crew: Crew | null,
  now: Date,
): PublicPulse {
  return {
    token: pulse.token,
    title: pulse.title,
    place: pulse.place,
    timeLabel: pulse.timeLabel,
    expiresAt: pulse.expiresAt.toISOString(),
    live: isLive(pulse, now),
    closedAt: pulse.closedAt ? pulse.closedAt.toISOString() : null,
    crewToken: crew?.token ?? null,
    crewName: crew?.name ?? null,
    participants: serializeResponses(responses, viewer?.participantId ?? null),
    madeItCount: responses.filter((p) => p.status === 'here').length,
    viewer,
    placeLat: pulse.placeLat,
    placeLng: pulse.placeLng,
    placeGeoStatus: pulse.placeGeoStatus,
  }
}
