import { describe, it, expect, vi } from 'vitest'
import { sendSms, type SmsDeps } from './sms'
import { nyDayStartUtc } from './time'
import type { Member } from './types'

const member: Member = { id: 'm1', circleId: 'c1', name: 'Maya', phone: '+19175550142', token: 'tok' }
const NOW = new Date('2026-06-11T18:00:00Z')

function fakeDeps(over: Partial<SmsDeps> = {}): SmsDeps {
  return {
    claim: vi.fn(async () => true),
    markSent: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    nonEventCountSince: vi.fn(async () => 0),
    deliver: vi.fn(async () => {}),
    ...over,
  }
}

describe('sendSms', () => {
  it('claims, delivers, then marks sent — in that order', async () => {
    const order: string[] = []
    const deps = fakeDeps({
      claim: vi.fn(async () => { order.push('claim'); return true }),
      deliver: vi.fn(async () => { order.push('deliver') }),
      markSent: vi.fn(async () => { order.push('markSent') }),
    })
    const res = await sendSms(deps, { member, kind: 'ask', contextId: 'r1', body: 'hi', now: NOW })
    expect(res).toBe('sent')
    expect(order).toEqual(['claim', 'deliver', 'markSent'])
    expect(deps.claim).toHaveBeenCalledWith('m1', 'ask', 'r1', 'hi')
    expect(deps.deliver).toHaveBeenCalledWith('+19175550142', 'hi')
  })
  it('checks the budget against the NY day start', async () => {
    const deps = fakeDeps()
    await sendSms(deps, { member, kind: 'ask', contextId: 'r1', body: 'hi', now: NOW })
    expect(deps.nonEventCountSince).toHaveBeenCalledWith('m1', nyDayStartUtc(NOW))
  })
  it('dedupes when the claim is lost — no delivery, no marks', async () => {
    const deps = fakeDeps({ claim: vi.fn(async () => false) })
    const res = await sendSms(deps, { member, kind: 'strike', contextId: 'e1', body: 'x', now: NOW })
    expect(res).toBe('deduped')
    expect(deps.deliver).not.toHaveBeenCalled()
    expect(deps.markSent).not.toHaveBeenCalled()
  })
  it('suppresses non-event kinds past the daily budget without claiming', async () => {
    const deps = fakeDeps({ nonEventCountSince: vi.fn(async () => 1) })
    const res = await sendSms(deps, { member, kind: 'ask', contextId: 'r2', body: 'x', now: NOW })
    expect(res).toBe('budget_suppressed')
    expect(deps.claim).not.toHaveBeenCalled()
    expect(deps.deliver).not.toHaveBeenCalled()
  })
  it('event kinds are exempt from the daily budget and still deliver', async () => {
    const deps = fakeDeps({ nonEventCountSince: vi.fn(async () => 5) })
    const res = await sendSms(deps, { member, kind: 't0', contextId: 'e1', body: 'x', now: NOW })
    expect(res).toBe('sent')
    expect(deps.deliver).toHaveBeenCalled()
    expect(deps.markSent).toHaveBeenCalled()
  })
  it('marks failed and reports when delivery throws', async () => {
    const deps = fakeDeps({ deliver: vi.fn(async () => { throw new Error('twilio down') }) })
    const res = await sendSms(deps, { member, kind: 'ask', contextId: 'r3', body: 'x', now: NOW })
    expect(res).toBe('delivery_failed')
    expect(deps.markFailed).toHaveBeenCalledWith('m1', 'ask', 'r3')
    expect(deps.markSent).not.toHaveBeenCalled()
  })
  it('still reports sent when the post-delivery mark fails (no retry storm)', async () => {
    const deps = fakeDeps({ markSent: vi.fn(async () => { throw new Error('db blip') }) })
    const res = await sendSms(deps, { member, kind: 'ask', contextId: 'r4', body: 'x', now: NOW })
    expect(res).toBe('sent')
  })
})
