import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getViewer } from '@/lib/pulse/identity'
import { Landing } from './landing.client'

// The front door. Strangers (no participant cookie) get the public landing page; anyone the
// cookie resolves to a participant is sent straight to their dash. getViewer() is read-only —
// it never mints a cookie — so a first-time visitor stays a stranger and an unresolvable cookie
// falls through to the landing. Reads cookies, so this route is dynamic.
export const dynamic = 'force-dynamic'

// Unlike the participant-scoped /p surfaces (robots: index false), the landing is the public
// marketing page and is meant to be indexed and unfurled.
export const metadata: Metadata = {
  title: 'Bonfire — Your people, on repeat',
  description:
    'Bonfire turns "we should hang out more" into actually hanging out: again and again, with the same people, in the same places. Free, no app, lives in your group chat.',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    title: 'Bonfire — Your people, on repeat',
    description:
      'Drop a pulse into your group chat. See who’s around. The ones who keep showing up become your crew.',
  },
}

export default async function Home() {
  const viewer = await getViewer()
  if (viewer) redirect('/p')
  return <Landing />
}
