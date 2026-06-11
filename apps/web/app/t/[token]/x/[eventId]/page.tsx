import { notFound } from 'next/navigation'
import * as repo from '@/lib/asker/repo'
import { ExitButtons } from '@/components/asker/ExitButtons'

export const dynamic = 'force-dynamic'

export default async function ExitPollPage({ params }: { params: Promise<{ token: string; eventId: string }> }) {
  const { token, eventId } = await params
  const session = await repo.getMemberByToken(token).catch(() => null)
  if (!session) notFound()
  const event = await repo.getEvent(eventId).catch(() => null)
  if (!event || event.circleId !== session.circle.id) notFound()
  if (event.state !== 'done') notFound()
  return (
    <main className="mx-auto min-h-screen max-w-md bg-neutral-950 p-6 text-neutral-100">
      <h1 className="text-2xl">Would last night have happened without this?</h1>
      <p className="mt-2 text-sm text-neutral-500">One tap. Honest answers are the whole test.</p>
      <div className="mt-6"><ExitButtons eventId={eventId} token={token} /></div>
    </main>
  )
}
