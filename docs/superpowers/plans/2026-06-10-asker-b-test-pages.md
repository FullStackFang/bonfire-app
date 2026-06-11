# Asker B-Test Implementation Plan (Part 2: Routes, Pages, Ops)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Prerequisite: Part 1 (`2026-06-10-asker-b-test-core.md`) is complete.**

**Goal:** Wire the Asker engine to the world — cron tick endpoint + GitHub Actions scheduler, tokenized link pages, mutation APIs, metrics SQL, deploy runbook.

**Architecture:** Server components read via `repo.ts` directly; mutations go through `app/api/*` route handlers that authenticate by member token in the JSON body; small `'use client'` islands post to them. Every tokenized page is `force-dynamic`. The serializer from Part 1 remains the only path round data takes to a client.

**Tech Stack:** Next.js 16.2.5 App Router (async `params`), Tailwind 4 classes, GitHub Actions cron.

---

### Task 12: Cron endpoint + GitHub Actions scheduler

**Files:**
- Create: `apps/web/app/api/cron/tick/route.ts`
- Create: `.github/workflows/asker-tick.yml`

- [ ] **Step 1: Create `apps/web/app/api/cron/tick/route.ts`**

```ts
import { runTick } from '@/lib/asker/tick'

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('x-cron-secret') !== secret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const summary = await runTick(new Date())
  return Response.json(summary)
}
```

- [ ] **Step 2: Create `.github/workflows/asker-tick.yml`**

GitHub cron has minutes of jitter; the engine's hour-wide ask windows + slot/dedupe keys make that harmless. Vercel Hobby cron is daily-only, which is why the scheduler lives here.

```yaml
name: asker-tick
on:
  schedule:
    - cron: '*/15 * * * *'
  workflow_dispatch: {}
jobs:
  tick:
    runs-on: ubuntu-latest
    steps:
      - name: Hit the tick endpoint
        run: |
          curl -fsS -X POST -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" "${{ secrets.TICK_URL }}"
```

(`TICK_URL` = `https://<deployment>/api/cron/tick`; secrets set in the runbook task.)

- [ ] **Step 3: Verify locally**

Run: `npm run dev:web`, then in another shell (PowerShell):
`Invoke-WebRequest -Method POST -Uri http://localhost:3000/api/cron/tick -Headers @{'x-cron-secret'='wrong'}` → expect 401.
With `$env:CRON_SECRET` set in `apps/web/.env.local` and the correct header → expect 200 JSON summary (zeros on an empty DB).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/cron/tick/route.ts .github/workflows/asker-tick.yml
git commit -m "feat(asker): cron tick endpoint + GitHub Actions scheduler"
```

---

### Task 13: Repo additions + auth glue

Three small repo functions Part 1 didn't need, plus the body-token helper all mutation routes share.

**Files:**
- Modify: `apps/web/lib/asker/repo.ts` (append)
- Create: `apps/web/lib/asker/auth.ts`

- [ ] **Step 1: Append to `apps/web/lib/asker/repo.ts`**

```ts
export async function getEventByRoundId(roundId: string): Promise<EventRow | null> {
  const [row] = await sql()`select * from asker.events where round_id = ${roundId}`
  return row ? toEvent(row) : null
}
export async function getVenueName(venueId: string): Promise<string | null> {
  const [row] = await sql()`select name from asker.venues where id = ${venueId}`
  return row ? (row.name as string) : null
}
/** Raw reply insert — used ONLY for the kindler's invisible auto-'in' on a queued round. */
export async function insertReply(roundId: string, memberId: string, answer: 'in' | 'out' | 'later'): Promise<void> {
  await sql()`
    insert into asker.replies (round_id, member_id, answer) values (${roundId}, ${memberId}, ${answer})
    on conflict (round_id, member_id) do update set answer = ${answer}, created_at = now()`
}
export async function getMemberByPhone(circleId: string, phone: string): Promise<Member | null> {
  const [row] = await sql()`select * from asker.members where circle_id = ${circleId} and phone = ${phone}`
  return row ? toMember(row) : null
}
```

- [ ] **Step 2: Create `apps/web/lib/asker/auth.ts`**

```ts
import { getMemberByToken } from './repo'
import type { Circle, Member } from './types'

export type Session = { member: Member; circle: Circle }

