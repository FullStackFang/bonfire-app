import Link from 'next/link'
import { REVIEWS } from './reviews/registry'

// The gallery index — lists every review in the registry. Gating happens in the layout.
export const dynamic = 'force-dynamic'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AdminIndex() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '36px 22px 60px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.4px', margin: '0 0 6px' }}>Reviews</h1>
      <p style={{ fontSize: 14, color: '#5f574f', margin: '0 0 26px' }}>
        Visual review artifacts. Each opens verbatim.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {REVIEWS.map((r) => (
          <Link
            key={r.slug}
            href={`/admin/reviews/${r.slug}`}
            style={{
              display: 'block', padding: '16px 18px', borderRadius: 14, background: '#fff',
              border: '1px solid #e0d9d1', textDecoration: 'none', color: 'inherit',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{r.title}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8a8078' }}>{fmtDate(r.dateISO)}</span>
            </div>
            <p style={{ fontSize: 13, color: '#5f574f', margin: '6px 0 0', lineHeight: 1.5 }}>{r.description}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
