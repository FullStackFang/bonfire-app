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
