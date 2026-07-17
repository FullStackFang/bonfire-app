import { notFound } from 'next/navigation'
import type { PublicPulse, PublicPulseResponse, PulseStatus } from '@/lib/pulse/types'
import { PulseView } from '../[token]/Pulse.client'

// Dev-only preview harness for the pulse detail page. Renders the real PulseView with
// synthetic participants so the desktop hearth can be checked at any headcount without
// seeding the database: /p/s/preview?n=50. A static segment, so it wins over [token].
// Returns 404 in production. The bad token means usePulsePoll 404s and stops (no writes).
export const dynamic = 'force-dynamic'

const FIRST = ['Maya', 'Theo', 'Stephen', 'Priya', 'Jacquelyn', 'Devon', 'Amara', 'Noah', 'Iris', 'Leo', 'Sana', 'Marcus', 'Nina', 'Owen', 'Rosa', 'Kai', 'Elena', 'Jonah', 'Tara', 'Wes', 'Cleo', 'Ravi', 'Mona', 'Paul', 'Zara', 'Dane', 'Lila', 'Sam', 'Yuki', 'Beck', 'Gia', 'Hugo', 'Ivy', 'Jed', 'Kira', 'Luca', 'Mira', 'Ned', 'Opal', 'Pia', 'Quin', 'Remy', 'Sol', 'Tomas', 'Uma', 'Vero', 'Will', 'Xena', 'Yara', 'Zeke']
const NOTES = ['Got us a table in the back, come find us', 'Grab the big booth by the window', "I'm by the bar in a red jacket"]

function buildPreview(n: number): PublicPulse {
  const participants: PublicPulseResponse[] = []
  for (let i = 0; i < n; i++) {
    const r = (i * 37) % 100
    let status: PulseStatus = r < 22 ? 'here' : r < 40 ? 'on_my_way' : r < 92 ? 'in' : 'out'
    if (n <= 4) status = (['here', 'on_my_way', 'in', 'in'] as PulseStatus[])[i % 4]!
    participants.push({
      participantId: `pv-${i}`,
      displayName: FIRST[i % FIRST.length]! + (i >= FIRST.length ? ` ${String.fromCharCode(65 + (i % 26))}` : ''),
      status,
      etaMinutes: status === 'on_my_way' ? 5 + ((i * 13) % 25) : null,
      note: status === 'here' && i % 9 === 0 ? NOTES[Math.floor(i / 9) % NOTES.length]! : null,
      me: i === 2,
    })
  }
  return {
    token: 'preview',
    title: 'Drive Up',
    place: 'The Anchor · Bar on Rivington',
    timeLabel: 'Now',
    expiresAt: new Date(Date.now() + 3 * 3_600_000).toISOString(),
    live: true,
    closedAt: null,
    crewToken: null,
    crewName: 'Residential Session 2027',
    participants,
    madeItCount: participants.filter((p) => p.status === 'here').length,
    viewer: { participantId: 'pv-2', displayName: FIRST[2]!, verified: true },
  }
}

export default async function PulsePreview({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { n } = await searchParams
  const count = Math.min(200, Math.max(0, Number.parseInt(n ?? '12', 10) || 0))
  const initial = buildPreview(count)
  return (
    <main className="bpd-main mx-auto flex min-h-full w-full max-w-md flex-col">
      <PulseView initial={initial} pulseToken="preview" />
    </main>
  )
}
