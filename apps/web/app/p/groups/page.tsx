import type { Metadata } from 'next'
import Link from 'next/link'
import * as repo from '@/lib/pulse/repo'
import { getViewer, toPublicViewer } from '@/lib/pulse/identity'
import { serializeDash } from '@/lib/pulse/serialize'
import { navCopy } from '@/lib/pulse/copy'
import { BrandRow, CrewCard } from '../ui.client'

// The Groups tab: the viewer's groups, reusing the dash's crew read, serializer, and card markup
// (name + the viewer's own status only). The plain word "Groups" — never the internal term.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `${navCopy.groupsTitle} · Bonfire`,
  robots: { index: false }, // participant-scoped — never index
}

export default async function GroupsPage() {
  const viewer = await getViewer()
  const crews = viewer ? await repo.crewsForParticipant(viewer.id) : []

  const dash = serializeDash(crews, { live: [], earlier: [] }, toPublicViewer(viewer))
  const empty = dash.crews.length === 0

  return (
    <main className="mx-auto min-h-full w-full max-w-md px-4 pt-4 pb-8">
      <BrandRow />
      <h1 className="bp-title mt-3">{navCopy.groupsTitle}</h1>

      {empty ? (
        <>
          <p className="bp-sub mt-1 mb-6">{navCopy.groupsEmptyBlurb}</p>
          <Link href="/p/new" className="bp-btn bp-btn--primary w-full" style={{ textDecoration: 'none' }}>
            {navCopy.startCta}
          </Link>
        </>
      ) : (
        <ul className="space-y-2 mt-6">
          {dash.crews.map((c) => (
            <li key={c.token}><CrewCard c={c} /></li>
          ))}
        </ul>
      )}
    </main>
  )
}
