'use client'
import { useState } from 'react'
import { authCopy } from '@/lib/pulse/copy'

// Sign out, then hard-navigate to /p — a full reload so every server component re-reads the
// now-empty cookie (router.refresh() alone would keep client-cached segments alive).

export function SignOutButton() {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      className="bp-btn bp-btn--outline w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await fetch('/api/pulse/signout', { method: 'POST' })
        } finally {
          window.location.assign('/p')
        }
      }}
    >
      {authCopy.signOutCta}
    </button>
  )
}
