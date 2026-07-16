// Pure phone helpers — no node imports, safe for client components. phone.ts (node:crypto +
// the SMS sender) re-exports the moved helpers so server code keeps its single import path.

/** E.164 normalize. Bare 10-digit numbers are assumed US (+1); otherwise a country code is
 *  required. Returns null when the input can't be a real phone. */
export function normalizePhone(input: string): string | null {
  const cleaned = input.trim().replace(/[\s\-().]/g, '')
  const digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned
  if (!/^\d+$/.test(digits)) return null
  if (cleaned.startsWith('+')) {
    if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null
    return `+${digits}`
  }
  if (digits.length === 10) return `+1${digits}` // bare US number
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

/** Display mask: everything but the last four digits hidden. The only phone shape that may
 *  ever reach a client — full numbers never serialize (spec: phone-identity). */
export function maskPhone(phone: string): string {
  return `••• ••• ${phone.slice(-4)}`
}

/** Display formatting for a number the user JUST TYPED (the code step's sent-to line):
 *  `+1 646-226-8158`. Client-side only — never a phone serialized from the server. Falls back
 *  to the raw input when unparseable; non-NANP numbers stay bare E.164. */
export function formatPhoneDisplay(input: string): string {
  const phone = normalizePhone(input)
  if (!phone) return input.trim()
  if (phone.startsWith('+1') && phone.length === 12) {
    return `+1 ${phone.slice(2, 5)}-${phone.slice(5, 8)}-${phone.slice(8)}`
  }
  return phone
}
