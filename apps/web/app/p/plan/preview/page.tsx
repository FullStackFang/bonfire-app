import { notFound } from 'next/navigation'
import type { PublicEmber, PublicFace, PublicIntentCandidate, PublicPlan } from '@/lib/pulse/types'
import { PlanView } from '../[token]/PlanView.client'
import { CandidatesCard } from '../../Candidates.client'

// Dev-only preview harness for the intent layer (add-intent-layer), mirroring /p/s/preview: renders
// the real afterglow zone-two faces AND the dashboard candidates card with synthetic data, so both
// breakpoints (~390px and ≥1100px) can be checked without seeding the database. A static segment, so
// it wins over [token]. 404s in production. The bad token means usePulsePoll 404s and stops, and a
// face/accept tap 404s too — no writes anywhere.
export const dynamic = 'force-dynamic'

const NAMES = ['Dana', 'Priya', 'Sam', 'Kai', 'Mira', 'Theo']

function afterglow(): { plan: PublicPlan; ember: PublicEmber; faces: PublicFace[] } {
  const winner = {
    id: 'opt-win', kind: 'time_place' as const, label: 'Sat, Jul 18 · 10:00 AM · Riverside Courts',
    startsAt: new Date(Date.now() - 6 * 3_600_000).toISOString(),
    venue: { name: 'Riverside Courts', area: 'East Side' }, aiRationale: null,
    availableCount: 4, mine: true, won: true,
  }
  const plan: PublicPlan = {
    token: 'preview', intentText: 'tennis saturday', creatorName: 'You', state: 'completed',
    options: [winner], struck: false, winner,
    viewer: { participantId: 'pv-0', displayName: 'You', verified: true },
  }
  const ember: PublicEmber = { tapped: true, mutual: true, coTappers: ['Dana', 'Priya'] }
  const faces: PublicFace[] = NAMES.map((name, i) => ({
    participantId: `pv-${i + 1}`, displayName: name,
    tapped: i < 3, mutual: i < 2, // a mix: two mutual, one one-sided-own, the rest untapped
  }))
  return { plan, ember, faces }
}

function candidates(): PublicIntentCandidate[] {
  const soon = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days); d.setHours(19, 0, 0, 0)
    return { startsAt: d.toISOString(), endsAt: new Date(d.getTime() + 3 * 3_600_000).toISOString() }
  }
  return [
    { key: 'c1', kind: 'compound', people: ['Kat'], activity: 'climbing', seedIntent: 'again: climbing with Kat', suggestedWindow: soon(3) },
    { key: 'c2', kind: 'ember', people: ['Dana', 'Priya'], activity: 'tennis saturday', seedIntent: 'again: tennis saturday with Dana and Priya', suggestedWindow: soon(5) },
    { key: 'c3', kind: 'person', people: ['Theo'], activity: null, seedIntent: 'catch up with Theo', suggestedWindow: null },
  ]
}

export default async function PlanPreview() {
  if (process.env.NODE_ENV === 'production') notFound()
  const { plan, ember, faces } = afterglow()
  return (
    <div className="mx-auto w-full bp-main-wide px-4 py-6 space-y-10">
      <section>
        <div className="bp-overline mb-2">Afterglow (zone two) — narrow column, both breakpoints</div>
        <main className="mx-auto flex w-full max-w-md flex-col">
          <PlanView initial={plan} initialEmber={ember} initialFaces={faces} token="preview" />
        </main>
      </section>
      <section>
        <div className="bp-overline mb-2">Dashboard candidates card</div>
        <CandidatesCard initial={candidates()} />
      </section>
    </div>
  )
}
