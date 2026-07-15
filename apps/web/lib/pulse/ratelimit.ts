import * as repo from './repo'
import type { RateScope } from './repo'

// Open creation has no SMS/phone gate (unlike the asker), so create/mutate is bounded per
// participant, per crew, and per IP within a rolling window. A small DB counter table
// (pulse.action_log) backs it, in the spirit of asker.sms_log dedupe.

type Action = 'create' | 'mutate'

const LIMITS: Record<Action, { windowSec: number; participant?: number; crew?: number; ip?: number }> = {
  // Conservative first; loosen from the funnel data later.
  create: { windowSec: 60, participant: 8, ip: 15 },
  mutate: { windowSec: 60, participant: 40, crew: 80, ip: 80 },
}

// Chat-app link crawlers must never be throttled or their previews break. They only ever issue
// GETs (page/OG), which are unmetered, but this is the canonical exemption check.
const CRAWLER_UA = /WhatsApp|facebookexternalhit|Twitterbot|Slackbot|TelegramBot|Discordbot|LinkedInBot/i
export function isCrawler(userAgent: string | null): boolean {
  return !!userAgent && CRAWLER_UA.test(userAgent)
}

export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Record the action under each applicable scope and 429 if any scope is over its window limit.
 *  Returns a Response to short-circuit the route, or null to proceed. */
export async function enforceRateLimit(
  action: Action,
  scopes: { participantId?: string; crewId?: string; ip?: string },
): Promise<Response | null> {
  const limits = LIMITS[action]
  const checks: { scope: RateScope; key: string; limit: number }[] = []
  if (scopes.participantId && limits.participant) checks.push({ scope: 'participant', key: scopes.participantId, limit: limits.participant })
  if (scopes.crewId && limits.crew) checks.push({ scope: 'crew', key: scopes.crewId, limit: limits.crew })
  if (scopes.ip && limits.ip) checks.push({ scope: 'ip', key: scopes.ip, limit: limits.ip })

  for (const c of checks) await repo.logAction(c.scope, c.key, action)

  for (const c of checks) {
    const n = await repo.countActions(c.scope, c.key, action, limits.windowSec)
    if (n > c.limit) {
      return Response.json(
        { error: 'slow down' },
        { status: 429, headers: { 'retry-after': String(limits.windowSec) } },
      )
    }
  }
  return null
}
