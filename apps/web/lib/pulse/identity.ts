import { cache } from 'react'
import { cookies } from 'next/headers'
import { newToken } from '../ids'
import * as repo from './repo'
import { CAPS } from './copy'
import type { Participant, PublicViewer } from './types'

// Appless device identity. The participant token lives in an httpOnly cookie and resolves the
// participant server-side — mirroring the asker's getMemberByToken, but cookie-borne instead of
// URL-borne. No HMAC, no secret: the token is already random and unforgeable, and whoever holds
// the cookie IS that participant (low-stakes presence, not authentication).

export const COOKIE = 'pulse_pid'

const COOKIE_OPTS = {
  httpOnly: true,
  // Secure in production (HTTPS); relaxed in dev so http://localhost still sets the cookie
  // across all browsers. Chrome treats localhost as secure regardless.
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // 1 year
}

export async function getParticipantByToken(token: string): Promise<Participant | null> {
  return repo.getParticipantByToken(token)
}

/** Read-only: who is the viewer, from the cookie? Never creates or mutates. Safe in Server
 *  Components (pages) and in state reads. Returns null for a brand-new device.
 *  cache(): layout and page both ask during one request — resolve the cookie once. */
export const getViewer = cache(async (): Promise<Participant | null> => {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  return repo.getParticipantByToken(token)
})

/** Write paths only (Route Handlers): resolve the viewer or create one on first write, setting the
 *  identity cookie. Never throws "already joined" — a dropped cookie just mints a fresh participant
 *  (duplicate/ghost participants are expected with in-app webviews and tolerated). */
export async function resolveOrCreateParticipant(): Promise<Participant> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (token) {
    const existing = await repo.getParticipantByToken(token)
    if (existing) return existing
  }
  const fresh = await repo.createParticipant(newToken())
  store.set(COOKIE, fresh.token, COOKIE_OPTS)
  return fresh
}

/** Set/replace the viewer's display name (capped). One-tap re-name/re-claim — no hard error. */
export async function setDisplayName(participantId: string, name: string): Promise<Participant> {
  const clean = name.trim().slice(0, CAPS.displayName)
  return repo.setDisplayName(participantId, clean)
}

/** The viewer shape sent to the client. `verified` is the viewer's own tier only;
 *  no phone number ever leaves the server. */
export function toPublicViewer(p: Participant | null): PublicViewer {
  if (!p) return null
  return { participantId: p.id, displayName: p.displayName, verified: isVerified(p) }
}

export function isVerified(p: Participant | null): boolean {
  return !!p?.phoneVerifiedAt
}

/** Ghost merge: re-point the device cookie at a (canonical) participant. */
export async function adoptParticipant(p: Participant): Promise<void> {
  const store = await cookies()
  store.set(COOKIE, p.token, COOKIE_OPTS)
}

/** Tier gate for durable acts ONLY (availability writes, crew create/join, SMS delivery).
 *  Consumption paths (presence, pulse responses) must never call this. Returns a Response to
 *  short-circuit the route, or null to proceed. */
export function requireVerified(p: Participant | null): Response | null {
  if (isVerified(p)) return null
  return Response.json(
    { error: 'phone verification required', code: 'verify_required' },
    { status: 403 },
  )
}
