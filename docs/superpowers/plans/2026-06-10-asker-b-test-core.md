# Asker B-Test Implementation Plan (Part 1: Foundations + Engine)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Asker engine per `docs/superpowers/specs/2026-06-10-bonfire-mvp-spec-v3.0.md` — app-prompted kindling rounds with secret pooling, threshold strike, hold/walk-in flows, SMS rail, tokenized link pages.

**Architecture:** All state in a new `asker` Postgres schema (existing Supabase project; no collision with v1 tables). All access server-side via `postgres` (postgres-js) from Next.js route handlers and server components — single code path enforces pre-strike secrecy. SMS via Twilio behind a transport interface with a dry-run mode. One idempotent cron tick (driven by GitHub Actions every 15 min) advances all time-based state.

**Tech Stack:** Next.js 16.2.5 (App Router, webpack flag), TypeScript strict, postgres-js, Twilio, vitest, Supabase CLI migrations, Tailwind 4 (already configured).

**Continues in:** `2026-06-10-asker-b-test-pages.md` (Part 2: API routes, pages, metrics, runbook). Both parts are one feature; execute in order.

---

## Conventions (read first)

- **Next 16:** `params` is a `Promise` — always `const { x } = await params`. Route handlers use Web `Request`/`Response`. Tokenized pages export `const dynamic = 'force-dynamic'`.
- **Days of week:** JS convention everywhere — `0=Sun … 6=Sat`.
- **Time zone:** all wall-clock logic in `America/New_York` via helpers in `lib/asker/time.ts`. DB stores `timestamptz`.
- **Secrecy invariant:** `rounds.source` and reply counts must never appear in any client-bound payload. The serializer (Task 7) is the only way round data leaves the server.
- **All SQL schema-qualified** (`asker.rounds`) — no search_path tricks.
- **Run tests:** `npm run test --workspace=apps/web` from repo root. Expected output shown per step.
- **Commits:** after every green step, exactly as written.

---

### Task 1: Test harness + dependencies

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.mts`
- Create: `apps/web/lib/asker/harness.test.ts`

- [ ] **Step 1: Install dependencies**

```bash
npm install postgres twilio --workspace=apps/web
npm install -D vitest vite-tsconfig-paths --workspace=apps/web
```

- [ ] **Step 2: Add test scripts to `apps/web/package.json`**

In the `"scripts"` block add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `apps/web/vitest.config.mts`**

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Write a harness smoke test** — `apps/web/lib/asker/harness.test.ts`

```ts
import { describe, it, expect } from 'vitest'

describe('harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run it**

Run: `npm run test --workspace=apps/web`
Expected: `1 passed`

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.mts apps/web/lib/asker/harness.test.ts package-lock.json
git commit -m "chore(asker): vitest harness + postgres/twilio deps"
```

---

### Task 2: The `asker` schema migration

**Files:**
- Create: `supabase/migrations/20260611000000_asker_schema.sql`

No TDD for DDL; verification is applying it.

- [ ] **Step 1: Write the migration**

```sql
-- Asker B-test schema (spec v3.0). Isolated from v1 public tables.
-- All access is server-side via service connection; no RLS, no PostgREST exposure.
create schema if not exists asker;

create table asker.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  verb_set jsonb not null default '[{"emoji":"🍜","label":"dinner"},{"emoji":"☕","label":"coffee"},{"emoji":"🏃","label":"move"},{"emoji":"📺","label":"couch"}]',
  k_threshold int not null default 2 check (k_threshold between 2 and 4),
  -- [{askDow,askHour,verb:'rotate'|emoji,proposeDow,proposeHour}], dow 0=Sun
  cadence jsonb not null default '[{"askDow":2,"askHour":17,"verb":"rotate","proposeDow":4,"proposeHour":19},{"askDow":0,"askHour":11,"verb":"rotate","proposeDow":6,"proposeHour":11}]',
  created_at timestamptz not null default now()
);

create table asker.members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references asker.circles(id),
  name text not null,
  phone text not null, -- E.164
  token text not null unique,
  sms_consent_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  unique (circle_id, phone)
);

create table asker.rounds (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references asker.circles(id),
  verb_emoji text not null,
  verb_label text not null,
  proposed_at timestamptz not null,
  closes_at timestamptz not null,
  detail text, -- kindler's one unattributed line
  source text not null check (source in ('scheduled','kindled')), -- NEVER serialized
  state text not null default 'open' check (state in ('queued','open','struck','expired')),
  cadence_slot text, -- idempotency key for scheduled rounds, e.g. '2026-W25-t0'
  created_at timestamptz not null default now(),
  unique (circle_id, cadence_slot)
);
create index rounds_circle_state_idx on asker.rounds (circle_id, state);

create table asker.replies (
  round_id uuid not null references asker.rounds(id),
  member_id uuid not null references asker.members(id),
  answer text not null check (answer in ('in','out','later')),
  created_at timestamptz not null default now(),
  primary key (round_id, member_id)
);

create table asker.venues (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references asker.circles(id),
  name text not null,
  unique (circle_id, name)
);

