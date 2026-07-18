import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getViewer, isVerified } from '@/lib/pulse/identity'
import { isAdminPhone } from '@/lib/admin'

// Gate every /admin route in one server layout (the repo gates per server component, no middleware —
// same idiom as app/p/account/page.tsx). Three outcomes:
//   signed-out / unverified  -> /p/login  (an admin can sign in and come back)
//   verified, not allowlisted -> 404       (never disclose the area exists)
//   admin                    -> render
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin · Bonfire',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer()
  if (!viewer?.phone || !isVerified(viewer)) redirect('/p/login')
  if (!isAdminPhone(viewer.phone)) notFound()

  return (
    <div style={{ minHeight: '100dvh', background: '#f2ede7', color: '#201d1b' }}>
      <header
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px',
          borderBottom: '1px solid #e0d9d1', background: '#1b1714', color: '#fff',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 22, height: 22, borderRadius: '52% 52% 52% 8% / 60% 60% 40% 40%',
            background: 'radial-gradient(120% 110% at 50% 78%,#FFD37A 0%,#FF8A3D 38%,#e8502f 70%,#E0431F 100%)',
            boxShadow: '0 0 12px rgba(232,80,47,.55)',
          }}
        />
        <Link href="/admin" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, letterSpacing: '-.2px' }}>
          Admin · Reviews
        </Link>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#c8c0b8' }}>
          {viewer.displayName ?? 'Signed in'}
        </span>
      </header>
      {children}
    </div>
  )
}
