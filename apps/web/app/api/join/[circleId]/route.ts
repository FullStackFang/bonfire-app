import { newToken } from '@/lib/asker/ids'
import { normalizeUsPhone } from '@/lib/asker/phone'
import { copy } from '@/lib/asker/copy'
import { sendSms } from '@/lib/asker/sms'
import { deliverSms } from '@/lib/asker/twilio'
import * as repo from '@/lib/asker/repo'

export async function POST(request: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params
  const circle = await repo.getCircle(circleId).catch(() => null)
  if (!circle) return Response.json({ error: 'circle not found' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const phone = normalizeUsPhone(typeof body?.phone === 'string' ? body.phone : '')
  if (!name || name.length > 40) return Response.json({ error: 'name required (≤40 chars)' }, { status: 400 })
  if (!phone) return Response.json({ error: 'US phone number required' }, { status: 400 })
  if (body?.consent !== true) return Response.json({ error: 'consent required' }, { status: 400 })

  let member = await repo.getMemberByPhone(circleId, phone)
  const isNew = !member
  if (!member) member = await repo.insertMember(circleId, name, phone, newToken())

  const base = (process.env.APP_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const link = `${base}/t/${member.token}`
  const welcomeBody = copy.welcome(circle.name, link)
  if (isNew) {
    await sendSms(
      { claim: repo.smsClaim, markSent: repo.smsMarkSent, markFailed: repo.smsMarkFailed, nonEventCountSince: async () => 0, deliver: deliverSms },
      { member, kind: 'welcome', contextId: member.id, body: welcomeBody, now: new Date() },
    )
  } else {
    // Lost-link recovery: explicit user request — resend directly, already logged once.
    await deliverSms(member.phone, welcomeBody).catch(() => {})
  }
  return Response.json({ link })
}
