import { notFound } from 'next/navigation'
import * as repo from '@/lib/asker/repo'
import { glowOpacity } from '@/lib/asker/places'
import { ViewBeacon } from '@/components/asker/ViewBeacon'

export const dynamic = 'force-dynamic'

export default async function PlacesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await repo.getMemberByToken(token).catch(() => null)
  if (!session) notFound()
  const places = await repo.placesForCircle(session.circle.id)
  const max = places.reduce((m, p) => Math.max(m, p.visits), 0)
  return (
    <main className="mx-auto min-h-screen max-w-md bg-neutral-950 p-6 text-neutral-100">
      <ViewBeacon token={token} page="places" />
      <h1 className="text-2xl font-semibold">Places</h1>
      <p className="mt-1 text-sm text-neutral-500">Spots brighten every time you go back.</p>
      {places.length === 0 && <p className="mt-6 text-neutral-500">Nowhere yet. That changes the first time it's on.</p>}
      <ul className="mt-6 space-y-2">
        {places.map((p) => (
          <li key={p.name} className="flex justify-between rounded bg-neutral-900 px-3 py-3 text-lg"
            style={{ color: `rgba(251, 191, 36, ${glowOpacity(p.visits, max)})` }}>
            <span>{p.name}</span>
            <span>×{p.visits}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
