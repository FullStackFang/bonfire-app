import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import * as repo from '@/lib/pulse/repo'
import { getViewer } from '@/lib/pulse/identity'
import { isCrawler } from '@/lib/pulse/ratelimit'
import { resolveAvailability, type ResolvedAvailability } from '@/lib/pulse/availability'
import { BOARD_STATUS_LABEL } from '@/lib/pulse/copy'
import { BrandRow } from '../../../ui.client'
import { AroundRow } from './rows.client'

// Who's-Around: the ambient PULL surface. Server-rendered read over the resolve engine —
// no polling (availability changes slowly; a refresh re-resolves), zero notifications, and
// exactly one `around_view` funnel event per human load. Nothing here frames anyone
// negatively: unknown is a neutral outline, busy is muted context, never a "no".

export const dynamic = 'force-dynamic'

type Preset = 'tonight' | 'weekend' | 'custom'

function resolveWindow(preset: Preset, from: string | undefined, to: string | undefined, now: Date) {
  if (preset === 'custom' && from && to) {
    const startsAt = new Date(from)
    const endsAt = new Date(to)
    if (!Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime()) && endsAt > startsAt) {
      return { startsAt, endsAt }
    }
  }
  if (preset === 'weekend') {
    // The upcoming (or current) Sat–Sun. Coarse on purpose — members' baselines resolve in
    // their OWN timezones; the window just frames the question.
    const start = new Date(now)
    const dow = start.getUTCDay()
    const daysToSat = dow === 0 ? -1 : 6 - dow
    start.setUTCDate(start.getUTCDate() + daysToSat)
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 2)
    return { startsAt: start.getTime() > now.getTime() ? start : now, endsAt: end }
  }
  // tonight: the next six hours
  return { startsAt: now, endsAt: new Date(now.getTime() + 6 * 3_600_000) }
}

const ORDER: Record<ResolvedAvailability['availability'], number> = {
  free: 0, probably_free: 1, unknown: 2, busy: 3,
}

export default async function AroundPage({ params, searchParams }: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ w?: string; from?: string; to?: string }>
}) {
  const { token } = await params
  const sp = await searchParams
  const crew = await repo.getCrewByToken(token)
  if (!crew) notFound()

  const preset: Preset = sp.w === 'weekend' ? 'weekend' : sp.w === 'custom' ? 'custom' : 'tonight'
  const now = new Date()
  const window = resolveWindow(preset, sp.from, sp.to, now)

  const viewer = await getViewer()
  const [members, presence] = await Promise.all([
    repo.membersForCrew(crew.id),
    repo.presenceForCrew(crew.id),
  ])
  const ids = members.map((m) => m.participantId)
  const [baselines, exceptions] = await Promise.all([
    repo.baselinesForParticipants(ids),
    repo.exceptionsForParticipants(ids, now),
  ])

  // Exactly one funnel event per human load — crawlers excluded, nothing else written.
  const ua = (await headers()).get('user-agent')
  if (!isCrawler(ua)) {
    await repo.logEvent('around_view', { crewId: crew.id, participantId: viewer?.id ?? null })
  }

  const rows = members
    .map((m) => {
      const resolved = resolveAvailability({
        baselines: baselines
          .filter((b) => b.participantId === m.participantId)
          .map((b) => ({
            daysOfWeek: b.daysOfWeek, startTime: b.startTime, endTime: b.endTime,
            timezone: b.timezone, label: b.label,
          })),
        exceptions: exceptions
          .filter((e) => e.participantId === m.participantId)
          .map((e) => ({
            state: e.state, startsAt: e.startsAt, endsAt: e.endsAt,
            label: e.label, createdAt: e.createdAt,
          })),
        calendarBlocks: [], // stub in v1 — no calendar sources exist yet
        window,
      })
      const live = presence.find((p) => p.participantId === m.participantId) ?? null
      return {
        participantId: m.participantId,
        displayName: m.displayName ?? 'someone',
        me: m.participantId === viewer?.id,
        resolved,
        presence: live ? { label: BOARD_STATUS_LABEL[live.status], note: live.note } : null,
      }
    })
    .sort((a, b) => ORDER[a.resolved.availability] - ORDER[b.resolved.availability])

  const presetLink = (w: Preset, label: string) => (
    <Link href={`/p/c/${token}/around${w === 'tonight' ? '' : `?w=${w}`}`}
      className={`bp-opt${preset === w ? ' bp-opt--sel' : ''}`} style={{ textDecoration: 'none' }}>
      {label}
    </Link>
  )

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pt-4 pb-8">
      <BrandRow />
      <Link href={`/p/c/${token}`} className="mt-3 inline-block" style={{ fontSize: 12.5, color: 'var(--smoke)' }}>
        ← {crew.name}
      </Link>
      <h1 className="bp-title mt-1">Who’s around?</h1>
      <p className="bp-sub mt-1">A glance, not a poll. Nobody gets pinged by you looking.</p>

      <div className="bp-seg mt-4">
        {presetLink('tonight', 'tonight')}
        {presetLink('weekend', 'this weekend')}
      </div>
      <form method="GET" className="mt-2.5 flex items-center gap-2">
        <input type="hidden" name="w" value="custom" />
        <input type="datetime-local" name="from" defaultValue={sp.from ?? ''} className="bp-field" style={{ height: 40, fontSize: 13 }} />
        <span style={{ color: 'var(--smoke)', fontSize: 12 }}>to</span>
        <input type="datetime-local" name="to" defaultValue={sp.to ?? ''} className="bp-field" style={{ height: 40, fontSize: 13 }} />
        <button className="bp-opt" type="submit">go</button>
      </form>

      <div className="mt-5 space-y-2">
        {rows.length === 0 && (
          <p className="bp-sub">No one has joined this crew yet. The roster is who shows up here.</p>
        )}
        {rows.map((r) => (
          <AroundRow key={r.participantId} crewToken={token} row={r} />
        ))}
      </div>
    </main>
  )
}
