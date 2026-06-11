import Link from 'next/link'
import { notFound } from 'next/navigation'
import * as repo from '@/lib/asker/repo'
import { serializeRound } from '@/lib/asker/serialize'
import { whenLabel, whenShort } from '@/lib/asker/copy'
import { KindleForm } from '@/components/asker/KindleForm'

export const dynamic = 'force-dynamic'

export default async function CircleHome({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await repo.getMemberByToken(token).catch(() => null)
  if (!session) notFound()
  const { member, circle } = session
  const now = new Date()
  const open = await repo.openRoundsForCircle(circle.id)
  const rounds = await Promise.all(
    open.map(async (r) => serializeRound(r, await repo.getMyReply(r.id, member.id))),
  )
  const events = await repo.eventsForCircle(circle.id, ['on'])
  const upcoming = await Promise.all(events.map(async (e) => {
    const round = await repo.getRound(e.roundId)
    return { id: e.id, emoji: round!.verbEmoji, when: whenShort(e.happensAt, now) }
  }))
  return (
    <main className="mx-auto min-h-screen max-w-md bg-neutral-950 p-6 text-neutral-100">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">🔥 {circle.name}</h1>
        <Link href={`/t/${token}/places`} className="text-sm text-amber-400 underline">places</Link>
      </div>

      <section className="mt-6">
        <h2 className="text-sm uppercase tracking-wide text-neutral-500">Open asks</h2>
        {rounds.length === 0 && <p className="mt-2 text-neutral-500">Quiet right now. The asker will speak up.</p>}
        <ul className="mt-2 space-y-2">
          {rounds.map((r) => (
            <li key={r.id}>
              <Link href={`/t/${token}/r/${r.id}`} className="flex items-center justify-between rounded bg-neutral-900 p-3">
                <span>{r.verbEmoji} {whenLabel(new Date(r.proposedAt), now)}</span>
                <span className="text-sm text-neutral-400">{r.myAnswer ? `you: ${r.myAnswer}` : 'answer →'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm uppercase tracking-wide text-neutral-500">It's on</h2>
        {upcoming.length === 0 && <p className="mt-2 text-neutral-500">Nothing struck yet.</p>}
        <ul className="mt-2 space-y-2">
          {upcoming.map((e) => (
            <li key={e.id}>
              <Link href={`/t/${token}/e/${e.id}`} className="block rounded bg-amber-950/40 p-3">
                {e.emoji} {e.when} — it's on →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 border-t border-neutral-800 pt-6">
        <h2 className="mb-3 text-sm uppercase tracking-wide text-neutral-500">Down for something?</h2>
        <KindleForm token={token} verbs={circle.verbSet} />
      </section>
    </main>
  )
}
