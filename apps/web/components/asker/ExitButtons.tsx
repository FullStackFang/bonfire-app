'use client'
import { useState } from 'react'

export function ExitButtons({ eventId, token }: { eventId: string; token: string }) {
  const [done, setDone] = useState(false)
  if (done) return <p className="text-amber-400">Logged. Thanks for the honesty.</p>
  const answer = (wouldHaveHappened: boolean) =>
    fetch(`/api/exit/${eventId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, wouldHaveHappened }),
    }).then(() => setDone(true))
  return (
    <div className="flex gap-3">
      <button onClick={() => answer(true)} className="rounded bg-neutral-800 px-5 py-3">yes, probably</button>
      <button onClick={() => answer(false)} className="rounded bg-amber-500 px-5 py-3 font-medium text-black">no, honestly</button>
    </div>
  )
}
