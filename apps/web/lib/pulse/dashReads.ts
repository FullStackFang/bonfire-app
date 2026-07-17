import { cache } from 'react'
import * as repo from './repo'
import { dashPlansForCreator } from './plan'

// Per-request memoized dash reads. The /p layout (nav spark dot) and the dash/events/groups
// pages ask for the same rows during one render — cache() collapses them to a single query
// each. The `now`/pastLimit args are fixed inside so every caller shares one cache key; the
// underlying query fetches all rows regardless, so a caller that needs less just slices less.

export const EARLIER_CAP = 10

export const viewerPulses = cache((participantId: string) =>
  repo.pulsesForParticipant(participantId, new Date(), EARLIER_CAP),
)

export const viewerCrews = cache((participantId: string) =>
  repo.crewsForParticipant(participantId),
)

// The opener's plans (close-plan-loop). The read itself heals due lifecycle transitions
// (deadline auto-strike, completion) — a dash visit is a plan read path like any other.
export const viewerPlans = cache((participantId: string) =>
  dashPlansForCreator(participantId, new Date()),
)
