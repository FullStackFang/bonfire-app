'use client'
import { useState } from 'react'

export function JoinForm({ circleId }: { circleId: string }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (link) {
    return (
      <div className="space-y-3">
        <p className="text-amber-400">You're in. We texted you your personal link — it's also here:</p>
        <a href={link} className="block break-all rounded bg-neutral-900 p-3 text-sm underline">{link}</a>
        <p className="text-sm text-neutral-400">Bookmark it. It's how the asker reaches you.</p>
      </div>
    )
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true); setError(null)
        const res = await fetch(`/api/join/${circleId}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, phone, consent }),
        })
        const data = await res.json()
        setBusy(false)
        if (res.ok) setLink(data.link)
        else setError(data.error ?? 'something broke')
      }}
    >
      <label className="block">
        <span className="text-sm text-neutral-400">First name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40}
          className="mt-1 w-full rounded bg-neutral-900 p-3" placeholder="Maya" />
      </label>
      <label className="block">
        <span className="text-sm text-neutral-400">US phone</span>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel"
          className="mt-1 w-full rounded bg-neutral-900 p-3" placeholder="(917) 555-0142" />
      </label>
      <label className="flex items-start gap-2 text-sm text-neutral-400">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required className="mt-1" />
        <span>Bonfire texts you when plans strike. Reply STOP anytime.</span>
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button disabled={busy} className="rounded bg-amber-500 px-4 py-2 font-medium text-black disabled:opacity-50">
        {busy ? '…' : "I'm in"}
      </button>
    </form>
  )
}
