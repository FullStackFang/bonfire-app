import { ImageResponse } from 'next/og'
import * as repo from '@/lib/pulse/repo'
import { BRAND, ogCopy } from '@/lib/pulse/copy'
import { pulseCard } from '@/lib/pulse/og'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = BRAND

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const pulse = await repo.getPulseByToken(token)
  const title = pulse ? ogCopy.pulseTitle(pulse.title) : BRAND
  const subtitle = pulse ? ogCopy.pulseDescription(pulse.place, pulse.timeLabel) : ''
  return new ImageResponse(pulseCard({ title, subtitle }), size)
}
