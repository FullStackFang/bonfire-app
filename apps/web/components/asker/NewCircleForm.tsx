'use client'
import { useState } from 'react'

export function NewCircleForm() {
  const [name, setName] = useState('')
  const [k, setK] = useState(2)
  const [joinUrl, setJoinUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (joinUrl) {
    return (
      <div className="space-y-3">
        <p className="text-amber-400">Circle created. Paste this into your group chat — it&apos;s the only chat-paste you&apos;ll ever do:</p>
        <code className="block break-all rounded bg-neutral-900 p-3 text-sm">{joinUrl}</code>
      </div>
    )
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true); setError(null)
        try {
          const res = await fetch('/api/circles', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name, kThreshold: k }),
          })
          const data = await res.json()
          if (res.ok) setJoinUrl(data.joinUrl)
          else setError(data.error ?? 'something broke')
        } catch {
          setError('network hiccup — try again')
        } finally {
          setBusy(false)
        }
      }}
    >
      <label className="block">
        <span className="text-sm text-neutral-400">Circle name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60}
          className="mt-1 w-full rounded bg-neutral-900 p-3" placeholder="Park Slope crew" />
      </label>
      <label className="block">
        <span className="text-sm text-neutral-400">Strike threshold (how many &quot;in&quot;s light it)</span>
        <select value={k} onChange={(e) => setK(Number(e.target.value))} className="mt-1 w-full rounded bg-neutral-900 p-3">
          <option value={2}>2 — strike easy (default)</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button disabled={busy} className="rounded bg-amber-500 px-4 py-2 font-medium text-black disabled:opacity-50">
        {busy ? '…' : 'Create circle'}
      </button>
    </form>
  )
}
