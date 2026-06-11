import { notFound, redirect } from 'next/navigation'
import * as repo from '@/lib/asker/repo'
import { serializeRound } from '@/lib/asker/serialize'
import { whenLabel } from '@/lib/asker/copy'
import { ReplyButtons } from '@/components/asker/ReplyButtons'

export const dynamic = 'force-dynamic'

export default async function RoundPage({ params }: { params: Promise<{ token: string; roundId: string }> }) {
  const { token, roundId } = await params
  const session = await repo.getMemberByToken(token).catch(() => null)
  if (!session) notFound()
  const round = await repo.getRound(roundId).catch(() => null)
  if (!round || round.circleId !== session.circle.id || round.state === 'queued') notFound()
  if (round.state === 'struck') {
    const event = await repo.getEventByRoundId(round.id)
    if (event) redirect(`/t/${token}/e/${event.id}`)
  }
  const pub = serializeRound(round, await repo.getMyReply(round.id, session.member.id))
  const now = new Date()
  return (
    <main className="mx-auto min-h-screen max-w-md bg-neutral-950 p-6 text-neutral-100">
      <p className="text-sm text-neutral-500">{session.circle.name}</p>
      <h1 className="mt-4 text-4xl">{pub.verbEmoji} <span className="text-2xl">{pub.verbLabel}</span></h1>
      <p className="mt-1 text-xl text-neutral-300">{whenLabel(new Date(pub.proposedAt), now)}</p>
      {pub.detail && <p className="mt-2 text-neutral-400">"{pub.detail}"</p>}
      <div className="mt-8">
        {pub.state === 'expired'
          ? <p className="text-neutral-500">This one quietly passed.</p>
          : <ReplyButtons roundId={pub.id} token={token} initial={pub.myAnswer} />}
      </div>
      <p className="mt-8 text-sm text-neutral-500">Nobody sees your answer till it's on.</p>
    </main>
  )
}
