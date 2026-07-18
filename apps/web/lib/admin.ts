import 'server-only'

// Admin allowlist. A viewer is an admin iff they are phone-verified AND their server-side E.164
// phone is in ADMIN_PHONES. The phone never leaves the server, so this check is server-only.
// ADMIN_PHONES is comma-separated E.164 (e.g. "+14165550101,+14165550102"). Unset/empty => the
// set is empty => nobody is an admin (fail closed: /admin 404s for everyone rather than opening up).
//
// Read per call (not memoized at module load) so it reflects runtime env on the host, not a
// build-time snapshot.
export function isAdminPhone(phone: string | null | undefined): boolean {
  if (!phone) return false
  const allow = (process.env.ADMIN_PHONES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return allow.includes(phone.trim())
}
