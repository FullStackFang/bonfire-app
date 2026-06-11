'use client'
import { useState } from 'react'
import type { Verb } from '@/lib/asker/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function KindleForm({ token, verbs }: { token: string; verbs: Verb[] }) {
  const [verb, setVerb] = useState<string | null>(null)
  const [dow, setDow] = useState<number | null>(null)
  const [hour, setHour] = useState(19)
  const [detail, setDetail] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  if (done) {
    return <p className="text-amber-400">Kindled. The asker will take it from here — nobody knows it was you.</p>
  }
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!verb || dow === null) return
        setBusy(true)
        const res = await fetch('/api/kindle', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token, verbEmoji: verb, proposeDow: dow, proposeHour: hour, detail: detail.trim() || undefined }),
        })
        setBusy(false)
        if (res.ok) setDone(true)
      }}
    >
      <div className="flex gap-2">
        {verbs.map((v) => (
          <button type="button" key={v.emoji} onClick={() => setVerb(v.emoji)}
            className={`rounded px-3 py-2 text-2xl ${verb === v.emoji ? 'bg-amber-500' : 'bg-neutral-800'}`}>
            {v.emoji}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {DAYS.map((d, i) => (
          <button type="button" key={d} onClick={() => setDow(i)}
            className={`rounded px-3 py-1 text-sm ${dow === i ? 'bg-amber-500 text-black' : 'bg-neutral-800'}`}>
            {d}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <select value={hour} onChange={(e) => setHour(Number(e.target.value))} className="rounded bg-neutral-900 p-2">
          {Array.from({ length: 17 }, (_, i) => i + 7).map((h) => (
            <option key={h} value={h}>{h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'am' : 'pm'}</option>
          ))}
        </select>
        <input value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={80}
          className="flex-1 rounded bg-neutral-900 p-2 text-sm" placeholder="one line, unattributed (optional)" />
      </div>
      <button disabled={busy || !verb || dow === null}
        className="rounded bg-amber-500 px-4 py-2 font-medium text-black disabled:opacity-40">
        {busy ? '…' : 'Kindle it, quietly'}
      </button>
    </form>
  )
}
