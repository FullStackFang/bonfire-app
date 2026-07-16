'use client'
import Link from 'next/link'
import { dashCopy } from '@/lib/pulse/copy'

// Dash recovery island: "Been here before?" → the /p/login front door (one verify flow app-wide,
// no drift with a second sheet). Only mounted when the viewer is unverified or the dash is
// empty — a verified participant with content sees no identity chrome.

export function RecoveryEntry() {
  return (
    <div className="bp-card mt-6 flex items-center gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p style={{ fontWeight: 600, fontSize: 14.5 }}>{dashCopy.recoveryPrompt}</p>
        <p className="mt-0.5" style={{ fontSize: 12.5, color: 'var(--smoke)', lineHeight: 1.35 }}>
          {dashCopy.recoveryBlurb}
        </p>
      </div>
      <Link href="/p/login" className="bp-pin-chip shrink-0" style={{ textDecoration: 'none' }}>
        {dashCopy.recoveryCta}
      </Link>
    </div>
  )
}