create table asker.events (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null unique references asker.rounds(id),
  circle_id uuid not null references asker.circles(id),
  happens_at timestamptz not null,
  venue_id uuid references asker.venues(id),
  state text not null default 'on' check (state in ('on','fell_through','done')),
  needs_hold boolean not null default false,
  hold_opened_at timestamptz,
  hold_decided_at timestamptz,
  exit_polls_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index events_circle_state_idx on asker.events (circle_id, state);

create table asker.attendance (
  event_id uuid not null references asker.events(id),
  member_id uuid not null references asker.members(id),
  state text not null check (state in ('in','confirmed','out','omw','here')),
  eta_minutes int,
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);

create table asker.exit_polls (
  event_id uuid not null references asker.events(id),
  member_id uuid not null references asker.members(id),
  would_have_happened boolean not null,
  created_at timestamptz not null default now(),
  primary key (event_id, member_id)
);

create table asker.page_views (
  id bigint generated always as identity primary key,
  member_id uuid not null references asker.members(id),
  page text not null,
  created_at timestamptz not null default now()
);

create table asker.sms_log (
  id bigint generated always as identity primary key,
  member_id uuid not null references asker.members(id),
  kind text not null check (kind in ('welcome','ask','strike','hold','t0','fell_through','exit_poll','later_nudge')),
  context_id uuid not null, -- round/event/member id the message is about; dedupe key
  body text not null,
  sent_at timestamptz not null default now(),
  unique (member_id, kind, context_id)
);
create index sms_log_member_sent_idx on asker.sms_log (member_id, sent_at);
```

- [ ] **Step 2: Apply locally**

Run: `supabase db reset` (requires Docker + `supabase start` per `supabase/README.md`).
Expected: all migrations apply, including `20260611000000_asker_schema.sql`, no errors. If no local Supabase, defer to the deploy runbook's `supabase db push` and verify there.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260611000000_asker_schema.sql
git commit -m "feat(asker): schema migration - circles, members, rounds, replies, events, attendance, sms_log"
```

---

### Task 3: Types + token generation

**Files:**
- Create: `apps/web/lib/asker/types.ts`
- Create: `apps/web/lib/asker/ids.ts`
- Test: `apps/web/lib/asker/ids.test.ts`

- [ ] **Step 1: Create `apps/web/lib/asker/types.ts`** (shared shapes; no test — types only)

```ts
export type Verb = { emoji: string; label: string }

// dow: 0=Sun..6=Sat, hours in America/New_York
export type CadenceTemplate = {
  askDow: number
  askHour: number
  verb: string // emoji from verbSet, or 'rotate'
  proposeDow: number
  proposeHour: number
}

export type Circle = {
  id: string
  name: string
  verbSet: Verb[]
  kThreshold: number
  cadence: CadenceTemplate[]
}

export type Member = {
  id: string
  circleId: string
  name: string
  phone: string
  token: string
}

export type RoundState = 'queued' | 'open' | 'struck' | 'expired'
export type RoundSource = 'scheduled' | 'kindled'

export type Round = {
  id: string
  circleId: string
  verbEmoji: string
  verbLabel: string
  proposedAt: Date
  closesAt: Date
  detail: string | null
  source: RoundSource
  state: RoundState
  cadenceSlot: string | null
}

export type EventState = 'on' | 'fell_through' | 'done'

export type EventRow = {
  id: string
  roundId: string
  circleId: string
  happensAt: Date
  venueId: string | null
  state: EventState
  needsHold: boolean
  holdOpenedAt: Date | null
  holdDecidedAt: Date | null
  exitPollsSentAt: Date | null
}

export type AttendanceState = 'in' | 'confirmed' | 'out' | 'omw' | 'here'

export type Attendance = {
  eventId: string
  memberId: string
  state: AttendanceState
  etaMinutes: number | null
}

export type SmsKind =
  | 'welcome' | 'ask' | 'strike' | 'hold' | 't0'
  | 'fell_through' | 'exit_poll' | 'later_nudge'

export const NON_EVENT_KINDS: SmsKind[] = ['welcome', 'ask', 'later_nudge']
```

- [ ] **Step 2: Write the failing test** — `apps/web/lib/asker/ids.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { newToken } from './ids'

describe('newToken', () => {
  it('is url-safe and long enough to be unguessable', () => {
    const t = newToken()
    expect(t).toMatch(/^[A-Za-z0-9_-]{24,}$/)
  })
  it('is unique across calls', () => {
    const seen = new Set(Array.from({ length: 100 }, () => newToken()))
    expect(seen.size).toBe(100)
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npm run test --workspace=apps/web`
Expected: FAIL — `Cannot find module './ids'`

- [ ] **Step 4: Implement `apps/web/lib/asker/ids.ts`**

```ts
import { randomBytes } from 'node:crypto'

export function newToken(): string {
  return randomBytes(18).toString('base64url') // 24 chars
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm run test --workspace=apps/web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/asker/types.ts apps/web/lib/asker/ids.ts apps/web/lib/asker/ids.test.ts
git commit -m "feat(asker): shared types + unguessable member tokens"
```

---

### Task 4: New York time helpers

All scheduling correctness lives here. June 2026 is EDT (UTC-4); Jan is EST (UTC-5) — tests cover both.

**Files:**
- Create: `apps/web/lib/asker/time.ts`
- Test: `apps/web/lib/asker/time.test.ts`

- [ ] **Step 1: Write the failing tests** — `apps/web/lib/asker/time.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import {
  nyParts, nyDayKey, isoWeek, slotKey, zonedNyToUtc,
  nextOccurrence, matchesAskWindow, nyDayStartUtc, nyWeekStartUtc,
} from './time'

// Tue Jun 9 2026 17:05 EDT == 21:05Z
const TUE_1705 = new Date('2026-06-09T21:05:00Z')

describe('nyParts', () => {
  it('converts UTC instants to NY wall clock (EDT)', () => {
    expect(nyParts(TUE_1705)).toMatchObject({ dow: 2, hour: 17, minute: 5 })
  })
  it('handles EST (winter)', () => {
    // Mon Jan 12 2026 09:30 EST == 14:30Z
    expect(nyParts(new Date('2026-01-12T14:30:00Z'))).toMatchObject({ dow: 1, hour: 9, minute: 30 })
  })
})

describe('zonedNyToUtc', () => {
  it('builds the UTC instant for an NY wall time (EDT)', () => {
    expect(zonedNyToUtc(2026, 6, 11, 19, 0).toISOString()).toBe('2026-06-11T23:00:00.000Z')
  })
  it('builds the UTC instant for an NY wall time (EST)', () => {
    expect(zonedNyToUtc(2026, 1, 15, 19, 0).toISOString()).toBe('2026-01-16T00:00:00.000Z')
  })
})

describe('nextOccurrence', () => {
  it('finds the next Thu 19:00 NY after a Tuesday evening', () => {
    expect(nextOccurrence(TUE_1705, 4, 19).toISOString()).toBe('2026-06-11T23:00:00.000Z')
  })
  it('rolls to next week when the slot already passed', () => {
    // Fri Jun 12 2026 10:00 EDT
    const fri = new Date('2026-06-12T14:00:00Z')
    expect(nextOccurrence(fri, 4, 19).toISOString()).toBe('2026-06-18T23:00:00.000Z')
  })
  it('same-day later hour counts as next occurrence', () => {
    expect(nextOccurrence(TUE_1705, 2, 19).toISOString()).toBe('2026-06-09T23:00:00.000Z')
  })
})

describe('matchesAskWindow', () => {
  const t = { askDow: 2, askHour: 17, verb: 'rotate', proposeDow: 4, proposeHour: 19 }
  it('matches within the hour after the slot', () => {
    expect(matchesAskWindow(t, TUE_1705)).toBe(true)
  })
  it('does not match before the slot or after the window', () => {
    expect(matchesAskWindow(t, new Date('2026-06-09T20:59:00Z'))).toBe(false) // 16:59 NY
    expect(matchesAskWindow(t, new Date('2026-06-09T22:01:00Z'))).toBe(false) // 18:01 NY
    expect(matchesAskWindow(t, new Date('2026-06-10T21:05:00Z'))).toBe(false) // Wed
  })
})

describe('keys', () => {
  it('nyDayKey is the NY calendar date', () => {
    // 01:30Z Wed = 21:30 EDT Tue -> still Tuesday in NY
    expect(nyDayKey(new Date('2026-06-10T01:30:00Z'))).toBe('2026-06-09')
  })
  it('isoWeek + slotKey', () => {
    expect(isoWeek(TUE_1705)).toBe('2026-W24')
    expect(slotKey('2026-W24', 0)).toBe('2026-W24-t0')
  })
  it('day/week starts as UTC instants', () => {
    expect(nyDayStartUtc(TUE_1705).toISOString()).toBe('2026-06-09T04:00:00.000Z')
    // week starts Monday in NY: Mon Jun 8 00:00 EDT
    expect(nyWeekStartUtc(TUE_1705).toISOString()).toBe('2026-06-08T04:00:00.000Z')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test --workspace=apps/web`
Expected: FAIL — `Cannot find module './time'`

- [ ] **Step 3: Implement `apps/web/lib/asker/time.ts`**

```ts
import type { CadenceTemplate } from './types'

const NY = 'America/New_York'

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: NY,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
})

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export type NyParts = { year: number; month: number; day: number; hour: number; minute: number; dow: number }

export function nyParts(d: Date): NyParts {
  const p: Record<string, string> = {}
  for (const { type, value } of partsFmt.formatToParts(d)) p[type] = value
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour) % 24, minute: Number(p.minute), dow: DOW[p.weekday],
  }
}

/** UTC instant for a wall-clock time in NY. Offset-probe technique; exact except inside DST jumps. */
export function zonedNyToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const w = nyParts(new Date(guess))
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute)
  return new Date(guess - (wallAsUtc - guess))
}

export function nyDayKey(d: Date): string {
  const p = nyParts(d)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export function nyDayStartUtc(d: Date): Date {
  const p = nyParts(d)
  return zonedNyToUtc(p.year, p.month, p.day, 0, 0)
}

export function nyWeekStartUtc(d: Date): Date {
  const p = nyParts(d)
  const daysBackToMonday = (p.dow + 6) % 7
  const dayStart = zonedNyToUtc(p.year, p.month, p.day, 0, 0)
  return new Date(dayStart.getTime() - daysBackToMonday * 86_400_000)
}

export function isoWeek(d: Date): string {
  // ISO week of the NY calendar date
  const p = nyParts(d)
  const utcMidday = new Date(Date.UTC(p.year, p.month - 1, p.day, 12))
  const dayNum = (utcMidday.getUTCDay() + 6) % 7 // Mon=0
  utcMidday.setUTCDate(utcMidday.getUTCDate() - dayNum + 3) // nearest Thursday
  const isoYear = utcMidday.getUTCFullYear()
  const jan4 = new Date(Date.UTC(isoYear, 0, 4, 12))
  const jan4Day = (jan4.getUTCDay() + 6) % 7
  const week1Thu = new Date(jan4.getTime() + (3 - jan4Day) * 86_400_000)
  const week = 1 + Math.round((utcMidday.getTime() - week1Thu.getTime()) / (7 * 86_400_000))
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

export function slotKey(week: string, templateIndex: number): string {
  return `${week}-t${templateIndex}`
}

/** Next NY-time occurrence of (dow, hour:00) strictly after `now`. */
export function nextOccurrence(now: Date, dow: number, hour: number, minute = 0): Date {
  const p = nyParts(now)
  for (let i = 0; i < 8; i++) {
    // anchor at NY noon to dodge DST edges when stepping days
    const anchor = new Date(zonedNyToUtc(p.year, p.month, p.day, 12, 0).getTime() + i * 86_400_000)
    const ap = nyParts(anchor)
    if (ap.dow !== dow) continue
    const candidate = zonedNyToUtc(ap.year, ap.month, ap.day, hour, minute)
    if (candidate.getTime() > now.getTime()) return candidate
  }
  throw new Error('nextOccurrence: no slot found in 8 days')
}

/** True when `now` falls in [askHour:00, askHour+1:00) NY on askDow. Tick cadence is 15 min; the
 *  cadence_slot unique key makes a wide window safe (re-fires are no-ops). */
export function matchesAskWindow(t: CadenceTemplate, now: Date): boolean {
  const p = nyParts(now)
  return p.dow === t.askDow && p.hour === t.askHour
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test --workspace=apps/web`
Expected: PASS (all `time.test.ts` cases)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/asker/time.ts apps/web/lib/asker/time.test.ts
git commit -m "feat(asker): NY-time helpers - wall clock, slots, next occurrence"
```

---

### Task 5: Phone normalization

**Files:**
- Create: `apps/web/lib/asker/phone.ts`
- Test: `apps/web/lib/asker/phone.test.ts`

- [ ] **Step 1: Write the failing test** — `apps/web/lib/asker/phone.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { normalizeUsPhone } from './phone'

describe('normalizeUsPhone', () => {
  it('accepts 10-digit US numbers in common formats', () => {
    expect(normalizeUsPhone('(917) 555-0142')).toBe('+19175550142')
    expect(normalizeUsPhone('917.555.0142')).toBe('+19175550142')
    expect(normalizeUsPhone('9175550142')).toBe('+19175550142')
  })
  it('accepts 11-digit with leading 1 and +1 form', () => {
    expect(normalizeUsPhone('1 917 555 0142')).toBe('+19175550142')
    expect(normalizeUsPhone('+1 (917) 555-0142')).toBe('+19175550142')
  })
  it('rejects everything else', () => {
    expect(normalizeUsPhone('555-0142')).toBeNull()
    expect(normalizeUsPhone('+44 20 7946 0958')).toBeNull()
    expect(normalizeUsPhone('not a phone')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test --workspace=apps/web`
Expected: FAIL — `Cannot find module './phone'`

- [ ] **Step 3: Implement `apps/web/lib/asker/phone.ts`**

```ts
/** US-only for the B-test. Returns E.164 or null. */
export function normalizeUsPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test --workspace=apps/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/asker/phone.ts apps/web/lib/asker/phone.test.ts
git commit -m "feat(asker): US phone normalization to E.164"
```

---

### Task 6: Copy module — the canonical SMS voice

Copy is product (spec § Copy is product). Tests freeze the exact strings; changing copy means changing a test deliberately.

**Files:**
- Create: `apps/web/lib/asker/copy.ts`
- Test: `apps/web/lib/asker/copy.test.ts`

- [ ] **Step 1: Write the failing tests** — `apps/web/lib/asker/copy.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { whenLabel, whenShort, joinNames, copy } from './copy'

// Thu Jun 11 2026 19:00 EDT == 23:00Z
const THU_7PM = new Date('2026-06-11T23:00:00.000Z')
// "now" on Tuesday that week
const TUE = new Date('2026-06-09T21:05:00.000Z')
// "now" on Thursday afternoon (same NY day as the event)
const THU_2PM = new Date('2026-06-11T18:00:00.000Z')

describe('whenLabel / whenShort', () => {
  it('future day uses the day name', () => {
    expect(whenLabel(THU_7PM, TUE)).toBe('Thursday night')
    expect(whenShort(THU_7PM, TUE)).toBe('Thursday 7pm')
  })
  it('same NY day becomes tonight/today', () => {
    expect(whenLabel(THU_7PM, THU_2PM)).toBe('tonight')
    expect(whenShort(THU_7PM, THU_2PM)).toBe('tonight 7pm')
    const thuNoon = new Date('2026-06-11T16:00:00.000Z') // noon EDT
    expect(whenLabel(thuNoon, THU_2PM)).toBe('today')
    expect(whenShort(thuNoon, THU_2PM)).toBe('today 12pm')
  })
  it('dayparts', () => {
    expect(whenLabel(new Date('2026-06-11T15:00:00.000Z'), TUE)).toBe('Thursday morning') // 11am
    expect(whenLabel(new Date('2026-06-11T19:00:00.000Z'), TUE)).toBe('Thursday afternoon') // 3pm
  })
})

describe('joinNames', () => {
  it('formats 1, 2, 3, many', () => {
    expect(joinNames(['Maya'])).toBe('Maya')
    expect(joinNames(['Maya', 'Dev'])).toBe('Maya and Dev')
    expect(joinNames(['Maya', 'Dev', 'Sam'])).toBe('Maya, Dev and Sam')
    expect(joinNames(['Maya', 'Dev', 'Sam', 'Jo', 'Ash'])).toBe('Maya, Dev and 3 more')
  })
})

describe('copy — frozen canon (spec v3.0 table)', () => {
  const L = 'https://b.test/t/abc/r/r1'
  it('ask', () => {
    expect(copy.ask('🍜', THU_7PM, TUE, L))
      .toBe("🍜 Thursday night — anyone? Nobody sees your answer till it's on. → " + L)
  })
  it('strike, both variants', () => {
    expect(copy.strikeIn('🍜', THU_7PM, TUE, ['Maya', 'Dev'], L))
      .toBe("It's ON: 🍜 Thursday 7pm — you, Maya and Dev. → " + L)
    expect(copy.strikeJoin('🍜', THU_7PM, TUE, ['Maya', 'Dev'], L))
      .toBe("It's ON: 🍜 Thursday 7pm. Maya and Dev are in — join? → " + L)
  })
  it('hold', () => {
    expect(copy.hold('🍜', THU_7PM, THU_2PM, L)).toBe('tonight 7pm: 🍜 — still in? → ' + L)
  })
  it('t0', () => {
    expect(copy.t0Someone('Maya', L)).toBe("Maya's already there. → " + L)
    expect(copy.t0Nobody('🍜', THU_7PM, THU_2PM, L)).toBe('Starting now: 🍜 tonight 7pm. → ' + L)
  })
  it('fell through — the app takes the blame', () => {
    expect(copy.fellThrough()).toBe("Tonight thinned out — happens. I'll ask again soon.")
  })
  it('exit poll', () => {
    expect(copy.exitPoll(L)).toBe('Honest question: would last night have happened without this? → ' + L)
  })
  it('welcome', () => {
    expect(copy.welcome('Park Slope', L)).toBe("You're in Park Slope. Keep this link — it's yours: " + L)
  })
  it('later nudge', () => {
    expect(copy.laterNudge('🍜', THU_7PM, THU_2PM, L)).toBe('🍜 tonight 7pm is still open — in? → ' + L)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test --workspace=apps/web`
Expected: FAIL — `Cannot find module './copy'`

- [ ] **Step 3: Implement `apps/web/lib/asker/copy.ts`**

```ts
import { nyParts, nyDayKey } from './time'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function hourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12}${hour < 12 ? 'am' : 'pm'}`
}

function daypart(hour: number): string {
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'night'
}

/** "Thursday night" | "tonight" | "today" */
export function whenLabel(at: Date, now: Date): string {
  const p = nyParts(at)
  if (nyDayKey(at) === nyDayKey(now)) return daypart(p.hour) === 'night' ? 'tonight' : 'today'
  return `${DAY_NAMES[p.dow]} ${daypart(p.hour)}`
}

/** "Thursday 7pm" | "tonight 7pm" | "today 12pm" */
export function whenShort(at: Date, now: Date): string {
  const p = nyParts(at)
  const day = nyDayKey(at) === nyDayKey(now)
    ? (daypart(p.hour) === 'night' ? 'tonight' : 'today')
    : DAY_NAMES[p.dow]
  return `${day} ${hourLabel(p.hour)}`
}

export function joinNames(names: string[]): string {
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`
}

export const copy = {
  ask: (emoji: string, at: Date, now: Date, link: string) =>
    `${emoji} ${whenLabel(at, now)} — anyone? Nobody sees your answer till it's on. → ${link}`,
  strikeIn: (emoji: string, at: Date, now: Date, otherNames: string[], link: string) =>
    `It's ON: ${emoji} ${whenShort(at, now)} — ${joinNames(['you', ...otherNames])}. → ${link}`,
  strikeJoin: (emoji: string, at: Date, now: Date, inNames: string[], link: string) =>
    `It's ON: ${emoji} ${whenShort(at, now)}. ${joinNames(inNames)} are in — join? → ${link}`,
  hold: (emoji: string, at: Date, now: Date, link: string) =>
    `${whenShort(at, now)}: ${emoji} — still in? → ${link}`,
  t0Someone: (hereName: string, link: string) => `${hereName}'s already there. → ${link}`,
  t0Nobody: (emoji: string, at: Date, now: Date, link: string) =>
    `Starting now: ${emoji} ${whenShort(at, now)}. → ${link}`,
  fellThrough: () => "Tonight thinned out — happens. I'll ask again soon.",
  exitPoll: (link: string) => `Honest question: would last night have happened without this? → ${link}`,
  welcome: (circleName: string, link: string) => `You're in ${circleName}. Keep this link — it's yours: ${link}`,
  laterNudge: (emoji: string, at: Date, now: Date, link: string) =>
    `${emoji} ${whenShort(at, now)} is still open — in? → ${link}`,
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test --workspace=apps/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/asker/copy.ts apps/web/lib/asker/copy.test.ts
git commit -m "feat(asker): canonical SMS copy, frozen by tests"
```

---

### Task 7: Round serializer — the secrecy boundary

The ONLY way round data reaches a client. Tests are the spec's secrecy + indistinguishability invariants.

**Files:**
- Create: `apps/web/lib/asker/serialize.ts`
- Test: `apps/web/lib/asker/serialize.test.ts`

- [ ] **Step 1: Write the failing tests** — `apps/web/lib/asker/serialize.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { serializeRound } from './serialize'
import type { Round } from './types'

const base: Omit<Round, 'source'> = {
  id: 'r1', circleId: 'c1', verbEmoji: '🍜', verbLabel: 'dinner',
  proposedAt: new Date('2026-06-11T23:00:00Z'), closesAt: new Date('2026-06-11T21:00:00Z'),
  detail: 'that new place on 5th', state: 'open', cadenceSlot: '2026-W24-t0',
}

describe('serializeRound — secrecy invariants', () => {
  it('never serializes source, cadenceSlot, or any count field', () => {
    const out = serializeRound({ ...base, source: 'kindled' }, 'in')
    expect(out).not.toHaveProperty('source')
    expect(out).not.toHaveProperty('cadenceSlot')
    expect(JSON.stringify(out)).not.toMatch(/count|inCount|replies/i)
  })
  it('kindled and scheduled rounds are byte-identical apart from ids', () => {
    const a = serializeRound({ ...base, source: 'kindled' }, null)
    const b = serializeRound({ ...base, source: 'scheduled' }, null)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
  it('exposes only the viewer own answer', () => {
    expect(serializeRound({ ...base, source: 'scheduled' }, 'later').myAnswer).toBe('later')
    expect(serializeRound({ ...base, source: 'scheduled' }, null).myAnswer).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test --workspace=apps/web`
Expected: FAIL — `Cannot find module './serialize'`

- [ ] **Step 3: Implement `apps/web/lib/asker/serialize.ts`**

```ts
import type { Round } from './types'

export type PublicRound = {
  id: string
  verbEmoji: string
  verbLabel: string
  proposedAt: string
  closesAt: string
  detail: string | null
  state: 'open' | 'struck' | 'expired'
  myAnswer: 'in' | 'out' | 'later' | null
}

/** The secrecy boundary. No source, no slot, no counts — ever. */
export function serializeRound(r: Round, myAnswer: PublicRound['myAnswer']): PublicRound {
  if (r.state === 'queued') throw new Error('queued rounds are not visible')
  return {
    id: r.id,
    verbEmoji: r.verbEmoji,
    verbLabel: r.verbLabel,
    proposedAt: r.proposedAt.toISOString(),
    closesAt: r.closesAt.toISOString(),
    detail: r.detail,
    state: r.state,
    myAnswer,
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test --workspace=apps/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/asker/serialize.ts apps/web/lib/asker/serialize.test.ts
git commit -m "feat(asker): round serializer - secrecy + indistinguishability enforced by test"
```

---

### Task 8: SMS sender — budget, dedupe, dry-run

Pure logic against an injected deps interface; Twilio transport is a thin adapter (Task 9 wires it).

**Files:**
- Create: `apps/web/lib/asker/sms.ts`
- Test: `apps/web/lib/asker/sms.test.ts`

- [ ] **Step 1: Write the failing tests** — `apps/web/lib/asker/sms.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest'
import { sendSms, type SmsDeps } from './sms'
import type { Member } from './types'

const member: Member = { id: 'm1', circleId: 'c1', name: 'Maya', phone: '+19175550142', token: 'tok' }
const NOW = new Date('2026-06-11T18:00:00Z')

function fakeDeps(over: Partial<SmsDeps> = {}): SmsDeps {
  return {
    alreadySent: vi.fn(async () => false),
    nonEventCountSince: vi.fn(async () => 0),
    log: vi.fn(async () => {}),
    deliver: vi.fn(async () => {}),
    ...over,
  }
}

describe('sendSms', () => {
  it('delivers then logs', async () => {
    const deps = fakeDeps()
    const res = await sendSms(deps, { member, kind: 'ask', contextId: 'r1', body: 'hi', now: NOW })
    expect(res).toBe('sent')
    expect(deps.deliver).toHaveBeenCalledWith('+19175550142', 'hi')
    expect(deps.log).toHaveBeenCalledWith('m1', 'ask', 'r1', 'hi')
  })
  it('dedupes on (member, kind, context)', async () => {
    const deps = fakeDeps({ alreadySent: vi.fn(async () => true) })
    const res = await sendSms(deps, { member, kind: 'strike', contextId: 'e1', body: 'x', now: NOW })
    expect(res).toBe('deduped')
    expect(deps.deliver).not.toHaveBeenCalled()
  })
  it('suppresses non-event kinds past the daily budget', async () => {
    const deps = fakeDeps({ nonEventCountSince: vi.fn(async () => 1) })
    const res = await sendSms(deps, { member, kind: 'ask', contextId: 'r2', body: 'x', now: NOW })
    expect(res).toBe('budget_suppressed')
    expect(deps.deliver).not.toHaveBeenCalled()
  })
  it('event kinds are exempt from the daily budget', async () => {
    const deps = fakeDeps({ nonEventCountSince: vi.fn(async () => 5) })
    const res = await sendSms(deps, { member, kind: 't0', contextId: 'e1', body: 'x', now: NOW })
    expect(res).toBe('sent')
  })
  it('still logs when delivery throws, marking the body', async () => {
    const deps = fakeDeps({ deliver: vi.fn(async () => { throw new Error('twilio down') }) })
    const res = await sendSms(deps, { member, kind: 'ask', contextId: 'r3', body: 'x', now: NOW })
    expect(res).toBe('delivery_failed')
    expect(deps.log).toHaveBeenCalledWith('m1', 'ask', 'r3', '[FAILED] x')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test --workspace=apps/web`
Expected: FAIL — `Cannot find module './sms'`

- [ ] **Step 3: Implement `apps/web/lib/asker/sms.ts`**

```ts
import type { Member, SmsKind } from './types'
import { NON_EVENT_KINDS } from './types'
import { nyDayStartUtc } from './time'

export type SmsDeps = {
  alreadySent(memberId: string, kind: SmsKind, contextId: string): Promise<boolean>
  /** count of NON_EVENT_KINDS rows for member since the given instant */
  nonEventCountSince(memberId: string, since: Date): Promise<number>
  log(memberId: string, kind: SmsKind, contextId: string, body: string): Promise<void>
  deliver(phone: string, body: string): Promise<void>
}

export type SendArgs = { member: Member; kind: SmsKind; contextId: string; body: string; now: Date }
export type SendResult = 'sent' | 'deduped' | 'budget_suppressed' | 'delivery_failed'

const DAILY_NON_EVENT_CAP = 1

export async function sendSms(deps: SmsDeps, a: SendArgs): Promise<SendResult> {
  if (await deps.alreadySent(a.member.id, a.kind, a.contextId)) return 'deduped'
  if (NON_EVENT_KINDS.includes(a.kind)) {
    const used = await deps.nonEventCountSince(a.member.id, nyDayStartUtc(a.now))
    if (used >= DAILY_NON_EVENT_CAP) return 'budget_suppressed'
  }
  try {
    await deps.deliver(a.member.phone, a.body)
  } catch {
    await deps.log(a.member.id, a.kind, a.contextId, `[FAILED] ${a.body}`)
    return 'delivery_failed'
  }
  await deps.log(a.member.id, a.kind, a.contextId, a.body)
  return 'sent'
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test --workspace=apps/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/asker/sms.ts apps/web/lib/asker/sms.test.ts
git commit -m "feat(asker): SMS sender with dedupe + daily budget, transport-injected"
```

---

### Task 9: DB client, repository, Twilio transport

The repo is thin SQL. Its tests are integration tests **gated on `TEST_DATABASE_URL`** (run them with local Supabase up); everything above the repo is unit-tested with fakes.

**Files:**
- Create: `apps/web/lib/asker/db.ts`
- Create: `apps/web/lib/asker/repo.ts`
- Create: `apps/web/lib/asker/twilio.ts`
- Test: `apps/web/lib/asker/repo.integration.test.ts`

- [ ] **Step 1: Create `apps/web/lib/asker/db.ts`**

```ts
import postgres from 'postgres'

let client: ReturnType<typeof postgres> | null = null

export function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    // Supabase transaction pooler: prepare must be false; keep the pool tiny on serverless.
    client = postgres(url, { prepare: false, max: 1, transform: postgres.camel })
  }
  return client
}
```

- [ ] **Step 2: Create `apps/web/lib/asker/twilio.ts`**

```ts
import twilio from 'twilio'

/** Real transport. SMS_DRY_RUN=1 logs instead of sending (default for dev). */
export async function deliverSms(phone: string, body: string): Promise<void> {
  if (process.env.SMS_DRY_RUN === '1') {
    console.log(`[SMS DRY RUN] to ${phone}: ${body}`)
    return
  }
  const sid = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM
  if (!sid || !auth || !from) throw new Error('Twilio env vars missing')
  await twilio(sid, auth).messages.create({ to: phone, from, body })
}
```

- [ ] **Step 3: Create `apps/web/lib/asker/repo.ts`**

```ts
import { sql } from './db'
import type {
  Attendance, AttendanceState, CadenceTemplate, Circle, EventRow, Member, Round, SmsKind, Verb,
} from './types'
import { NON_EVENT_KINDS } from './types'

// ---- mapping helpers (postgres.camel gives camelCase keys) ----
const toCircle = (r: any): Circle => ({
  id: r.id, name: r.name, verbSet: r.verbSet as Verb[],
  kThreshold: r.kThreshold, cadence: r.cadence as CadenceTemplate[],
})
const toMember = (r: any): Member => ({
  id: r.id, circleId: r.circleId, name: r.name, phone: r.phone, token: r.token,
})
const toRound = (r: any): Round => ({
  id: r.id, circleId: r.circleId, verbEmoji: r.verbEmoji, verbLabel: r.verbLabel,
  proposedAt: r.proposedAt, closesAt: r.closesAt, detail: r.detail,
  source: r.source, state: r.state, cadenceSlot: r.cadenceSlot,
})
const toEvent = (r: any): EventRow => ({
  id: r.id, roundId: r.roundId, circleId: r.circleId, happensAt: r.happensAt,
  venueId: r.venueId, state: r.state, needsHold: r.needsHold,
  holdOpenedAt: r.holdOpenedAt, holdDecidedAt: r.holdDecidedAt, exitPollsSentAt: r.exitPollsSentAt,
})
const toAttendance = (r: any): Attendance => ({
  eventId: r.eventId, memberId: r.memberId, state: r.state, etaMinutes: r.etaMinutes,
})

// ---- circles / members ----
export async function createCircle(name: string, kThreshold: number): Promise<Circle> {
  const [row] = await sql()`insert into asker.circles (name, k_threshold) values (${name}, ${kThreshold}) returning *`
  return toCircle(row)
}
export async function getCircle(id: string): Promise<Circle | null> {
  const [row] = await sql()`select * from asker.circles where id = ${id}`
  return row ? toCircle(row) : null
}
export async function insertMember(circleId: string, name: string, phone: string, token: string): Promise<Member> {
  const [row] = await sql()`
    insert into asker.members (circle_id, name, phone, token) values (${circleId}, ${name}, ${phone}, ${token})
    returning *`
  return toMember(row)
}
export async function getMemberByToken(token: string): Promise<{ member: Member; circle: Circle } | null> {
  const [row] = await sql()`
    select m.*, row_to_json(c.*) as circle from asker.members m
    join asker.circles c on c.id = m.circle_id where m.token = ${token}`
  if (!row) return null
  const c = row.circle as any
  return {
    member: toMember(row),
    circle: toCircle({ ...c, verbSet: c.verb_set, kThreshold: c.k_threshold, cadence: c.cadence }),
  }
}
export async function listMembers(circleId: string): Promise<Member[]> {
  const rows = await sql()`select * from asker.members where circle_id = ${circleId} order by joined_at`
  return rows.map(toMember)
}

// ---- rounds ----
export type NewRound = {
  circleId: string; verbEmoji: string; verbLabel: string; proposedAt: Date; closesAt: Date
  detail: string | null; source: 'scheduled' | 'kindled'; state: 'queued' | 'open'; cadenceSlot: string | null
}
export async function insertRound(r: NewRound): Promise<Round | null> {
  // on conflict (cadence_slot) do nothing -> idempotent scheduled creation
  const [row] = await sql()`
    insert into asker.rounds (circle_id, verb_emoji, verb_label, proposed_at, closes_at, detail, source, state, cadence_slot)
    values (${r.circleId}, ${r.verbEmoji}, ${r.verbLabel}, ${r.proposedAt}, ${r.closesAt}, ${r.detail}, ${r.source}, ${r.state}, ${r.cadenceSlot})
    on conflict (circle_id, cadence_slot) do nothing
    returning *`
  return row ? toRound(row) : null
}
export async function getRound(id: string): Promise<Round | null> {
  const [row] = await sql()`select * from asker.rounds where id = ${id}`
  return row ? toRound(row) : null
}
export async function openRoundsForCircle(circleId: string): Promise<Round[]> {
  const rows = await sql()`
    select * from asker.rounds where circle_id = ${circleId} and state = 'open' order by proposed_at`
  return rows.map(toRound)
}
export async function usedCadenceSlots(circleId: string, week: string): Promise<Set<string>> {
  const rows = await sql()`
    select cadence_slot from asker.rounds
    where circle_id = ${circleId} and cadence_slot like ${week + '%'}`
  return new Set(rows.map((r: any) => r.cadenceSlot as string))
}
export async function countScheduledRounds(circleId: string): Promise<number> {
  const [row] = await sql()`
    select count(*)::int as n from asker.rounds where circle_id = ${circleId} and source = 'scheduled'`
  return row.n
}
export async function countRoundsReleasedSince(circleId: string, since: Date): Promise<number> {
  const [row] = await sql()`
    select count(*)::int as n from asker.rounds
    where circle_id = ${circleId} and state in ('open','struck','expired') and created_at >= ${since}`
  return row.n
}
export async function queuedKindles(circleId: string): Promise<Round[]> {
  const rows = await sql()`
    select * from asker.rounds where circle_id = ${circleId} and state = 'queued' order by created_at`
  return rows.map(toRound)
}
export async function releaseRound(id: string): Promise<void> {
  await sql()`update asker.rounds set state = 'open', created_at = now() where id = ${id} and state = 'queued'`
}
export async function expireOpenRoundsPast(now: Date): Promise<number> {
  const rows = await sql()`
    update asker.rounds set state = 'expired'
    where state = 'open' and closes_at <= ${now} returning id`
  return rows.length
}
export async function allCircles(): Promise<Circle[]> {
  const rows = await sql()`select * from asker.circles`
  return rows.map(toCircle)
}

// ---- replies + strike (THE transaction) ----
export type ReplyResult =
  | { kind: 'closed' }
  | { kind: 'recorded' }
  | { kind: 'struck'; eventId: string }

export async function replyAndMaybeStrike(
  roundId: string, memberId: string, answer: 'in' | 'out' | 'later', now: Date,
): Promise<ReplyResult> {
  return sql().begin(async (tx) => {
    // FOR UPDATE serializes concurrent Kth replies -> the strike happens exactly once.
    const [round] = await tx`select * from asker.rounds where id = ${roundId} for update`
    if (!round || round.state !== 'open' || new Date(round.closesAt).getTime() <= now.getTime()) {
      return { kind: 'closed' as const }
    }
    await tx`
      insert into asker.replies (round_id, member_id, answer) values (${roundId}, ${memberId}, ${answer})
      on conflict (round_id, member_id) do update set answer = ${answer}, created_at = now()`
    if (answer !== 'in') return { kind: 'recorded' as const }
    const [{ n }] = await tx`
      select count(*)::int as n from asker.replies where round_id = ${roundId} and answer = 'in'`
    const [{ kThreshold }] = await tx`
      select k_threshold as "kThreshold" from asker.circles where id = ${round.circleId}`
    if (n < kThreshold) return { kind: 'recorded' as const }
    await tx`update asker.rounds set state = 'struck' where id = ${roundId}`
    const needsHold = new Date(round.proposedAt).getTime() - now.getTime() > 24 * 3600_000
    const [event] = await tx`
      insert into asker.events (round_id, circle_id, happens_at, needs_hold)
      values (${roundId}, ${round.circleId}, ${round.proposedAt}, ${needsHold}) returning id`
    await tx`
      insert into asker.attendance (event_id, member_id, state)
      select ${event.id}, member_id, 'in' from asker.replies where round_id = ${roundId} and answer = 'in'`
    return { kind: 'struck' as const, eventId: event.id as string }
  }) as Promise<ReplyResult>
}
export async function getMyReply(roundId: string, memberId: string): Promise<'in' | 'out' | 'later' | null> {
  const [row] = await sql()`
    select answer from asker.replies where round_id = ${roundId} and member_id = ${memberId}`
  return row ? row.answer : null
}
export async function latersForRound(roundId: string): Promise<string[]> {
  const rows = await sql()`
    select member_id from asker.replies where round_id = ${roundId} and answer = 'later'`
  return rows.map((r: any) => r.memberId as string)
}

// ---- events / attendance ----
export async function getEvent(id: string): Promise<EventRow | null> {
  const [row] = await sql()`select * from asker.events where id = ${id}`
  return row ? toEvent(row) : null
}
export async function eventsForCircle(circleId: string, states: string[]): Promise<EventRow[]> {
  const rows = await sql()`
    select * from asker.events where circle_id = ${circleId} and state = any(${states}) order by happens_at`
  return rows.map(toEvent)
}
export async function attendanceForEvent(eventId: string): Promise<Attendance[]> {
  const rows = await sql()`select * from asker.attendance where event_id = ${eventId}`
  return rows.map(toAttendance)
}
export async function setAttendance(
  eventId: string, memberId: string, state: AttendanceState, etaMinutes: number | null,
): Promise<void> {
  await sql()`
    insert into asker.attendance (event_id, member_id, state, eta_minutes)
    values (${eventId}, ${memberId}, ${state}, ${etaMinutes})
    on conflict (event_id, member_id) do update set state = ${state}, eta_minutes = ${etaMinutes}, updated_at = now()`
}
export async function eventsNeedingHoldOpen(now: Date): Promise<EventRow[]> {
  const rows = await sql()`
    select * from asker.events where state = 'on' and needs_hold and hold_opened_at is null
    and happens_at - interval '5 hours' <= ${now}`
  return rows.map(toEvent)
}
export async function markHoldOpened(eventId: string, now: Date): Promise<void> {
  await sql()`update asker.events set hold_opened_at = ${now} where id = ${eventId}`
}
export async function eventsNeedingHoldDecision(now: Date): Promise<EventRow[]> {
  const rows = await sql()`
    select * from asker.events where state = 'on' and hold_opened_at is not null and hold_decided_at is null
    and happens_at - interval '2 hours' <= ${now}`
  return rows.map(toEvent)
}
export async function decideHold(eventId: string, fellThrough: boolean, now: Date): Promise<void> {
  await sql()`
    update asker.events set hold_decided_at = ${now}, state = ${fellThrough ? 'fell_through' : 'on'}
    where id = ${eventId}`
}
export async function eventsAtT0(now: Date): Promise<EventRow[]> {
  const rows = await sql()`
    select * from asker.events where state = 'on'
    and happens_at <= ${now} and happens_at + interval '15 minutes' > ${now}`
  return rows.map(toEvent)
}
export async function eventsToMarkDone(now: Date): Promise<EventRow[]> {
  const rows = await sql()`
    select * from asker.events where state = 'on' and happens_at + interval '3 hours' <= ${now}`
  return rows.map(toEvent)
}
export async function markDone(eventId: string): Promise<void> {
  await sql()`update asker.events set state = 'done' where id = ${eventId}`
}
export async function eventsForExitPoll(now: Date): Promise<EventRow[]> {
  const rows = await sql()`
    select * from asker.events where state = 'done' and exit_polls_sent_at is null
    and happens_at + interval '12 hours' <= ${now}`
  return rows.map(toEvent)
}
export async function markExitPollsSent(eventId: string, now: Date): Promise<void> {
  await sql()`update asker.events set exit_polls_sent_at = ${now} where id = ${eventId}`
}
export async function insertExitPoll(eventId: string, memberId: string, wouldHaveHappened: boolean): Promise<void> {
  await sql()`
    insert into asker.exit_polls (event_id, member_id, would_have_happened)
    values (${eventId}, ${memberId}, ${wouldHaveHappened})
    on conflict (event_id, member_id) do update set would_have_happened = ${wouldHaveHappened}`
}

// ---- rounds due for later-nudges ----
export async function openRoundsNearPropose(now: Date): Promise<Round[]> {
  const rows = await sql()`
    select * from asker.rounds where state = 'open' and proposed_at - interval '8 hours' <= ${now}`
  return rows.map(toRound)
}

// ---- venues / places ----
export async function setEventVenue(eventId: string, circleId: string, name: string): Promise<void> {
  const [venue] = await sql()`
    insert into asker.venues (circle_id, name) values (${circleId}, ${name})
    on conflict (circle_id, name) do update set name = excluded.name returning id`
  await sql()`update asker.events set venue_id = ${venue.id} where id = ${eventId}`
}
export async function placesForCircle(circleId: string): Promise<{ name: string; visits: number }[]> {
  const rows = await sql()`
    select v.name, count(e.id)::int as visits from asker.venues v
    join asker.events e on e.venue_id = v.id and e.state in ('on','done')
    where v.circle_id = ${circleId} group by v.name order by visits desc, v.name`
  return rows.map((r: any) => ({ name: r.name as string, visits: r.visits as number }))
}
export async function logPageView(memberId: string, page: string): Promise<void> {
  await sql()`insert into asker.page_views (member_id, page) values (${memberId}, ${page})`
}

// ---- sms log (SmsDeps implementation) ----
export async function smsAlreadySent(memberId: string, kind: SmsKind, contextId: string): Promise<boolean> {
  const [row] = await sql()`
    select 1 from asker.sms_log where member_id = ${memberId} and kind = ${kind} and context_id = ${contextId}`
  return !!row
}
export async function smsNonEventCountSince(memberId: string, since: Date): Promise<number> {
  const [row] = await sql()`
    select count(*)::int as n from asker.sms_log
    where member_id = ${memberId} and sent_at >= ${since} and kind = any(${NON_EVENT_KINDS})`
  return row.n
}
export async function smsInsert(memberId: string, kind: SmsKind, contextId: string, body: string): Promise<void> {
  await sql()`
    insert into asker.sms_log (member_id, kind, context_id, body) values (${memberId}, ${kind}, ${contextId}, ${body})
    on conflict (member_id, kind, context_id) do nothing`
}
```

- [ ] **Step 4: Write the gated integration test** — `apps/web/lib/asker/repo.integration.test.ts`

The strike-atomicity test is the single most important test in the system: N concurrent K-th replies must produce exactly one event.

```ts
import { describe, it, expect, beforeAll } from 'vitest'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('repo integration (requires TEST_DATABASE_URL)', () => {
  beforeAll(() => { process.env.DATABASE_URL = url })

  it('strike fires exactly once under concurrent replies', async () => {
    const repo = await import('./repo')
    const { newToken } = await import('./ids')
    const now = new Date()
    const circle = await repo.createCircle(`itest-${Date.now()}`, 2)
    const members = await Promise.all(
      ['A', 'B', 'C', 'D'].map((n, i) =>
        repo.insertMember(circle.id, n, `+1917555${String(1000 + i)}`, newToken())),
    )
    const round = await repo.insertRound({
      circleId: circle.id, verbEmoji: '🍜', verbLabel: 'dinner',
      proposedAt: new Date(now.getTime() + 48 * 3600_000),
      closesAt: new Date(now.getTime() + 46 * 3600_000),
      detail: null, source: 'scheduled', state: 'open', cadenceSlot: null,
    })
    expect(round).not.toBeNull()
    // 4 simultaneous 'in' replies against K=2: exactly one must observe the strike
    const results = await Promise.all(
      members.map((m) => repo.replyAndMaybeStrike(round!.id, m.id, 'in', now)),
    )
    const strikes = results.filter((r) => r.kind === 'struck')
    expect(strikes).toHaveLength(1)
    const after = await repo.getRound(round!.id)
    expect(after!.state).toBe('struck')
    const attendance = await repo.attendanceForEvent((strikes[0] as any).eventId)
    expect(attendance.length).toBeGreaterThanOrEqual(2)
  })

  it('closed rounds reject replies', async () => {
    const repo = await import('./repo')
    const { newToken } = await import('./ids')
    const now = new Date()
    const circle = await repo.createCircle(`itest2-${Date.now()}`, 2)
    const m = await repo.insertMember(circle.id, 'A', '+19175552000', newToken())
    const round = await repo.insertRound({
      circleId: circle.id, verbEmoji: '☕', verbLabel: 'coffee',
      proposedAt: new Date(now.getTime() - 3600_000), closesAt: new Date(now.getTime() - 7200_000),
      detail: null, source: 'scheduled', state: 'open', cadenceSlot: null,
    })
    const res = await repo.replyAndMaybeStrike(round!.id, m.id, 'in', now)
    expect(res.kind).toBe('closed')
  })
})
```

- [ ] **Step 5: Run unit suite (integration skipped), then integration if local DB is up**

Run: `npm run test --workspace=apps/web`
Expected: PASS with `repo integration` reported as skipped.

With local Supabase running (`supabase start`, then `supabase db reset`):
Run (PowerShell): `$env:TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'; npm run test --workspace=apps/web`
Expected: PASS including both integration tests.

- [ ] **Step 6: Verify the app still typechecks/builds**

Run: `npm run build:web` (from repo root)
Expected: build succeeds. If the build complains about bundling `twilio`, add to `apps/web/next.config.ts`: `serverExternalPackages: ['twilio']`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/asker/db.ts apps/web/lib/asker/repo.ts apps/web/lib/asker/twilio.ts apps/web/lib/asker/repo.integration.test.ts
git commit -m "feat(asker): postgres repo with serialized strike transaction + twilio transport"
```

---

### Task 10: Planners — pure decisions for the tick

Every time-based behavior as a pure function: given state + now, return actions. The tick (Task 11) executes them.

**Files:**
- Create: `apps/web/lib/asker/planner.ts`
- Test: `apps/web/lib/asker/planner.test.ts`

- [ ] **Step 1: Write the failing tests** — `apps/web/lib/asker/planner.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { planScheduledRounds, planKindleRelease, planHoldDecision } from './planner'
import type { Circle, Round } from './types'

const TUE_1705 = new Date('2026-06-09T21:05:00Z') // Tue 17:05 NY
const circle: Circle = {
  id: 'c1', name: 'Park Slope', kThreshold: 2,
  verbSet: [
    { emoji: '🍜', label: 'dinner' }, { emoji: '☕', label: 'coffee' },
    { emoji: '🏃', label: 'move' }, { emoji: '📺', label: 'couch' },
  ],
  cadence: [
    { askDow: 2, askHour: 17, verb: 'rotate', proposeDow: 4, proposeHour: 19 },
    { askDow: 0, askHour: 11, verb: '☕', proposeDow: 6, proposeHour: 11 },
  ],
}

describe('planScheduledRounds', () => {
  it('creates a round when inside an ask window and the slot is unused', () => {
    const out = planScheduledRounds(circle, TUE_1705, new Set(), 0)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      circleId: 'c1', verbEmoji: '🍜', verbLabel: 'dinner',
      source: 'scheduled', state: 'open', cadenceSlot: '2026-W24-t0',
    })
    expect(out[0].proposedAt.toISOString()).toBe('2026-06-11T23:00:00.000Z') // Thu 19:00 EDT
    expect(out[0].closesAt.toISOString()).toBe('2026-06-11T21:00:00.000Z') // -2h
  })
  it('rotates verbs by prior scheduled count', () => {
    const out = planScheduledRounds(circle, TUE_1705, new Set(), 5) // 5 % 4 = 1 -> coffee
    expect(out[0].verbEmoji).toBe('☕')
  })
  it('is idempotent via used slots', () => {
    expect(planScheduledRounds(circle, TUE_1705, new Set(['2026-W24-t0']), 0)).toHaveLength(0)
  })
  it('does nothing outside ask windows', () => {
    expect(planScheduledRounds(circle, new Date('2026-06-10T21:05:00Z'), new Set(), 0)).toHaveLength(0)
  })
  it('fixed-verb templates use that verb', () => {
    const sun11 = new Date('2026-06-14T15:30:00Z') // Sun 11:30 NY
    const out = planScheduledRounds(circle, sun11, new Set(), 0)
    expect(out[0].verbEmoji).toBe('☕')
    expect(out[0].cadenceSlot).toBe('2026-W24-t1')
  })
})

describe('planKindleRelease', () => {
  const queued = (id: string, createdAgoMin: number): Round => ({
    id, circleId: 'c1', verbEmoji: '🏃', verbLabel: 'move',
    proposedAt: new Date('2026-06-11T23:00:00Z'), closesAt: new Date('2026-06-11T21:00:00Z'),
    detail: null, source: 'kindled', state: 'queued', cadenceSlot: null,
  })
  it('releases the oldest queued kindle inside a window, one per tick', () => {
    expect(planKindleRelease(circle, TUE_1705, [queued('k1', 60), queued('k2', 5)], 0, 0)).toEqual(['k1'])
  })
  it('respects 1/day and 3/week circle caps', () => {
    expect(planKindleRelease(circle, TUE_1705, [queued('k1', 60)], 1, 1)).toEqual([])
    expect(planKindleRelease(circle, TUE_1705, [queued('k1', 60)], 0, 3)).toEqual([])
  })
  it('holds kindles outside windows', () => {
    expect(planKindleRelease(circle, new Date('2026-06-10T21:05:00Z'), [queued('k1', 60)], 0, 0)).toEqual([])
  })
})

describe('planHoldDecision', () => {
  it('fells through below 2 confirmed, holds at 2+', () => {
    expect(planHoldDecision(['confirmed', 'in', 'out'] as any)).toBe(true) // 1 confirmed -> fell through
    expect(planHoldDecision(['confirmed', 'confirmed', 'in'] as any)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test --workspace=apps/web`
Expected: FAIL — `Cannot find module './planner'`

- [ ] **Step 3: Implement `apps/web/lib/asker/planner.ts`**

```ts
import type { AttendanceState, Circle, Round } from './types'
import type { NewRound } from './repo'
import { isoWeek, matchesAskWindow, nextOccurrence, slotKey } from './time'

const CLOSES_BEFORE_MS = 2 * 3600_000
export const MAX_ROUNDS_PER_DAY = 1
export const MAX_ROUNDS_PER_WEEK = 3

export function planScheduledRounds(
  circle: Circle, now: Date, usedSlots: Set<string>, priorScheduledCount: number,
): NewRound[] {
  const week = isoWeek(now)
  const out: NewRound[] = []
  circle.cadence.forEach((t, idx) => {
    if (!matchesAskWindow(t, now)) return
    const slot = slotKey(week, idx)
    if (usedSlots.has(slot)) return
    const verb = t.verb === 'rotate'
      ? circle.verbSet[priorScheduledCount % circle.verbSet.length]
      : circle.verbSet.find((v) => v.emoji === t.verb) ?? circle.verbSet[0]
    const proposedAt = nextOccurrence(now, t.proposeDow, t.proposeHour)
    out.push({
      circleId: circle.id, verbEmoji: verb.emoji, verbLabel: verb.label,
      proposedAt, closesAt: new Date(proposedAt.getTime() - CLOSES_BEFORE_MS),
      detail: null, source: 'scheduled', state: 'open', cadenceSlot: slot,
    })
  })
  return out
}

/** Kindles release into send windows so they are indistinguishable from scheduled asks.
 *  Returns round ids to release (at most one per tick), respecting circle round caps. */
export function planKindleRelease(
  circle: Circle, now: Date, queued: Round[], releasedToday: number, releasedThisWeek: number,
): string[] {
  if (queued.length === 0) return []
  if (releasedToday >= MAX_ROUNDS_PER_DAY || releasedThisWeek >= MAX_ROUNDS_PER_WEEK) return []
  if (!circle.cadence.some((t) => matchesAskWindow(t, now))) return []
  return [queued[0].id]
}

/** true = fell through */
export function planHoldDecision(attendanceStates: AttendanceState[]): boolean {
  return attendanceStates.filter((s) => s === 'confirmed').length < 2
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test --workspace=apps/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/asker/planner.ts apps/web/lib/asker/planner.test.ts
git commit -m "feat(asker): pure planners - scheduled rounds, kindle release, hold decision"
```

---

### Task 11: The tick — composition + sends

One idempotent pass. Mostly glue over repo + planners + sendSms; the unit test verifies idempotency of the glue's *send* behavior via a scripted fake repo would be brittle — instead idempotency is enforced structurally (every send dedupes on `(member, kind, context)`, every state change is guarded by a `where` clause) and verified end-to-end in the cron route test (Part 2) and circle #0 dry run. The unit test here covers the pure helper `t0Recipients`.

**Files:**
- Create: `apps/web/lib/asker/tick.ts`
- Test: `apps/web/lib/asker/tick.test.ts`

- [ ] **Step 1: Write the failing test** — `apps/web/lib/asker/tick.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { t0Recipients } from './tick'
import type { Attendance } from './types'

const att = (memberId: string, state: Attendance['state']): Attendance =>
  ({ eventId: 'e1', memberId, state, etaMinutes: null })

describe('t0Recipients', () => {
  it('nudges in/confirmed members who are not yet walking or there', () => {
    const rows = [att('a', 'in'), att('b', 'confirmed'), att('c', 'omw'), att('d', 'here'), att('e', 'out')]
    expect(t0Recipients(rows)).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test --workspace=apps/web`
Expected: FAIL — `Cannot find module './tick'`

- [ ] **Step 3: Implement `apps/web/lib/asker/tick.ts`**

```ts
import * as repo from './repo'
import { sendSms, type SmsDeps } from './sms'
import { deliverSms } from './twilio'
import { copy } from './copy'
import { planHoldDecision, planKindleRelease, planScheduledRounds } from './planner'
import { nyDayStartUtc, nyParts, nyWeekStartUtc } from './time'
import type { Attendance, EventRow, Member, Round, SmsKind } from './types'

const deps: SmsDeps = {
  alreadySent: repo.smsAlreadySent,
  nonEventCountSince: repo.smsNonEventCountSince,
  log: repo.smsInsert,
  deliver: deliverSms,
}

function baseUrl(): string {
  return process.env.APP_BASE_URL ?? 'http://localhost:3000'
}
const roundLink = (m: Member, r: { id: string }) => `${baseUrl()}/t/${m.token}/r/${r.id}`
const eventLink = (m: Member, e: { id: string }) => `${baseUrl()}/t/${m.token}/e/${e.id}`
const exitLink = (m: Member, e: { id: string }) => `${baseUrl()}/t/${m.token}/x/${e.id}`

async function send(m: Member, kind: SmsKind, contextId: string, body: string, now: Date): Promise<number> {
  return (await sendSms(deps, { member: m, kind, contextId, body, now })) === 'sent' ? 1 : 0
}

export function t0Recipients(attendance: Attendance[]): string[] {
  return attendance.filter((a) => a.state === 'in' || a.state === 'confirmed').map((a) => a.memberId)
}

async function sendAsk(round: Round, members: Member[], now: Date): Promise<number> {
  let sent = 0
  for (const m of members) {
    sent += await send(m, 'ask', round.id, copy.ask(round.verbEmoji, round.proposedAt, now, roundLink(m, round)), now)
  }
  return sent
}

export async function sendStrikeBroadcast(eventId: string, now: Date): Promise<number> {
  const event = await repo.getEvent(eventId)
  if (!event) return 0
  const round = await repo.getRound(event.roundId)
  const members = await repo.listMembers(event.circleId)
  const attendance = await repo.attendanceForEvent(eventId)
  const inIds = new Set(attendance.filter((a) => a.state === 'in').map((a) => a.memberId))
  const nameOf = new Map(members.map((m) => [m.id, m.name]))
  let sent = 0
  for (const m of members) {
    const others = [...inIds].filter((id) => id !== m.id).map((id) => nameOf.get(id)!)
    const body = inIds.has(m.id)
      ? copy.strikeIn(round!.verbEmoji, event.happensAt, now, others, eventLink(m, event))
      : copy.strikeJoin(round!.verbEmoji, event.happensAt, now, others, eventLink(m, event))
    sent += await send(m, 'strike', eventId, body, now)
  }
  return sent
}

export type TickSummary = {
  roundsOpened: number; kindlesReleased: number; roundsExpired: number
  holdsOpened: number; holdsDecided: number; t0Sent: number
  latersNudged: number; markedDone: number; exitPollsSent: number; smsSent: number
}

export async function runTick(now: Date): Promise<TickSummary> {
  const s: TickSummary = {
    roundsOpened: 0, kindlesReleased: 0, roundsExpired: 0, holdsOpened: 0,
    holdsDecided: 0, t0Sent: 0, latersNudged: 0, markedDone: 0, exitPollsSent: 0, smsSent: 0,
  }
  const circles = await repo.allCircles()
  const dayStart = nyDayStartUtc(now)
  const weekStart = nyWeekStartUtc(now)

  for (const circle of circles) {
    const members = await repo.listMembers(circle.id)
    const releasedToday = await repo.countRoundsReleasedSince(circle.id, dayStart)
    const releasedThisWeek = await repo.countRoundsReleasedSince(circle.id, weekStart)

    // 1. Release queued kindles first — human desire beats the template.
    const queued = await repo.queuedKindles(circle.id)
    for (const id of planKindleRelease(circle, now, queued, releasedToday, releasedThisWeek)) {
      await repo.releaseRound(id)
      const round = await repo.getRound(id)
      if (round) s.smsSent += await sendAsk(round, members, now)
      s.kindlesReleased++
    }

    // 2. Open scheduled rounds (skip if the day/week budget is now spent).
    const releasedTodayAfter = await repo.countRoundsReleasedSince(circle.id, dayStart)
    const releasedWeekAfter = await repo.countRoundsReleasedSince(circle.id, weekStart)
    if (releasedTodayAfter < 1 && releasedWeekAfter < 3) {
      const used = await repo.usedCadenceSlots(circle.id, '')
      const prior = await repo.countScheduledRounds(circle.id)
      for (const nr of planScheduledRounds(circle, now, used, prior)) {
        const round = await repo.insertRound(nr) // slot conflict -> null -> already done
        if (round) {
          s.roundsOpened++
          s.smsSent += await sendAsk(round, members, now)
        }
      }
    }
  }

  // 3. Expire rounds past close. Silent — no SMS, ever.
  s.roundsExpired = await repo.expireOpenRoundsPast(now)

  // 4. Open holds at T-5h for early strikes.
  for (const e of await repo.eventsNeedingHoldOpen(now)) {
    await repo.markHoldOpened(e.id, now)
    s.holdsOpened++
    const members = await repo.listMembers(e.circleId)
    const round = await repo.getRound(e.roundId)
    const attendance = await repo.attendanceForEvent(e.id)
    const inIds = new Set(attendance.filter((a) => a.state === 'in').map((a) => a.memberId))
    for (const m of members.filter((m) => inIds.has(m.id))) {
      s.smsSent += await send(m, 'hold', e.id, copy.hold(round!.verbEmoji, e.happensAt, now, eventLink(m, e)), now)
    }
  }

  // 5. Decide holds at T-2h. The app takes the blame, to confirmed members only.
  for (const e of await repo.eventsNeedingHoldDecision(now)) {
    const attendance = await repo.attendanceForEvent(e.id)
    const fellThrough = planHoldDecision(attendance.map((a) => a.state))
    await repo.decideHold(e.id, fellThrough, now)
    s.holdsDecided++
    if (fellThrough) {
      const members = await repo.listMembers(e.circleId)
      const confirmed = new Set(attendance.filter((a) => a.state === 'confirmed').map((a) => a.memberId))
      for (const m of members.filter((m) => confirmed.has(m.id))) {
        s.smsSent += await send(m, 'fell_through', e.id, copy.fellThrough(), now)
      }
    }
  }

  // 6. T-0 status nudges.
  for (const e of await repo.eventsAtT0(now)) {
    if (e.holdOpenedAt && !e.holdDecidedAt) continue
    const members = await repo.listMembers(e.circleId)
    const round = await repo.getRound(e.roundId)
    const attendance = await repo.attendanceForEvent(e.id)
    const hereIds = attendance.filter((a) => a.state === 'here').map((a) => a.memberId)
    const nameOf = new Map(members.map((m) => [m.id, m.name]))
    const firstHere = hereIds.length ? nameOf.get(hereIds[0])! : null
    for (const id of t0Recipients(attendance)) {
      const m = members.find((mm) => mm.id === id)!
      const body = firstHere
        ? copy.t0Someone(firstHere, eventLink(m, e))
        : copy.t0Nobody(round!.verbEmoji, e.happensAt, now, eventLink(m, e))
      s.t0Sent += await send(m, 't0', e.id, body, now)
    }
  }

  // 7. Later re-asks at T-8h on still-open rounds.
  for (const r of await repo.openRoundsNearPropose(now)) {
    const laterIds = await repo.latersForRound(r.id)
    if (!laterIds.length) continue
    const members = await repo.listMembers(r.circleId)
    for (const id of laterIds) {
      const m = members.find((mm) => mm.id === id)
      if (m) s.latersNudged += await send(m, 'later_nudge', r.id, copy.laterNudge(r.verbEmoji, r.proposedAt, now, roundLink(m, r)), now)
    }
  }

  // 8. Mark events done at T+3h.
  for (const e of await repo.eventsToMarkDone(now)) {
    await repo.markDone(e.id)
    s.markedDone++
  }

  // 9. Exit polls — next morning, 9-11am NY, to people who were there.
  const hour = nyParts(now).hour
  if (hour >= 9 && hour < 11) {
    for (const e of await repo.eventsForExitPoll(now)) {
      const members = await repo.listMembers(e.circleId)
      const attendance = await repo.attendanceForEvent(e.id)
      const hereIds = new Set(attendance.filter((a) => a.state === 'here').map((a) => a.memberId))
      for (const m of members.filter((m) => hereIds.has(m.id))) {
        s.exitPollsSent += await send(m, 'exit_poll', e.id, copy.exitPoll(exitLink(m, e)), now)
      }
      await repo.markExitPollsSent(e.id, now)
    }
  }

  s.smsSent += s.t0Sent + s.latersNudged + s.exitPollsSent
  return s
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test --workspace=apps/web`
Expected: PASS (`t0Recipients` test; whole suite green)

- [ ] **Step 5: Typecheck via build**

Run: `npm run build:web`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/asker/tick.ts apps/web/lib/asker/tick.test.ts
git commit -m "feat(asker): idempotent tick - releases, asks, holds, t0, laters, exit polls"
```

---

## AMENDMENT A1 (June 11, post Batch-C quality review) — claim-first SMS sending

**Supersedes the `alreadySent`/`log` design in Tasks 8, 9, 11 and the join-route SmsDeps in Part 2 Task 15.** Finding: check-then-act (`alreadySent` → `deliver` → `log`) lets (1) a `[FAILED]` log row permanently block retries, (2) a failed send burn the daily budget, (3) overlapping ticks double-deliver, (4) a post-delivery log error trigger re-delivery. Fix: the `sms_log` unique key becomes a distributed mutex via insert-as-claim with a `status` lifecycle (`claimed` → `sent` | `failed`); failed and stale (>10 min) claims are re-claimable, so transient Twilio errors retry on a later tick instead of silencing a member.

**A1.1 — Migration (`supabase/migrations/20260611000000_asker_schema.sql`):** in `asker.sms_log`, after `body text not null,` add:

```sql
  status text not null check (status in ('claimed','sent','failed')),
```

**A1.2 — `apps/web/lib/asker/types.ts`:** `NON_EVENT_KINDS` becomes `readonly`:

```ts
export const NON_EVENT_KINDS: readonly SmsKind[] = ['welcome', 'ask', 'later_nudge']
```

**A1.3 — `apps/web/lib/asker/sms.ts` (full replacement):**

```ts
import type { Member, SmsKind } from './types'
import { NON_EVENT_KINDS } from './types'
import { nyDayStartUtc } from './time'

export type SmsDeps = {
  /** Atomically claim the (member, kind, context) send slot. True = we own delivery.
   *  Re-claimable when a prior attempt failed or a claim went stale (crashed mid-send). */
  claim(memberId: string, kind: SmsKind, contextId: string, body: string): Promise<boolean>
  markSent(memberId: string, kind: SmsKind, contextId: string): Promise<void>
  markFailed(memberId: string, kind: SmsKind, contextId: string): Promise<void>
  /** count of non-failed NON_EVENT_KINDS rows for member since the given instant */
  nonEventCountSince(memberId: string, since: Date): Promise<number>
  deliver(phone: string, body: string): Promise<void>
}

export type SendArgs = { member: Member; kind: SmsKind; contextId: string; body: string; now: Date }
export type SendResult = 'sent' | 'deduped' | 'budget_suppressed' | 'delivery_failed'

const DAILY_NON_EVENT_CAP = 1

/** Claim-first send: the sms_log unique key is the distributed mutex, so concurrent
 *  callers (overlapping ticks, parallel route handlers) can never double-deliver. */
export async function sendSms(deps: SmsDeps, a: SendArgs): Promise<SendResult> {
  if (NON_EVENT_KINDS.includes(a.kind)) {
    const used = await deps.nonEventCountSince(a.member.id, nyDayStartUtc(a.now))
    if (used >= DAILY_NON_EVENT_CAP) return 'budget_suppressed'
  }
  if (!(await deps.claim(a.member.id, a.kind, a.contextId, a.body))) return 'deduped'
  try {
    await deps.deliver(a.member.phone, a.body)
  } catch {
    await deps.markFailed(a.member.id, a.kind, a.contextId).catch(() => {})
    return 'delivery_failed'
  }
  await deps.markSent(a.member.id, a.kind, a.contextId).catch(() => {})
  return 'sent'
}
```

Known accepted gap: the budget check is still check-then-act across DIFFERENT contextIds (two concurrent non-event sends for one member can both pass). Round release is capped at 1/day/circle, so the only collision is welcome+ask on join day — bounded overshoot of 1, accepted for the test.

**A1.4 — `apps/web/lib/asker/sms.test.ts` (full replacement):**

```ts
import { describe, it, expect, vi } from 'vitest'
import { sendSms, type SmsDeps } from './sms'
import { nyDayStartUtc } from './time'
import type { Member } from './types'

const member: Member = { id: 'm1', circleId: 'c1', name: 'Maya', phone: '+19175550142', token: 'tok' }
const NOW = new Date('2026-06-11T18:00:00Z')

function fakeDeps(over: Partial<SmsDeps> = {}): SmsDeps {
  return {
    claim: vi.fn(async () => true),
    markSent: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    nonEventCountSince: vi.fn(async () => 0),
    deliver: vi.fn(async () => {}),
    ...over,
  }
}

describe('sendSms', () => {
  it('claims, delivers, then marks sent — in that order', async () => {
    const order: string[] = []
    const deps = fakeDeps({
      claim: vi.fn(async () => { order.push('claim'); return true }),
      deliver: vi.fn(async () => { order.push('deliver') }),
      markSent: vi.fn(async () => { order.push('markSent') }),
    })
    const res = await sendSms(deps, { member, kind: 'ask', contextId: 'r1', body: 'hi', now: NOW })
    expect(res).toBe('sent')
    expect(order).toEqual(['claim', 'deliver', 'markSent'])
    expect(deps.claim).toHaveBeenCalledWith('m1', 'ask', 'r1', 'hi')
    expect(deps.deliver).toHaveBeenCalledWith('+19175550142', 'hi')
  })
  it('checks the budget against the NY day start', async () => {
    const deps = fakeDeps()
    await sendSms(deps, { member, kind: 'ask', contextId: 'r1', body: 'hi', now: NOW })
    expect(deps.nonEventCountSince).toHaveBeenCalledWith('m1', nyDayStartUtc(NOW))
  })
  it('dedupes when the claim is lost — no delivery, no marks', async () => {
    const deps = fakeDeps({ claim: vi.fn(async () => false) })
    const res = await sendSms(deps, { member, kind: 'strike', contextId: 'e1', body: 'x', now: NOW })
    expect(res).toBe('deduped')
    expect(deps.deliver).not.toHaveBeenCalled()
    expect(deps.markSent).not.toHaveBeenCalled()
  })
  it('suppresses non-event kinds past the daily budget without claiming', async () => {
    const deps = fakeDeps({ nonEventCountSince: vi.fn(async () => 1) })
    const res = await sendSms(deps, { member, kind: 'ask', contextId: 'r2', body: 'x', now: NOW })
    expect(res).toBe('budget_suppressed')
    expect(deps.claim).not.toHaveBeenCalled()
    expect(deps.deliver).not.toHaveBeenCalled()
  })
  it('event kinds are exempt from the daily budget and still deliver', async () => {
    const deps = fakeDeps({ nonEventCountSince: vi.fn(async () => 5) })
    const res = await sendSms(deps, { member, kind: 't0', contextId: 'e1', body: 'x', now: NOW })
    expect(res).toBe('sent')
    expect(deps.deliver).toHaveBeenCalled()
    expect(deps.markSent).toHaveBeenCalled()
  })
  it('marks failed and reports when delivery throws', async () => {
    const deps = fakeDeps({ deliver: vi.fn(async () => { throw new Error('twilio down') }) })
    const res = await sendSms(deps, { member, kind: 'ask', contextId: 'r3', body: 'x', now: NOW })
    expect(res).toBe('delivery_failed')
    expect(deps.markFailed).toHaveBeenCalledWith('m1', 'ask', 'r3')
    expect(deps.markSent).not.toHaveBeenCalled()
  })
  it('still reports sent when the post-delivery mark fails (no retry storm)', async () => {
    const deps = fakeDeps({ markSent: vi.fn(async () => { throw new Error('db blip') }) })
    const res = await sendSms(deps, { member, kind: 'ask', contextId: 'r4', body: 'x', now: NOW })
    expect(res).toBe('sent')
  })
})
```

**A1.5 — `apps/web/lib/asker/serialize.test.ts`:** add one test inside the existing describe:

```ts
  it('throws on queued rounds — they are invisible by definition', () => {
    expect(() => serializeRound({ ...base, source: 'kindled', state: 'queued' }, null))
      .toThrow('queued rounds are not visible')
  })
```

**A1.6 — Task 9 repo.ts sms section (replaces smsAlreadySent/smsInsert):**

```ts
// ---- sms log (SmsDeps implementation) ----
export async function smsClaim(memberId: string, kind: SmsKind, contextId: string, body: string): Promise<boolean> {
  const rows = await sql()`
    insert into asker.sms_log (member_id, kind, context_id, body, status)
    values (${memberId}, ${kind}, ${contextId}, ${body}, 'claimed')
    on conflict (member_id, kind, context_id) do update
      set status = 'claimed', body = excluded.body, sent_at = now()
      where asker.sms_log.status = 'failed'
         or (asker.sms_log.status = 'claimed' and asker.sms_log.sent_at < now() - interval '10 minutes')
    returning id`
  return rows.length > 0
}
export async function smsMarkSent(memberId: string, kind: SmsKind, contextId: string): Promise<void> {
  await sql()`update asker.sms_log set status = 'sent'
    where member_id = ${memberId} and kind = ${kind} and context_id = ${contextId}`
}
export async function smsMarkFailed(memberId: string, kind: SmsKind, contextId: string): Promise<void> {
  await sql()`update asker.sms_log set status = 'failed'
    where member_id = ${memberId} and kind = ${kind} and context_id = ${contextId}`
}
export async function smsNonEventCountSince(memberId: string, since: Date): Promise<number> {
  const [row] = await sql()`
    select count(*)::int as n from asker.sms_log
    where member_id = ${memberId} and sent_at >= ${since} and status <> 'failed'
      and kind = any(${[...NON_EVENT_KINDS]})`
  return row.n
}
```

**A1.7 — Task 11 tick.ts deps block becomes:**

```ts
const deps: SmsDeps = {
  claim: repo.smsClaim,
  markSent: repo.smsMarkSent,
  markFailed: repo.smsMarkFailed,
  nonEventCountSince: repo.smsNonEventCountSince,
  deliver: deliverSms,
}
```

**A1.8 — Part 2 Task 15 join route:** the welcome block becomes (lost-link recovery resends directly; the claim mutex would otherwise dedupe the re-send):

```ts
  let member = await repo.getMemberByPhone(circleId, phone)
  const isNew = !member
  if (!member) member = await repo.insertMember(circleId, name, phone, newToken())

  const base = process.env.APP_BASE_URL ?? 'http://localhost:3000'
  const link = `${base}/t/${member.token}`
  const body = copy.welcome(circle.name, link)
  if (isNew) {
    await sendSms(
      { claim: repo.smsClaim, markSent: repo.smsMarkSent, markFailed: repo.smsMarkFailed, nonEventCountSince: async () => 0, deliver: deliverSms },
      { member, kind: 'welcome', contextId: member.id, body, now: new Date() },
    )
  } else {
    // Lost-link recovery: explicit user request — resend directly, already logged once.
    await deliverSms(member.phone, body).catch(() => {})
  }
  return Response.json({ link })
```

Suite after amendment: 41 tests (30 prior + 4 serialize + 7 sms).

---

## AMENDMENT A2 (June 11, post Batch-D quality review) — T0 latch + truly concurrent integration test

Finding 1: `eventsAtT0`'s bounded 15-minute window is the only finite-edge window query; GitHub-cron jitter (>15 min between ticks) can skip it entirely and the moment-of-truth nudge is silently lost. Fix: fire-once latch, open-ended window — like every other tick step. Finding 2: `db.ts` pins `max: 1`, so the integration test's 4 "parallel" replies serialize client-side and would pass even without `FOR UPDATE`; a pool-size knob makes the test genuinely concurrent.

**A2.1 — Migration:** in `asker.events`, after `hold_decided_at timestamptz,` add:

```sql
  t0_sent_at timestamptz,
```

**A2.2 — `types.ts`:** `EventRow` gains `t0SentAt: Date | null` (after `holdDecidedAt`).

**A2.3 — `repo.ts`:** `toEvent` maps `t0SentAt: r.t0SentAt`; replace `eventsAtT0` with:

```ts
export async function eventsNeedingT0(now: Date): Promise<EventRow[]> {
  const rows = await sql()`
    select * from asker.events where state = 'on' and t0_sent_at is null and happens_at <= ${now}`
  return rows.map(toEvent)
}
export async function markT0Sent(eventId: string, now: Date): Promise<void> {
  await sql()`update asker.events set t0_sent_at = ${now} where id = ${eventId}`
}
```

**A2.4 — `db.ts`:** pool size becomes an env knob (production default stays 1):

```ts
    client = postgres(url, {
      prepare: false,
      max: Number(process.env.PG_POOL_MAX ?? 1),
      transform: postgres.camel,
    })
```

**A2.5 — `repo.integration.test.ts`:** in `beforeAll`, set the knob before any `sql()` use so the 4 replies truly overlap and contend the row lock:

```ts
  beforeAll(() => {
    process.env.DATABASE_URL = url
    process.env.PG_POOL_MAX = '4'
  })
```

**A2.6 — Task 11 tick step 6 becomes (latch-marked, otherwise unchanged):**

```ts
  // 6. T-0 status nudges — latch per event so cron jitter can never skip them.
  for (const e of await repo.eventsNeedingT0(now)) {
    if (e.holdOpenedAt && !e.holdDecidedAt) continue
    const members = await repo.listMembers(e.circleId)
    const round = await repo.getRound(e.roundId)
    const attendance = await repo.attendanceForEvent(e.id)
    const hereIds = attendance.filter((a) => a.state === 'here').map((a) => a.memberId)
    const nameOf = new Map(members.map((m) => [m.id, m.name]))
    const firstHere = hereIds.length ? nameOf.get(hereIds[0])! : null
    for (const id of t0Recipients(attendance)) {
      const m = members.find((mm) => mm.id === id)!
      const body = firstHere
        ? copy.t0Someone(firstHere, eventLink(m, e))
        : copy.t0Nobody(round!.verbEmoji, e.happensAt, now, eventLink(m, e))
      s.t0Sent += await send(m, 't0', e.id, body, now)
    }
    await repo.markT0Sent(e.id, now)
  }
```

**A2.7 — Part 2 Task 18 attendance route:** add a server-side anti-downgrade guard after the event lookup (metrics integrity — 'here' is the primary metric key and must not be silently overwritten by a late Join tap):

```ts
  const existing = (await repo.attendanceForEvent(eventId)).find((a) => a.memberId === session.member.id)
  if (state === 'in' && existing && ['confirmed', 'omw', 'here'].includes(existing.state)) {
    return Response.json({ error: 'already in' }, { status: 409 })
  }
```

---

## Part 1 self-review checklist (run before starting Part 2)

- [ ] All unit tests green: `npm run test --workspace=apps/web`
- [ ] Integration tests green against local Supabase (strike fires exactly once)
- [ ] `npm run build:web` succeeds
- [ ] Grep check — secrecy: `source` appears in no file under `apps/web/app/` (Part 2 will keep it that way); `serializeRound` is the only round serializer.

Part 2 (`2026-06-10-asker-b-test-pages.md`) wires routes, pages, the cron endpoint + GitHub Actions, metrics-b.sql, and the runbook.
