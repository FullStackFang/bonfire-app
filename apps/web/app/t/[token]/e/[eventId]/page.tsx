import { notFound } from 'next/navigation'
import * as repo from '@/lib/asker/repo'
import { whenShort } from '@/lib/asker/copy'
import { EventActions } from '@/components/asker/EventActions'

export const dynamic = 'force-dynamic'

export default async function EventPage({ params }: { params: Promise<{ token: string; eventId: string }> }) {
  const { token, eventId } = await params
  const session = await repo.getMemberByToken(token).catch(() => null)
  if (!session) notFound()
  const event = await repo.getEvent(eventId).catch(() => null)
  if (!event || event.circleId !== session.circle.id) notFound()
  const round = await repo.getRound(event.roundId)
  const attendance = await repo.attendanceForEvent(eventId)
  const members = await repo.listMembers(session.circle.id)
  const nameOf = new Map(members.map((m) => [m.id, m.name]))
  const mine = attendance.find((a) => a.memberId === session.member.id) ?? null
  const now = new Date()
  const walkIn = now.getTime() >= event.happensAt.getTime() - 3600_000 &&
    now.getTime() <= event.happensAt.getTime() + 3 * 3600_000
  const holdOpen = !!event.holdOpenedAt && !event.holdDecidedAt && mine?.state === 'in'
  const venueName = event.venueId ? await repo.getVenueName(event.venueId) : null
  const visible = attendance.filter((a) => ['in', 'confirmed', 'omw', 'here'].includes(a.state))

  const badge = (a: (typeof visible)[number]) =>
    a.state === 'here' ? 'here' : a.state === 'omw' ? `omw${a.etaMinutes ? ` · ${a.etaMinutes}m` : ''}` : 'in'

  return (
    <main className="mx-auto min-h-screen max-w-md bg-neutral-950 p-6 text-neutral-100">
      <p className="text-sm text-neutral-500">{session.circle.name}</p>
      {event.state === 'fell_through' ? (
        <h1 className="mt-4 text-2xl">Tonight thinned out — happens. The asker will try again.</h1>
      ) : (
        <>
          <h1 className="mt-4 text-3xl">It&apos;s ON: {round!.verbEmoji} {whenShort(event.happensAt, now)}</h1>
          {venueName && <p className="mt-1 text-lg text-amber-400">{venueName}</p>}
          <ul className="mt-6 space-y-1">
            {visible.map((a) => (
              <li key={a.memberId} className="flex justify-between rounded bg-neutral-900 px-3 py-2">
                <span>{nameOf.get(a.memberId)}{a.memberId === session.member.id ? ' (you)' : ''}</span>
                <span className={a.state === 'here' ? 'text-amber-400' : 'text-neutral-400'}>{badge(a)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            {event.state === 'on' && (
              <EventActions eventId={eventId} token={token} myState={mine?.state ?? null}
                holdOpen={holdOpen} walkIn={walkIn} venueName={venueName} />
            )}
            {event.state === 'done' && <p className="text-neutral-500">This one&apos;s in the books.</p>}
          </div>
        </>
      )}
    </main>
  )
}