/** Resolve `{ token }` from a mutation request body. Returns the parsed body too. */
export async function sessionFromBody(request: Request): Promise<{ session: Session; body: any } | null> {
  let body: any
  try {
    body = await request.json()
  } catch {
    return null
  }
  if (typeof body?.token !== 'string') return null
  const session = await getMemberByToken(body.token)
  return session ? { session, body } : null
}
```

- [ ] **Step 3: Verify build, commit**

Run: `npm run build:web` → success.

```bash
git add apps/web/lib/asker/repo.ts apps/web/lib/asker/auth.ts
git commit -m "feat(asker): repo additions + token session helper"
```

---

### Task 14: Create-circle API + `/new` page

**Files:**
- Create: `apps/web/app/api/circles/route.ts`
- Create: `apps/web/app/new/page.tsx`
- Create: `apps/web/components/asker/NewCircleForm.tsx`

- [ ] **Step 1: Create `apps/web/app/api/circles/route.ts`**

```ts
import { createCircle } from '@/lib/asker/repo'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const k = Number(body?.kThreshold)
  if (!name || name.length > 60 || ![2, 3, 4].includes(k)) {
    return Response.json({ error: 'name (≤60 chars) and kThreshold (2-4) required' }, { status: 400 })
  }
  const circle = await createCircle(name, k)
  const base = process.env.APP_BASE_URL ?? 'http://localhost:3000'
  return Response.json({ circleId: circle.id, joinUrl: `${base}/join/${circle.id}` })
}
```

- [ ] **Step 2: Create `apps/web/components/asker/NewCircleForm.tsx`**

```tsx
'use client'
import { useState } from 'react'

