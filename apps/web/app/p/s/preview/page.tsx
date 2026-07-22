import { notFound } from 'next/navigation'
import type { PublicPulse, PublicPulseHeadcount, PublicPulsePod, PublicPulseResponse, PulsePhase, PulseStatus } from '@/lib/pulse/types'
import { PulseView } from '../[token]/Pulse.client'

// Dev-only preview harness for the pulse detail page. Renders the real PulseView with
// synthetic participants so the desktop hearth can be checked at any headcount without
// seeding the database: /p/s/preview?n=50. A static segment, so it wins over [token].
// Returns 404 in production. The bad token means usePulsePoll 404s and stops (no writes).
// Restaurant-pods states (add-restaurant-pods):
//   ?facts=1            → venue facts: table for 12 + a future count cutoff (meter + cutoff line)
//   ?facts=1&locked=1   → the cutoff has passed: locked-count chip + after-the-count split
//   ?pods=1             → three pods (a rolling car, the viewer's walking pod, a full car)
export const dynamic = 'force-dynamic'

const FIRST = ['Maya', 'Theo', 'Stephen', 'Priya', 'Jacquelyn', 'Devon', 'Amara', 'Noah', 'Iris', 'Leo', 'Sana', 'Marcus', 'Nina', 'Owen', 'Rosa', 'Kai', 'Elena', 'Jonah', 'Tara', 'Wes', 'Cleo', 'Ravi', 'Mona', 'Paul', 'Zara', 'Dane', 'Lila', 'Sam', 'Yuki', 'Beck', 'Gia', 'Hugo', 'Ivy', 'Jed', 'Kira', 'Luca', 'Mira', 'Ned', 'Opal', 'Pia', 'Quin', 'Remy', 'Sol', 'Tomas', 'Uma', 'Vero', 'Will', 'Xena', 'Yara', 'Zeke']
const NOTES = ['Got us a table in the back, come find us', 'Grab the big booth by the window', "I'm by the bar in a red jacket"]

function buildPods(participants: PublicPulseResponse[]): PublicPulsePod[] {
  // Disjoint member pools (one pod per participant): pull non-out rows in order.
  const pool = participants.filter((p) => p.status !== 'out')
  if (pool.length === 0) return []
  const take = (k: number) => pool.splice(0, k)
  const toMember = (p: PublicPulseResponse) => ({
    participantId: p.participantId, displayName: p.displayName,
    status: p.status, etaMinutes: p.etaMinutes, me: p.me,
  })
  const pods: PublicPulsePod[] = []
  // The viewer's walking pod first (owned + mine states reviewable at any n).
  const meIdx = pool.findIndex((p) => p.me)
  const me = meIdx >= 0 ? pool.splice(meIdx, 1)[0] : undefined
  if (me) {
    pods.push({
      id: 'pod-walk', kind: 'walk', label: 'walking from the L', seats: null,
      ownerParticipantId: me.participantId,
      members: [me, ...take(2)].map(toMember), mine: true, owned: true,
    })
  }
  const carA = take(3)
  if (carA.length > 0) {
    pods.push({
      id: 'pod-car-a', kind: 'car', label: `${carA[0]!.displayName.split(' ')[0]}’s car`, seats: 4,
      ownerParticipantId: carA[0]!.participantId,
      members: carA.map(toMember), mine: false, owned: false,
    })
  }
  const carB = take(2)
  if (carB.length === 2) {
    pods.push({
      id: 'pod-car-b', kind: 'car', label: `${carB[0]!.displayName.split(' ')[0]}’s car`, seats: 2,
      ownerParticipantId: carB[0]!.participantId,
      members: carB.map(toMember), mine: false, owned: false, // full: 2/2 seats
    })
  }
  return pods
}

