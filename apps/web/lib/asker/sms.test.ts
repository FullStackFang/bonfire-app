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
