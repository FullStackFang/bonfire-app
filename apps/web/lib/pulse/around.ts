/* eslint-disable @typescript-eslint/no-explicit-any -- row mappers take dynamically-shaped
   postgres rows (camelCased); typing each as `any` is the established asker/repo boundary idiom. */
import { sql } from '../db'
import type { Around, AroundWindow, PublicAround, PublicPersonAround, PublicViewer } from './types'

// Network discovery (growth-story Phase 2). Coarse, self-reported "who's around" — NO device
// location. The roster is scoped to crew-overlap (your people), never strangers, and never surfaces
// absence. "Go live" is not here — it reuses the Phase 1 plan engine from the surface.

// Coarse expiry per window — good enough for ambient presence; no timezone math needed.
const WINDOW_HOURS: Record<AroundWindow, number> = { now: 3, tonight: 8, this_week: 24 * 6 }

const LABEL: Record<AroundWindow, string> = {
  now: 'around now',
  tonight: 'around tonight',
  this_week: 'around this week',
}

const toAround = (r: any): Around => ({
  participantId: r.participantId, locale: r.locale ?? null,
  aroundWindow: r.aroundWindow, aroundUntil: r.aroundUntil, updatedAt: r.updatedAt,
})

/** Set (upsert) the viewer's coarse around signal. `locale` is a self-typed place or null. */
export async function setAround(
  participantId: string, aroundWindow: AroundWindow, locale: string | null, now: Date = new Date(),
): Promise<Around> {
  const aroundUntil = new Date(now.getTime() + WINDOW_HOURS[aroundWindow] * 3600_000)
  const clean = locale?.trim().slice(0, 60) || null
  const [row] = await sql()`
    insert into pulse.around (participant_id, locale, around_window, around_until, updated_at)
    values (${participantId}, ${clean}, ${aroundWindow}, ${aroundUntil}, now())
    on conflict (participant_id) do update
      set locale = ${clean}, around_window = ${aroundWindow}, around_until = ${aroundUntil}, updated_at = now()
    returning *`
  return toAround(row)
}

/** Clear the viewer's around signal (quiet delete — never a public "left"). */
export async function clearAround(participantId: string): Promise<void> {
  await sql()`delete from pulse.around where participant_id = ${participantId}`
}

export async function myAround(participantId: string, now: Date = new Date()): Promise<Around | null> {
  const [row] = await sql()`
    select * from pulse.around where participant_id = ${participantId} and around_until > ${now}`
  return row ? toAround(row) : null
}

/** The viewer's people who are around: participants who SHARE A CREW with the viewer and have a
 *  live around signal. Self excluded, strangers excluded, absence never surfaced. */
export async function peopleAround(viewerId: string, now: Date = new Date()): Promise<PublicPersonAround[]> {
  const rows = await sql()`
    select a.participant_id, p.display_name, a.locale, a.around_window
    from pulse.around a
    join pulse.participants p on p.id = a.participant_id
    where a.around_until > ${now}
      and a.participant_id <> ${viewerId}
      and exists (
        select 1 from pulse.crew_members cm1
        join pulse.crew_members cm2 on cm1.crew_id = cm2.crew_id
        where cm1.participant_id = ${viewerId} and cm2.participant_id = a.participant_id
      )
    order by a.around_until desc`
  return rows.map((r: any): PublicPersonAround => ({
    participantId: r.participantId,
    displayName: r.displayName ?? 'Someone',
    locale: r.locale ?? null,
    label: LABEL[r.aroundWindow as AroundWindow] ?? 'around',
    me: false,
  }))
}

/** Assemble the discovery surface for a viewer (their own signal + their people around). */
export async function getPublicAround(viewer: PublicViewer, now: Date = new Date()): Promise<PublicAround> {
  if (!viewer) return { mine: null, people: [], viewer }
  const [mine, people] = await Promise.all([
    myAround(viewer.participantId, now),
    peopleAround(viewer.participantId, now),
  ])
  return {
    mine: mine ? { aroundWindow: mine.aroundWindow, locale: mine.locale } : null,
    people,
    viewer,
  }
}
