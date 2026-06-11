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
