'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { dashCopy } from '@/lib/pulse/copy'
import { VerifySheet } from './verify.client'

// Dash recovery island: "Been here before?" → the existing OTP sheet. On success the server
// has already re-pointed the device cookie (ghost merge); a router.refresh() re-renders the
// server dash under the adopted identity. Only mounted when the viewer is unverified or the
// dash is empty — a verified participant with content sees no identity chrome.

export function RecoveryEntry() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="bp-card mt-6 flex items-center gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p style={{ fontWeight: 600, fontSize: 14.5 }}>{dashCopy.recoveryPrompt}</p>
          <p className="mt-0.5" style={{ fontSize: 12.5, color: 'var(--smoke)', lineHeight: 1.35 }}>
            {dashCopy.recoveryBlurb}
          </p>
        </div>
        <button type="button" className="bp-pin-chip shrink-0" onClick={() => setOpen(true)}>
          {dashCopy.recoveryCta}
        </button>
      </div>
      {open && (
        <VerifySheet
          onClose={() => setOpen(false)}
          blurb={dashCopy.recoveryBlurb}
          onVerified={() => { setOpen(false); router.refresh() }}
        />
      )}
    </>
  )
}
