import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { reviewBySlug } from '../registry'
import { ReviewFrame } from '../ReviewFrame.client'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const r = reviewBySlug(slug)
  return { title: r ? `${r.title} · Admin` : 'Admin', robots: { index: false, follow: false } }
}

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const r = reviewBySlug(slug)
  if (!r) notFound()

  return (
    <main style={{ maxWidth: 1600, margin: '0 auto', padding: '14px 0 40px' }}>
      <div style={{ padding: '0 22px 12px' }}>
        <Link href="/admin" style={{ fontSize: 13, color: '#9e2c1c', textDecoration: 'none' }}>‹ all reviews</Link>
      </div>
      <ReviewFrame html={r.html} title={r.title} />
    </main>
  )
}
