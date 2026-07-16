import { ImageResponse } from 'next/og'
import { BRAND } from '@/lib/pulse/copy'
import { pulseCard } from '@/lib/pulse/og'
import { getPlanByToken } from '@/lib/pulse/plan'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = BRAND

// Evergreen unfurl card for a shared plan — the opener's intent only, never a live availability
// count. Reuses the pulse rail's branded card so link previews match across the rail.
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const plan = await getPlanByToken(token)
  const title = plan ? 'A plan on Bonfire' : BRAND
  const subtitle = plan ? plan.intentText : ''
  return new ImageResponse(pulseCard({ title, subtitle }), size)
}
