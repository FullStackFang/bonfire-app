import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getViewer, isVerified } from '@/lib/pulse/identity'
import { authCopy } from '@/lib/pulse/copy'
import { LoginFlow } from './login.client'

// The front door: an explicit sign-in page (Partiful structure). Browsing stays ungated —
// this is an additional entry point, not a wall. Sign-in and sign-up are one flow; the
// verify endpoints unify them (first phone verifies in place, known phone ghost-merges).

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `${authCopy.signInHeading} · Bonfire`,
  robots: { index: false },
}

export default async function LoginPage() {
  // A login page for a signed-in person is dead UI — send them home.
  const viewer = await getViewer()
  if (isVerified(viewer)) redirect('/p')
  return <LoginFlow />
}
