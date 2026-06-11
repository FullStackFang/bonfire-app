'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Answer = 'in' | 'out' | 'later'

export function ReplyButtons({ roundId, token, initial }: { roundId: string; token: string; initial: Answer | null }) {
  const [answer, setAnswer] = useState<Answer | null>(initial)
  const [closed, setClosed] = useState(false)
  const router = useRouter()

  async function reply(a: Answer) {
    setAnswer(a)
    const res = await fetch(`/api/rounds/${roundId}/reply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, answer: a }),
    })
    const data = await res.json()
    if (data.state === 'struck') router.push(`/t/${token}/e/${data.eventId}`)
    if (data.state === 'closed') setClosed(true)
  }

  if (closed) return <p className="text-neutral-400">This one's closed.</p>
  const btn = (a: Answer, label: string) => (
    <button
      onClick={() => reply(a)}
      className={`rounded px-5 py-3 text-lg font-medium ${
        answer === a ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-100'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div className="flex gap-3">
      {btn('in', "I'm in")}
      {btn('later', 'ask me later')}
      {btn('out', 'not this one')}
    </div>
  )
}