export function NewCircleForm() {
  const [name, setName] = useState('')
  const [k, setK] = useState(2)
  const [joinUrl, setJoinUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (joinUrl) {
    return (
      <div className="space-y-3">
        <p className="text-amber-400">Circle created. Paste this into your group chat — it's the only chat-paste you'll ever do:</p>
        <code className="block break-all rounded bg-neutral-900 p-3 text-sm">{joinUrl}</code>
      </div>
    )
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        const res = await fetch('/api/circles', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, kThreshold: k }),
        })
        const data = await res.json()
        setBusy(false)
        if (res.ok) setJoinUrl(data.joinUrl)
      }}
    >
      <label className="block">
        <span className="text-sm text-neutral-400">Circle name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60}
          className="mt-1 w-full rounded bg-neutral-900 p-3" placeholder="Park Slope crew" />
      </label>
      <label className="block">
        <span className="text-sm text-neutral-400">Strike threshold (how many "in"s light it)</span>
        <select value={k} onChange={(e) => setK(Number(e.target.value))} className="mt-1 w-full rounded bg-neutral-900 p-3">
          <option value={2}>2 — strike easy (default)</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </label>
      <button disabled={busy} className="rounded bg-amber-500 px-4 py-2 font-medium text-black disabled:opacity-50">
        {busy ? '…' : 'Create circle'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Create `apps/web/app/new/page.tsx`**

```tsx
import { NewCircleForm } from '@/components/asker/NewCircleForm'

export const dynamic = 'force-dynamic'

export default function NewCirclePage() {
  return (
    <main className="mx-auto min-h-screen max-w-md bg-neutral-950 p-6 text-neutral-100">
      <h1 className="mb-1 text-2xl font-semibold">🔥 Start a circle</h1>
      <p className="mb-6 text-sm text-neutral-400">
        Verbs default to 🍜 ☕ 🏃 📺 and the asker's cadence defaults to Tue 5pm → Thu 7pm and Sun 11am → Sat 11am.
        Founders edit those in the database during the test.
      </p>
      <NewCircleForm />
    </main>
  )
}
```

- [ ] **Step 4: Verify in dev** — `npm run dev:web`, open `http://localhost:3000/new`, create a circle (requires `DATABASE_URL` in `apps/web/.env.local`), expect a join URL back.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/circles/route.ts apps/web/app/new/page.tsx apps/web/components/asker/NewCircleForm.tsx
git commit -m "feat(asker): create-circle API + /new page"
```

---

### Task 15: Join API + `/join/[circleId]` page

**Files:**
- Create: `apps/web/app/api/join/[circleId]/route.ts`
- Create: `apps/web/app/join/[circleId]/page.tsx`
- Create: `apps/web/components/asker/JoinForm.tsx`

- [ ] **Step 1: Create `apps/web/app/api/join/[circleId]/route.ts`**

Re-joining with the same phone resends the personal link instead of erroring — lost-link recovery for free.

```ts
import { newToken } from '@/lib/asker/ids'
import { normalizeUsPhone } from '@/lib/asker/phone'
import { copy } from '@/lib/asker/copy'
import { sendSms } from '@/lib/asker/sms'
import { deliverSms } from '@/lib/asker/twilio'
import * as repo from '@/lib/asker/repo'

export async function POST(request: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params
  const circle = await repo.getCircle(circleId).catch(() => null)
  if (!circle) return Response.json({ error: 'circle not found' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const phone = normalizeUsPhone(typeof body?.phone === 'string' ? body.phone : '')
  if (!name || name.length > 40) return Response.json({ error: 'name required (≤40 chars)' }, { status: 400 })
  if (!phone) return Response.json({ error: 'US phone number required' }, { status: 400 })
  if (body?.consent !== true) return Response.json({ error: 'consent required' }, { status: 400 })

  let member = await repo.getMemberByPhone(circleId, phone)
  if (!member) member = await repo.insertMember(circleId, name, phone, newToken())

  const base = process.env.APP_BASE_URL ?? 'http://localhost:3000'
  const link = `${base}/t/${member.token}`
  await sendSms(
    { alreadySent: async () => false, nonEventCountSince: async () => 0, log: repo.smsInsert, deliver: deliverSms },
    { member, kind: 'welcome', contextId: member.id, body: copy.welcome(circle.name, link), now: new Date() },
  )
  return Response.json({ link })
}
```

(Welcome bypasses dedupe/budget deliberately so a re-join always resends the link; it still logs. The `sms_log` unique key makes the second log a no-op.)

- [ ] **Step 2: Create `apps/web/components/asker/JoinForm.tsx`**

```tsx
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
```

- [ ] **Step 3: Create `apps/web/app/join/[circleId]/page.tsx`**

```tsx
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
```

- [ ] **Step 4: Verify in dev** — with `SMS_DRY_RUN=1`, join your test circle; expect the dry-run SMS in the dev server console and the link rendered.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/join apps/web/app/join apps/web/components/asker/JoinForm.tsx
git commit -m "feat(asker): join flow - phone identity, consent, welcome SMS with personal link"
```

---

### Task 16: Reply API + round page

**Files:**
- Create: `apps/web/app/api/rounds/[roundId]/reply/route.ts`
- Create: `apps/web/app/t/[token]/r/[roundId]/page.tsx`
- Create: `apps/web/components/asker/ReplyButtons.tsx`

- [ ] **Step 1: Create `apps/web/app/api/rounds/[roundId]/reply/route.ts`**

The response never carries counts. `struck` is only revealed at the moment the match fires — at which point the broadcast reveals it to everyone anyway.

```ts
import { sessionFromBody } from '@/lib/asker/auth'
import * as repo from '@/lib/asker/repo'
import { sendStrikeBroadcast } from '@/lib/asker/tick'

export async function POST(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params
  const auth = await sessionFromBody(request)
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const { session, body } = auth
  const answer = body?.answer
  if (!['in', 'out', 'later'].includes(answer)) return Response.json({ error: 'bad answer' }, { status: 400 })

  const round = await repo.getRound(roundId).catch(() => null)
  if (!round || round.circleId !== session.circle.id || round.state === 'queued') {
    return Response.json({ error: 'not found' }, { status: 404 })
  }
  const now = new Date()
  const result = await repo.replyAndMaybeStrike(roundId, session.member.id, answer, now)
  if (result.kind === 'struck') {
    await sendStrikeBroadcast(result.eventId, now)
    return Response.json({ state: 'struck', eventId: result.eventId })
  }
  return Response.json({ state: result.kind }) // 'recorded' | 'closed'
}
```

- [ ] **Step 2: Create `apps/web/components/asker/ReplyButtons.tsx`**

```tsx
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
```

- [ ] **Step 3: Create `apps/web/app/t/[token]/r/[roundId]/page.tsx`**

```tsx
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
      {pub.detail && <p className="mt-2 text-neutral-400">“{pub.detail}”</p>}
      <div className="mt-8">
        {pub.state === 'expired'
          ? <p className="text-neutral-500">This one quietly passed.</p>
          : <ReplyButtons roundId={pub.id} token={token} initial={pub.myAnswer} />}
      </div>
      <p className="mt-8 text-sm text-neutral-500">Nobody sees your answer till it's on.</p>
    </main>
  )
}
```

- [ ] **Step 4: Verify in dev** — seed a round via SQL (or wait for Task 17's kindle), open it from two member tokens, reply `in` from both with K=2, expect the second browser to land on the event page and dry-run strike SMS for every member in the console.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/rounds apps/web/app/t apps/web/components/asker/ReplyButtons.tsx
git commit -m "feat(asker): secret reply flow + round page; strike broadcasts on Kth in"
```

---

### Task 17: Kindle API + circle home

**Files:**
- Create: `apps/web/app/api/kindle/route.ts`
- Create: `apps/web/app/t/[token]/page.tsx`
- Create: `apps/web/components/asker/KindleForm.tsx`

- [ ] **Step 1: Create `apps/web/app/api/kindle/route.ts`**

```ts
import { sessionFromBody } from '@/lib/asker/auth'
import * as repo from '@/lib/asker/repo'
import { nextOccurrence } from '@/lib/asker/time'

export async function POST(request: Request) {
  const auth = await sessionFromBody(request)
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const { session, body } = auth
  const verb = session.circle.verbSet.find((v) => v.emoji === body?.verbEmoji)
  const dow = Number(body?.proposeDow)
  const hour = Number(body?.proposeHour)
  const detail = typeof body?.detail === 'string' && body.detail.trim() ? body.detail.trim().slice(0, 80) : null
  if (!verb || !Number.isInteger(dow) || dow < 0 || dow > 6 || !Number.isInteger(hour) || hour < 7 || hour > 23) {
    return Response.json({ error: 'verb, proposeDow (0-6), proposeHour (7-23) required' }, { status: 400 })
  }
  const now = new Date()
  const proposedAt = nextOccurrence(now, dow, hour)
  const round = await repo.insertRound({
    circleId: session.circle.id, verbEmoji: verb.emoji, verbLabel: verb.label,
    proposedAt, closesAt: new Date(proposedAt.getTime() - 2 * 3600_000),
    detail, source: 'kindled', state: 'queued', cadenceSlot: null,
  })
  if (!round) return Response.json({ error: 'could not kindle' }, { status: 500 })
  await repo.insertReply(round.id, session.member.id, 'in') // the kindler's invisible auto-in
  // Deliberately no round id in the response and no special UI state:
  // the round surfaces at the next send window looking exactly like a scheduled ask.
  return Response.json({ ok: true })
}
```

- [ ] **Step 2: Create `apps/web/components/asker/KindleForm.tsx`**

```tsx
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
          body: JSON.stringify({ token, verbEmoji: verb, proposeDow: dow, proposeHour: hour, detail }),
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
```

- [ ] **Step 3: Create `apps/web/app/t/[token]/page.tsx`** (circle home)

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import * as repo from '@/lib/asker/repo'
import { serializeRound } from '@/lib/asker/serialize'
import { whenLabel, whenShort } from '@/lib/asker/copy'
import { KindleForm } from '@/components/asker/KindleForm'

export const dynamic = 'force-dynamic'

export default async function CircleHome({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await repo.getMemberByToken(token).catch(() => null)
  if (!session) notFound()
  const { member, circle } = session
  const now = new Date()
  const open = await repo.openRoundsForCircle(circle.id)
  const rounds = await Promise.all(
    open.map(async (r) => serializeRound(r, await repo.getMyReply(r.id, member.id))),
  )
  const events = await repo.eventsForCircle(circle.id, ['on'])
  const upcoming = await Promise.all(events.map(async (e) => {
    const round = await repo.getRound(e.roundId)
    return { id: e.id, emoji: round!.verbEmoji, when: whenShort(e.happensAt, now) }
  }))
  return (
    <main className="mx-auto min-h-screen max-w-md bg-neutral-950 p-6 text-neutral-100">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">🔥 {circle.name}</h1>
        <Link href={`/t/${token}/places`} className="text-sm text-amber-400 underline">places</Link>
      </div>

      <section className="mt-6">
        <h2 className="text-sm uppercase tracking-wide text-neutral-500">Open asks</h2>
        {rounds.length === 0 && <p className="mt-2 text-neutral-500">Quiet right now. The asker will speak up.</p>}
        <ul className="mt-2 space-y-2">
          {rounds.map((r) => (
            <li key={r.id}>
              <Link href={`/t/${token}/r/${r.id}`} className="flex items-center justify-between rounded bg-neutral-900 p-3">
                <span>{r.verbEmoji} {whenLabel(new Date(r.proposedAt), now)}</span>
                <span className="text-sm text-neutral-400">{r.myAnswer ? `you: ${r.myAnswer}` : 'answer →'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm uppercase tracking-wide text-neutral-500">It's on</h2>
        {upcoming.length === 0 && <p className="mt-2 text-neutral-500">Nothing struck yet.</p>}
        <ul className="mt-2 space-y-2">
          {upcoming.map((e) => (
            <li key={e.id}>
              <Link href={`/t/${token}/e/${e.id}`} className="block rounded bg-amber-950/40 p-3">
                {e.emoji} {e.when} — it's on →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 border-t border-neutral-800 pt-6">
        <h2 className="mb-3 text-sm uppercase tracking-wide text-neutral-500">Down for something?</h2>
        <KindleForm token={token} verbs={circle.verbSet} />
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Verify in dev** — kindle from one member; confirm the home page shows **no trace** of the queued round; manually run the tick (Task 12 curl) during a send window (or temporarily set a cadence askHour to the current NY hour via SQL) and watch the ask SMS go out to all members in dry-run.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/kindle apps/web/app/t/[token]/page.tsx apps/web/components/asker/KindleForm.tsx
git commit -m "feat(asker): quiet kindling + circle home"
```

---

### Task 18: Event APIs + event page (hold, walk-in, venue)

**Files:**
- Create: `apps/web/app/api/events/[eventId]/attendance/route.ts`
- Create: `apps/web/app/api/events/[eventId]/venue/route.ts`
- Create: `apps/web/app/t/[token]/e/[eventId]/page.tsx`
- Create: `apps/web/components/asker/EventActions.tsx`

- [ ] **Step 1: Create `apps/web/app/api/events/[eventId]/attendance/route.ts`**

```ts
import { sessionFromBody } from '@/lib/asker/auth'
import * as repo from '@/lib/asker/repo'

const ALLOWED = ['in', 'confirmed', 'out', 'omw', 'here'] as const

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const auth = await sessionFromBody(request)
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const { session, body } = auth
  const state = body?.state
  const eta = Number.isInteger(body?.etaMinutes) ? (body.etaMinutes as number) : null
  if (!ALLOWED.includes(state)) return Response.json({ error: 'bad state' }, { status: 400 })
  const event = await repo.getEvent(eventId).catch(() => null)
  if (!event || event.circleId !== session.circle.id) return Response.json({ error: 'not found' }, { status: 404 })
  if (event.state !== 'on') return Response.json({ error: 'event is not live' }, { status: 409 })
  await repo.setAttendance(eventId, session.member.id, state, state === 'omw' ? eta : null)
  return Response.json({ ok: true })
}
```

- [ ] **Step 2: Create `apps/web/app/api/events/[eventId]/venue/route.ts`**

```ts
import { sessionFromBody } from '@/lib/asker/auth'
import * as repo from '@/lib/asker/repo'

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const auth = await sessionFromBody(request)
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const { session, body } = auth
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : ''
  if (!name) return Response.json({ error: 'venue name required' }, { status: 400 })
  const event = await repo.getEvent(eventId).catch(() => null)
  if (!event || event.circleId !== session.circle.id) return Response.json({ error: 'not found' }, { status: 404 })
  await repo.setEventVenue(eventId, session.circle.id, name)
  return Response.json({ ok: true })
}
```

- [ ] **Step 3: Create `apps/web/components/asker/EventActions.tsx`**

```tsx
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
```

- [ ] **Step 4: Create `apps/web/app/t/[token]/e/[eventId]/page.tsx`**

Absence is never displayed: only in/confirmed/omw/here rows render. No out-list exists anywhere.

```tsx
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
          <h1 className="mt-4 text-3xl">It's ON: {round!.verbEmoji} {whenShort(event.happensAt, now)}</h1>
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
            {event.state === 'done' && <p className="text-neutral-500">This one's in the books.</p>}
          </div>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 5: Verify in dev** — strike a round (two `in`s), open the event from a third member's token, Join, set omw/here, set a venue. Confirm no UI anywhere lists who is out or silent.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/events apps/web/app/t/[token]/e apps/web/components/asker/EventActions.tsx
git commit -m "feat(asker): event page - join, hold confirm, walk-in states, venue; absence never displayed"
```

---

### Task 19: Places (return-glow) + view beacon + exit poll

**Files:**
- Create: `apps/web/lib/asker/places.ts`
- Test: `apps/web/lib/asker/places.test.ts`
- Create: `apps/web/app/api/views/route.ts`
- Create: `apps/web/app/api/exit/[eventId]/route.ts`
- Create: `apps/web/components/asker/ViewBeacon.tsx`
- Create: `apps/web/components/asker/ExitButtons.tsx`
- Create: `apps/web/app/t/[token]/places/page.tsx`
- Create: `apps/web/app/t/[token]/x/[eventId]/page.tsx`

- [ ] **Step 1: Write the failing test** — `apps/web/lib/asker/places.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { glowOpacity } from './places'

describe('glowOpacity — return-glow rewards depth, not novelty', () => {
  it('scales from a dim floor to full brightness at the max', () => {
    expect(glowOpacity(1, 4)).toBeCloseTo(0.35 + 0.65 * 0.25)
    expect(glowOpacity(4, 4)).toBe(1)
  })
  it('handles the single-venue case', () => {
    expect(glowOpacity(1, 1)).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test --workspace=apps/web`
Expected: FAIL — `Cannot find module './places'`

- [ ] **Step 3: Implement `apps/web/lib/asker/places.ts`**

```ts
/** Brightness ∝ repeat visits. Floor keeps single visits visible; max glows fully. */
export function glowOpacity(visits: number, maxVisits: number): number {
  if (maxVisits <= 0) return 0.35
  return 0.35 + 0.65 * (visits / maxVisits)
}
```

- [ ] **Step 4: Run to verify pass** — `npm run test --workspace=apps/web` → PASS

- [ ] **Step 5: Create the two small APIs**

`apps/web/app/api/views/route.ts`:

```ts
import { sessionFromBody } from '@/lib/asker/auth'
import { logPageView } from '@/lib/asker/repo'

export async function POST(request: Request) {
  const auth = await sessionFromBody(request)
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const page = typeof auth.body?.page === 'string' ? auth.body.page.slice(0, 40) : 'unknown'
  await logPageView(auth.session.member.id, page)
  return Response.json({ ok: true })
}
```

`apps/web/app/api/exit/[eventId]/route.ts`:

```ts
import { sessionFromBody } from '@/lib/asker/auth'
import * as repo from '@/lib/asker/repo'

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const auth = await sessionFromBody(request)
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (typeof auth.body?.wouldHaveHappened !== 'boolean') {
    return Response.json({ error: 'wouldHaveHappened boolean required' }, { status: 400 })
  }
  const event = await repo.getEvent(eventId).catch(() => null)
  if (!event || event.circleId !== auth.session.circle.id) return Response.json({ error: 'not found' }, { status: 404 })
  await repo.insertExitPoll(eventId, auth.session.member.id, auth.body.wouldHaveHappened)
  return Response.json({ ok: true })
}
```

- [ ] **Step 6: Create the client islands**

`apps/web/components/asker/ViewBeacon.tsx`:

```tsx
'use client'
import { useEffect, useRef } from 'react'

export function ViewBeacon({ token, page }: { token: string; page: string }) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    fetch('/api/views', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, page }),
    }).catch(() => {})
  }, [token, page])
  return null
}
```

`apps/web/components/asker/ExitButtons.tsx`:

```tsx
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
```

- [ ] **Step 7: Create the pages**

`apps/web/app/t/[token]/places/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import * as repo from '@/lib/asker/repo'
import { glowOpacity } from '@/lib/asker/places'
import { ViewBeacon } from '@/components/asker/ViewBeacon'

export const dynamic = 'force-dynamic'

export default async function PlacesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await repo.getMemberByToken(token).catch(() => null)
  if (!session) notFound()
  const places = await repo.placesForCircle(session.circle.id)
  const max = places.reduce((m, p) => Math.max(m, p.visits), 0)
  return (
    <main className="mx-auto min-h-screen max-w-md bg-neutral-950 p-6 text-neutral-100">
      <ViewBeacon token={token} page="places" />
      <h1 className="text-2xl font-semibold">Places</h1>
      <p className="mt-1 text-sm text-neutral-500">Spots brighten every time you go back.</p>
      {places.length === 0 && <p className="mt-6 text-neutral-500">Nowhere yet. That changes the first time it's on.</p>}
      <ul className="mt-6 space-y-2">
        {places.map((p) => (
          <li key={p.name} className="flex justify-between rounded bg-neutral-900 px-3 py-3 text-lg"
            style={{ color: `rgba(251, 191, 36, ${glowOpacity(p.visits, max)})` }}>
            <span>{p.name}</span>
            <span>×{p.visits}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

`apps/web/app/t/[token]/x/[eventId]/page.tsx`:

```tsx
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
  return (
    <main className="mx-auto min-h-screen max-w-md bg-neutral-950 p-6 text-neutral-100">
      <h1 className="text-2xl">Would last night have happened without this?</h1>
      <p className="mt-2 text-sm text-neutral-500">One tap. Honest answers are the whole test.</p>
      <div className="mt-6"><ExitButtons eventId={eventId} token={token} /></div>
    </main>
  )
}
```

- [ ] **Step 8: Run the whole suite + build**

Run: `npm run test --workspace=apps/web` → PASS. `npm run build:web` → success.

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/asker/places.ts apps/web/lib/asker/places.test.ts apps/web/app/api/views apps/web/app/api/exit apps/web/components/asker/ViewBeacon.tsx apps/web/components/asker/ExitButtons.tsx apps/web/app/t/[token]/places apps/web/app/t/[token]/x
git commit -m "feat(asker): return-glow places + view instrumentation + exit poll"
```

---

### Task 20: metrics-b.sql

**Files:**
- Create: `supabase/metrics-b.sql`

- [ ] **Step 1: Write `supabase/metrics-b.sql`** (every number in the readout is one of these; no dashboard)

```sql
-- Asker B-test metrics (spec v3.0). Run ad hoc; nothing else reads these.

-- 1. PRIMARY: struck hangs that happened (>=2 'here'), per circle per ISO week
select c.name, to_char(e.happens_at at time zone 'America/New_York', 'IYYY-"W"IW') as week,
       count(*) as hangs_happened
from asker.events e
join asker.circles c on c.id = e.circle_id
where (select count(*) from asker.attendance a where a.event_id = e.id and a.state = 'here') >= 2
group by 1, 2 order by 1, 2;

-- 2. PRIMARY: exit-poll incrementality (target: >=50% answering "no")
select c.name,
       count(*) filter (where not x.would_have_happened) as said_no,
       count(*) as total,
       round(100.0 * count(*) filter (where not x.would_have_happened) / nullif(count(*), 0), 0) as pct_incremental
from asker.exit_polls x
join asker.events e on e.id = x.event_id
join asker.circles c on c.id = e.circle_id
group by 1;

-- 3. Reply rate per round (is the asker heard? <40% by week 2 = iterate cadence/verbs)
select c.name, r.verb_emoji, r.proposed_at::date,
       (select count(*) from asker.replies rep where rep.round_id = r.id) as replies,
       (select count(*) from asker.members m where m.circle_id = c.id) as members,
       r.state
from asker.rounds r join asker.circles c on c.id = r.circle_id
where r.state <> 'queued'
order by r.proposed_at;

-- 4. Silent-expiry rate (liquidity health; expect high early, falling)
select c.name,
       count(*) filter (where r.state = 'expired') as expired,
       count(*) filter (where r.state = 'struck') as struck,
       round(100.0 * count(*) filter (where r.state = 'expired')
             / nullif(count(*) filter (where r.state in ('expired','struck')), 0), 0) as pct_expired
from asker.rounds r join asker.circles c on c.id = r.circle_id
group by 1;

-- 5. Hold rate (flake disease: held / holds opened; <50% = tighten windows)
select c.name,
       count(*) filter (where e.hold_decided_at is not null and e.state <> 'fell_through') as held,
       count(*) filter (where e.hold_opened_at is not null) as holds_opened
from asker.events e join asker.circles c on c.id = e.circle_id
group by 1;

-- 6. later -> in conversion (two-tenses value): later-nudged members who ended up confirmed/here
select count(distinct (l.member_id, l.context_id)) filter (
         where exists (
           select 1 from asker.events e
           join asker.attendance a on a.event_id = e.id and a.member_id = l.member_id
           where e.round_id = l.context_id and a.state in ('confirmed','here')))
       as converted,
       count(distinct (l.member_id, l.context_id)) as nudged
from asker.sms_log l where l.kind = 'later_nudge';

-- 7. Strike concentration (same two people eating the product? tune K / composition)
select c.name, m.name as member,
       count(*) as times_in,
       round(100.0 * count(*) / nullif(sum(count(*)) over (partition by c.id), 0), 0) as pct_of_all_ins
from asker.attendance a
join asker.events e on e.id = a.event_id
join asker.circles c on c.id = e.circle_id
join asker.members m on m.id = a.member_id
where a.state in ('in','confirmed','omw','here')
group by c.id, c.name, m.name order by c.name, times_in desc;

-- 8. Places-tab opens (the free map-pull signal)
select c.name, count(*) as opens, count(distinct p.member_id) as distinct_members
from asker.page_views p
join asker.members m on m.id = p.member_id
join asker.circles c on c.id = m.circle_id
where p.page = 'places'
group by 1;

-- 9. SMS volume by kind per NY day (budget sanity)
select (sent_at at time zone 'America/New_York')::date as ny_day, kind, count(*)
from asker.sms_log group by 1, 2 order by 1, 2;

-- 10. Circle coverage (joined members; compare to chat headcount in the run log)
select c.name, count(m.id) as joined from asker.circles c
left join asker.members m on m.circle_id = c.id group by 1;
```

- [ ] **Step 2: Verify** — with local Supabase up: `supabase db reset`, then run the file: `psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -f supabase/metrics-b.sql` → all queries execute (empty results fine).

- [ ] **Step 3: Commit**

```bash
git add supabase/metrics-b.sql
git commit -m "feat(asker): metrics-b.sql - readout queries, committed day one per spec"
```

---

### Task 21: Env example, runbook, final verification

**Files:**
- Create: `apps/web/.env.example`
- Modify: `apps/web/README.md` (replace contents)
- Create: `docs/superpowers/specs/2026-06-10-b-test-run-log.md`

- [ ] **Step 1: Create `apps/web/.env.example`**

```bash
# Supabase transaction pooler (Settings -> Database -> Connection string -> Transaction)
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
# Public base URL of this deployment (no trailing slash)
APP_BASE_URL=http://localhost:3000
# Shared secret for /api/cron/tick (also a GitHub Actions secret)
CRON_SECRET=change-me
# Twilio (leave SMS_DRY_RUN=1 until launch day)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=+1xxxxxxxxxx
SMS_DRY_RUN=1
```

- [ ] **Step 2: Replace `apps/web/README.md`**

```markdown
# Bonfire — the Asker (B-test)

Spec: `docs/superpowers/specs/2026-06-10-bonfire-mvp-spec-v3.0.md`. SMS-railed, appless, server-side only.

## Local dev

1. `supabase start && supabase db reset` (Docker)
2. `cp apps/web/.env.example apps/web/.env.local`, set `DATABASE_URL` to the local connection string
   (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`), keep `SMS_DRY_RUN=1`
3. `npm run dev:web` → http://localhost:3000/new
4. Tests: `npm run test --workspace=apps/web`. Integration tests need
   `TEST_DATABASE_URL` set to the local connection string.
5. To exercise the tick by hand:
   `Invoke-WebRequest -Method POST -Uri http://localhost:3000/api/cron/tick -Headers @{'x-cron-secret'='change-me'}`

## Deploy (Vercel)

1. Vercel project root: `apps/web`. Build command default; the repo pins webpack via `--webpack`.
2. `supabase link --project-ref <ref> && supabase db push` (applies `20260611000000_asker_schema.sql`).
3. Set env vars in Vercel: `DATABASE_URL` (transaction pooler URL), `APP_BASE_URL` (the deployment URL),
   `CRON_SECRET`, Twilio trio, `SMS_DRY_RUN` (=1 until launch day, then remove).
4. GitHub repo secrets: `TICK_URL=https://<deployment>/api/cron/tick`, `CRON_SECRET` (same value).
   The workflow `.github/workflows/asker-tick.yml` fires every ~15 min (GitHub adds jitter; the engine tolerates it).
5. Twilio: buy a US number. Honest note: unregistered 10DLC traffic can get carrier-filtered;
   for ~40 testers either complete toll-free verification or accept some filtering risk and
   watch `sms_log` for `[FAILED]` bodies on launch night.

## Launch checklist (per circle)

1. Founder scrolls the group chat back 4 weeks, counts hangs that happened, logs the number in
   `docs/superpowers/specs/2026-06-10-b-test-run-log.md` **before** inviting anyone.
2. `/new` → create circle (K=2 unless the circle is >8 people).
3. Adjust cadence/verbs in SQL if the defaults don't fit the group
   (`update asker.circles set cadence = '[...]', verb_set = '[...]' where id = ...`).
4. Paste the join link into the group chat — the only chat-paste, ever.
5. Flip `SMS_DRY_RUN` off. Watch the first ask go out at the next send window.

## Invariants (do not break)

- `rounds.source` and reply counts never reach a client. `serializeRound` is the only round serializer.
- Absence is never displayed: no out-lists, no silence-lists, anywhere.
- All sends dedupe on `(member, kind, context)`; non-event SMS ≤1/member/day; rounds ≤1/day, ≤3/week per circle.
```

- [ ] **Step 3: Create `docs/superpowers/specs/2026-06-10-b-test-run-log.md`**

```markdown
# B-test run log

Pre-registered success line (spec v3.0): ≥6 struck hangs that happened across circles over 3 clean
weeks AND ≥50% of exit polls answering "no". Ratified by founders before circle #1 launch: ☐

## Baselines (fill BEFORE inviting each circle)

| Circle | Chat members | Hangs in prior 4 weeks (founder scrollback count) | Logged by | Date |
|---|---|---|---|---|
| #0 (founders) | | | | |
| #1 | | | | |
| #2 | | | | |

## Feature availability

| Date | What shipped mid-run |
|---|---|
| | |

## Weekly debriefs

| Week | Circle | Notes (verb fit, cadence fit, K, anything weird) | Changes made |
|---|---|---|---|
| | | | |
```

- [ ] **Step 4: Final verification**

Run, in order:
1. `npm run test --workspace=apps/web` → all unit tests PASS
2. With local Supabase: `$env:TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'; npm run test --workspace=apps/web` → integration PASS
3. `npm run build:web` → success
4. Secrecy grep: `grep -rn "source" apps/web/app apps/web/components` → no hits referencing round source
5. End-to-end dry run: create circle → join 3 members (3 phones or 3 browser profiles) → kindle → force a send window via SQL cadence edit → tick → reply in×2 → strike broadcast in console → event page → here×2 → tick past T+3h (edit `happens_at` in SQL to simulate) → done → tick in the 9-11am NY window → exit poll SMS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/.env.example apps/web/README.md docs/superpowers/specs/2026-06-10-b-test-run-log.md
git commit -m "docs(asker): env example, deploy runbook, run log template"
```

---

## Self-review (spec v3.0 coverage)

| Spec section | Where |
|---|---|
| The Ask — scheduled + kindled, indistinguishable | Tasks 10, 17 (queue + windowed release; serializer test Task 7) |
| The Pool — secret ballot, no counts anywhere | Tasks 7, 9 (serializer; reply API returns no counts; server-only repo) |
| The Strike — immediate at K, broadcast to whole circle, exactly-once | Task 9 (FOR UPDATE transaction + concurrency test), Task 11 (broadcast), Task 16 |
| The Hold — T-5h confirm, T-2h decision, app takes the blame | Tasks 9 (needs_hold at strike), 10, 11, 18 |
| Walk-in — omw/here, self-reported minutes | Tasks 11 (t0), 18. **Spec deviation, logged:** spec said one-geolocation-read ETA; venues are free-text (no coords), so v1 ships self-reported 5/15/30 — strictly better privacy, revisit if venues gain coordinates. |
| Ledger — phone-number identity, confirms not coordinates | Tasks 2, 15 (no lat/lng anywhere in schema) |
| Return-glow Places + passive instrument | Task 19 (glow + ViewBeacon), metric 8 |
| Verbs — 4 defaults, replies in/out/later only | Tasks 2 (default verb_set), 16, 17 |
| SMS budget ≤1 non-event/day, rounds ≤1/day ≤3/week, dedupe | Tasks 8, 10, 11 |
| Copy table (canon) | Task 6 (frozen by tests) |
| Exit poll to attendees next morning | Tasks 11 (9-11am NY gate), 19 |
| Cron/scheduler | Task 12 (GH Actions — Vercel Hobby cron is daily-only) |
| metrics-b.sql day one | Task 20 |
| Baselines + pre-registration | Task 21 run log |
| Not building: audience picking, public counts, chat, profiles, fire/map/torch/vouch | absent by construction; secrecy grep in Task 21 |

Type-consistency check: `repo.ts` names used by `tick.ts`/routes match (`getMemberByToken`, `replyAndMaybeStrike`, `eventsNeedingHoldOpen`, `setAttendance`, `placesForCircle`, …) — verified while writing; `npm run build:web` enforces it mechanically at each task.
