import twilio from 'twilio'

/** Real transport. SMS_DRY_RUN=1 logs instead of sending (default for dev). */
export async function deliverSms(phone: string, body: string): Promise<void> {
  if (process.env.SMS_DRY_RUN === '1') {
    console.log(`[SMS DRY RUN] to ${phone}: ${body}`)
    return
  }
  const sid = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM
  if (!sid || !auth || !from) throw new Error('Twilio env vars missing')
  await twilio(sid, auth).messages.create({ to: phone, from, body })
}