function buildPreview(
  n: number, coord: { lat: number; lng: number } | null, phase: PulsePhase,
  facts: boolean, locked: boolean, withPods: boolean,
): PublicPulse {
  const participants: PublicPulseResponse[] = []
  for (let i = 0; i < n; i++) {
    const r = (i * 37) % 100
    let status: PulseStatus = r < 22 ? 'here' : r < 40 ? 'on_my_way' : r < 92 ? 'in' : 'out'
    if (n <= 4) status = (['here', 'on_my_way', 'in', 'in'] as PulseStatus[])[i % 4]!
    // An upcoming pulse has collected intent but no arrivals — nobody is "here"/"on the way" yet.
    if (phase === 'upcoming' && (status === 'here' || status === 'on_my_way')) status = 'in'
    const partySize = facts && status !== 'out' ? (i % 7 === 1 ? 1 : i % 11 === 3 ? 2 : i === 5 ? 3 : 0) : 0
    participants.push({
      participantId: `pv-${i}`,
      displayName: FIRST[i % FIRST.length]! + (i >= FIRST.length ? ` ${String.fromCharCode(65 + (i % 26))}` : ''),
      status,
      etaMinutes: status === 'on_my_way' ? 5 + ((i * 13) % 25) : null,
      note: status === 'here' && i % 9 === 0 ? NOTES[Math.floor(i / 9) % NOTES.length]! : null,
      partySize,
      afterCount: facts && locked && status !== 'out' && i % 5 === 0,
      me: i === 2,
    })
  }
  // The headcount block mirrors what serialize computes: Σ(1+party) over non-out, split at cutoff.
  let headcount: PublicPulseHeadcount | null = null
  if (facts) {
    const counted = participants.filter((p) => p.status !== 'out')
    const people = counted.length
    const guests = counted.reduce((s, p) => s + p.partySize, 0)
    const total = people + guests
    const afterCount = counted.filter((p) => p.afterCount).reduce((s, p) => s + 1 + p.partySize, 0)
    headcount = {
      people, guests, headcount: total, seatsCap: 12,
      countNeededBy: new Date(Date.now() + (locked ? -30 : 120) * 60_000).toISOString(),
      lockedCount: locked ? total - afterCount : null,
      afterCount: locked ? afterCount : null,
      tableCalledAt: null,
    }
  }
  // upcoming: starts in ~90 min, runs 2h. live: started, ends in 3h. over: wrapped.
  const startAt = phase === 'upcoming' ? new Date(Date.now() + 90 * 60_000) : new Date(Date.now() - 30 * 60_000)
  const expiresAt = phase === 'over' ? new Date(Date.now() - 60_000)
    : phase === 'upcoming' ? new Date(startAt.getTime() + 2 * 3_600_000)
    : new Date(Date.now() + 3 * 3_600_000)
  return {
    token: 'preview',
    title: 'Drive Up',
    place: 'The Anchor · Bar on Rivington',
    timeLabel: phase === 'upcoming' ? 'Tonight 9pm · ~2h' : 'Now · til late',
    startAt: startAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    phase,
    live: phase === 'live',
    closedAt: phase === 'over' ? new Date().toISOString() : null,
    crewToken: null,
    crewName: 'Residential Session 2027',
    participants,
    madeItCount: participants.filter((p) => p.status === 'here').length,
    viewer: { participantId: 'pv-2', displayName: FIRST[2]!, verified: true },
    placeLat: coord?.lat ?? null,
    placeLng: coord?.lng ?? null,
    placeGeoStatus: coord ? 'resolved' : 'unresolved',
    headcount,
    pods: withPods ? buildPods(participants) : [],
  }
}

export default async function PulsePreview({ searchParams }: { searchParams: Promise<{ n?: string; map?: string; lat?: string; lng?: string; phase?: string; facts?: string; locked?: string; pods?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { n, map, lat, lng, phase, facts, locked, pods } = await searchParams
  const count = Math.min(200, Math.max(0, Number.parseInt(n ?? '12', 10) || 0))
  const ph: PulsePhase = phase === 'upcoming' || phase === 'over' ? phase : 'live'
  // Resolved-coordinate preview so the live map tile can be reviewed without real geocoding:
  //   ?map=1                → a default resolved point (The Anchor · Rivington, NYC)
  //   ?lat=<n>&lng=<n>      → an explicit resolved point
  // Absent (default)        → unresolved, so the stylized tile renders.
  const explicit = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat != null && lng != null
  const coord = explicit
    ? { lat: Number(lat), lng: Number(lng) }
    : map === '1'
      ? { lat: 40.7189, lng: -73.9877 }
      : null
  const initial = buildPreview(count, coord, ph, facts === '1', locked === '1', pods === '1')
  return (
    <main className="bpd-main mx-auto flex min-h-full w-full max-w-md flex-col">
      <PulseView initial={initial} pulseToken="preview" />
    </main>
  )
}
