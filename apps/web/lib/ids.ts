import { randomBytes } from 'node:crypto'

// 144-bit opaque, url-safe bearer token. Used by every rail (asker members, pulse
// participants/crews/pulses). Not short or enumerable — the token is the only
// access control to its object.
export function newToken(): string {
  return randomBytes(18).toString('base64url') // 24 chars
}
