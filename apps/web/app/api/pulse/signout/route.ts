import { clearParticipant } from '@/lib/pulse/identity'

// POST /api/pulse/signout — delete the device identity cookie (device-scoped sign-out).
// The participant row is untouched: the phone identity survives and is recovered by
// verifying again on any device. The next visitor on this device starts tier-0.
export async function POST() {
  await clearParticipant()
  return Response.json({ ok: true })
}
