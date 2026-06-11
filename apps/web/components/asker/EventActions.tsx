'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AttendanceState } from '@/lib/asker/types'

type Props = {
  eventId: string
  token: string
  myState: AttendanceState | null
  holdOpen: boolean   // hold opened, not yet decided, and I am 'in'
  walkIn: boolean     // within T-1h .. T+3h
  venueName: string | null
}

export function EventActions({ eventId, token, myState, holdOpen, walkIn, venueName }: Props) {
  const [venue, setVenue] = useState('')
  const router = useRouter()

  async function post(path: string, body: object) {
    await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, ...body }),
    })
    router.refresh()
  }
  const setState = (state: AttendanceState, etaMinutes?: number) =>
    post(`/api/events/${eventId}/attendance`, { state, etaMinutes })

  return (
    <div className="space-y-4">
      {holdOpen && (
        <div className="rounded bg-neutral-900 p-3">
          <p className="mb-2">Still in?</p>
          <div className="flex gap-2">
            <button onClick={() => setState('confirmed')} className="rounded bg-amber-500 px-4 py-2 font-medium text-black">yes</button>
            <button onClick={() => setState('out')} className="rounded bg-neutral-800 px-4 py-2">can't tonight</button>
          </div>
        </div>
      )}
      {(myState === null || myState === 'out') && (
        <button onClick={() => setState('in')} className="rounded bg-amber-500 px-5 py-3 text-lg font-medium text-black">
          Join
        </button>
      )}
      {walkIn && myState !== null && myState !== 'out' && myState !== 'here' && (
        <div className="rounded bg-neutral-900 p-3">
          <p className="mb-2 text-sm text-neutral-400">on my way —</p>
          <div className="flex gap-2">
            {[5, 15, 30].map((m) => (
              <button key={m} onClick={() => setState('omw', m)} className="rounded bg-neutral-800 px-3 py-2">{m} min</button>
            ))}
            <button onClick={() => setState('here')} className="rounded bg-amber-500 px-4 py-2 font-medium text-black">I'm here</button>
          </div>
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); if (venue.trim()) post(`/api/events/${eventId}/venue`, { name: venue }) }}
      >
        <input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={80}
          className="flex-1 rounded bg-neutral-900 p-2 text-sm"
          placeholder={venueName ? `at ${venueName} — change?` : "where'd you end up?"} />
        <button className="rounded bg-neutral-800 px-3 py-2 text-sm">set</button>
      </form>
    </div>
  )
}
