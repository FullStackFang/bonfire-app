import twilio from 'twilio'

/** Real transport. SMS_DRY_RUN=1 logs instead of sending (default for dev).
 *  Returns the Twilio message sid (null in dry-run) for callers that log deliveries. */
export async function deliverSmsWithSid(phone: string, body: string): Promise<string | null> {
  if (process.env.SMS_DRY_RUN === '1') {
    console.log(`[SMS DRY RUN] to ${phone}: ${body}`)
    return null
  }
  const sid = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM
  if (!sid || !auth || !from) throw new Error('Twilio env vars missing')
  const message = await twilio(sid, auth).messages.create({ to: phone, from, body })
  return message.sid
}

/** The asker's SmsSender signature (void) — unchanged by the hoist. */
export async function deliverSms(phone: string, body: string): Promise<void> {
  await deliverSmsWithSid(phone, body)
}
