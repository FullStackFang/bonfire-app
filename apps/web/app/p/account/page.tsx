import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getViewer, isVerified } from '@/lib/pulse/identity'
import { maskPhone } from '@/lib/pulse/phone'
import { authCopy } from '@/lib/pulse/copy'
import { BrandRow } from '../ui.client'
import { SignOutButton } from './account.client'

// Deliberately thin: makes "you are signed in as X" legible and gives sign-out a home.
// Not a profile editor. The phone is masked server-side — the full number never serializes.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `${authCopy.accountTitle} · Bonfire`,
  robots: { index: false }, // participant-scoped — never index
}

export default async function AccountPage() {
  const viewer = await getViewer()
  if (!viewer?.phone || !isVerified(viewer)) redirect('/p/login')

  return (
    <main className="mx-auto min-h-full w-full max-w-md px-4 pt-4 pb-8">
      <BrandRow />
      <h1 className="bp-title mt-3 mb-4">{authCopy.accountTitle}</h1>

      <div className="bp-card px-4 py-3.5">
        <p style={{ fontWeight: 600, fontSize: 16 }}>{viewer.displayName ?? '—'}</p>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--smoke)' }}>
          {authCopy.phoneLabel}: {maskPhone(viewer.phone)}
        </p>
      </div>

      <div className="mt-6">
        <SignOutButton />
        <p className="bp-sub mt-2">{authCopy.signOutBlurb}</p>
      </div>
    </main>
  )
}
