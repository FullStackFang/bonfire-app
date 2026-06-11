import { randomBytes } from 'node:crypto'

export function newToken(): string {
  return randomBytes(18).toString('base64url') // 24 chars
}
