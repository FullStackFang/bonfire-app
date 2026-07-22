import { isLive } from './time'
import type { CrewMemberRow, DashCrewRow, DashPulseRow } from './repo'
import {
  pulsePhase,
  type Crew, type Pod, type PodMemberRow, type Pulse, type PresenceRow, type PulseResponseRow,
  type PublicBoard, type PublicCrewMember, type PublicDash, type PublicDashCrew, type PublicDashPulse,
  type PublicPulse, type PublicPulseHeadcount, type PublicPulsePod, type PublicPresence,
  type PublicPulseResponse, type PublicViewer,
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

/** `passedCutoff` is the pulse's count_needed_by ONLY once it has passed (else null): rows
 *  re-dated past it flag as "after the count". Timestamps themselves never leave the server. */
export function serializeResponses(
  rows: PulseResponseRow[], meId: string | null, passedCutoff: Date | null = null,
): PublicPulseResponse[] {
  return rows.map((r) => ({
    participantId: r.participantId,
    displayName: nameOf(r.displayName),
    status: r.status,
    etaMinutes: r.etaMinutes,
    note: r.note,
    partySize: r.partySize,
    afterCount: passedCutoff != null && r.status !== 'out'
      && r.updatedAt.getTime() > passedCutoff.getTime(),
    me: r.participantId === meId,
  }))
}

// The reservation math, computed at read time (design D3 — no cron, no stored snapshot). Null when
// the pulse carries no venue facts: facts unset means zero change to existing pulses.
export function computeHeadcount(
  pulse: Pulse, rows: PulseResponseRow[], now: Date,
): PublicPulseHeadcount | null {
  if (pulse.seatsCap == null && pulse.countNeededBy == null) return null
  const counted = rows.filter((r) => r.status !== 'out')
  const people = counted.length
  const guests = counted.reduce((sum, r) => sum + r.partySize, 0)
  const headcount = people + guests
  const cutoffPassed =
    pulse.countNeededBy != null && now.getTime() >= pulse.countNeededBy.getTime()
  // The locked count: parties whose row stood at or before the cutoff. The number locks; the door
  // does not — later (or re-dated) parties are the "after the count" remainder.
  const lockedCount = cutoffPassed
    ? counted
        .filter((r) => r.updatedAt.getTime() <= pulse.countNeededBy!.getTime())
        .reduce((sum, r) => sum + 1 + r.partySize, 0)
    : null
  return {
    people,
    guests,
    headcount,
    seatsCap: pulse.seatsCap,
    countNeededBy: pulse.countNeededBy ? pulse.countNeededBy.toISOString() : null,
    lockedCount,
    afterCount: lockedCount != null ? headcount - lockedCount : null,
    tableCalledAt: pulse.tableCalledAt ? pulse.tableCalledAt.toISOString() : null,
  }
}

// Pods carry per member ONLY the display name + their existing pulse status/ETA (a read-time join
// over the responses — day-of grouping is derived, never stored). Nothing anywhere identifies
// participants who joined no pod beyond their absence from these rosters.
export function serializePods(
  pods: Pod[], members: PodMemberRow[], responses: PulseResponseRow[], meId: string | null,
): PublicPulsePod[] {
  const responseBy = new Map(responses.map((r) => [r.participantId, r]))
  return pods.map((pod) => {
    const roster = members.filter((m) => m.podId === pod.id).map((m) => {
      const response = responseBy.get(m.participantId)
      return {
        participantId: m.participantId,
        displayName: nameOf(m.displayName),
        status: response?.status ?? null,
        etaMinutes: response?.etaMinutes ?? null,
        me: m.participantId === meId,
      }
    })
    return {
      id: pod.id,
      kind: pod.kind,
      label: pod.label,
      seats: pod.seats,
      ownerParticipantId: pod.ownerParticipantId,
      members: roster,
      mine: roster.some((m) => m.me),
      owned: pod.ownerParticipantId === meId,
    }
  })
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
  const now = new Date()
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
      startAt: p.startAt.toISOString(),
      expiresAt: p.expiresAt.toISOString(),
      phase: pulsePhase(p, now),
    })),
    viewer,
  }
}

// Dash payload: tokens, names, labels, and MY status only. The repo rows already carry no other
// participant's data; this drops the internal ids and Date objects on the way out.
const toDashPulse = (p: DashPulseRow, now: Date): PublicDashPulse => ({
  token: p.token,
  title: p.title,
  place: p.place,
  timeLabel: p.timeLabel,
  startAt: p.startAt.toISOString(),
  expiresAt: p.expiresAt.toISOString(),
  phase: pulsePhase(p, now),
  crewName: p.crewName,
  myStatus: p.myStatus,
  droppedByMe: p.createdByMe,
})

export function serializeDash(
  crews: DashCrewRow[],
  pulses: { live: DashPulseRow[]; earlier: DashPulseRow[] },
  viewer: PublicViewer,
): PublicDash {
  const now = new Date()
  const toCrew = (c: DashCrewRow): PublicDashCrew => ({
    token: c.token, name: c.name, myStatus: c.myStatus, myNote: c.myNote,
  })
  return {
    live: pulses.live.map((p) => toDashPulse(p, now)),
    crews: crews.map(toCrew),
    earlier: pulses.earlier.map((p) => toDashPulse(p, now)),
    viewer,
  }
}

export function serializePulse(
  pulse: Pulse,
  responses: PulseResponseRow[],
  viewer: PublicViewer,
  crew: Crew | null,
  now: Date,
  pods: Pod[] = [],
  podMembers: PodMemberRow[] = [],
): PublicPulse {
  const meId = viewer?.participantId ?? null
  const passedCutoff =
    pulse.countNeededBy != null && now.getTime() >= pulse.countNeededBy.getTime()
      ? pulse.countNeededBy : null
  return {
    token: pulse.token,
    title: pulse.title,
    place: pulse.place,
    timeLabel: pulse.timeLabel,
    startAt: pulse.startAt.toISOString(),
    expiresAt: pulse.expiresAt.toISOString(),
    phase: pulsePhase(pulse, now),
    live: isLive(pulse, now),
    closedAt: pulse.closedAt ? pulse.closedAt.toISOString() : null,
    crewToken: crew?.token ?? null,
    crewName: crew?.name ?? null,
    participants: serializeResponses(responses, meId, passedCutoff),
    madeItCount: responses.filter((p) => p.status === 'here').length,
    viewer,
    placeLat: pulse.placeLat,
    placeLng: pulse.placeLng,
    placeGeoStatus: pulse.placeGeoStatus,
    headcount: computeHeadcount(pulse, responses, now),
    pods: serializePods(pods, podMembers, responses, meId),
  }
}
