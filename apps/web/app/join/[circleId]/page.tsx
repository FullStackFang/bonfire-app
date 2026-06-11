import { notFound } from 'next/navigation'
import { getCircle } from '@/lib/asker/repo'
import { JoinForm } from '@/components/asker/JoinForm'

export const dynamic = 'force-dynamic'

export default async function JoinPage({ params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params
  const circle = await getCircle(circleId).catch(() => null)
  if (!circle) notFound()
  return (
    <main className="mx-auto min-h-screen max-w-md bg-neutral-950 p-6 text-neutral-100">
      <h1 className="mb-1 text-2xl font-semibold">🔥 {circle.name}</h1>
      <p className="mb-6 text-sm text-neutral-400">
        The app asks so nobody has to. Your answers stay invisible until enough people are in.
      </p>
      <JoinForm circleId={circle.id} />
    </main>
  )
}
