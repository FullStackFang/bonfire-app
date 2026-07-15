import { ImageResponse } from 'next/og'
import * as repo from '@/lib/pulse/repo'
import { BRAND, ogCopy } from '@/lib/pulse/copy'
import { pulseCard } from '@/lib/pulse/og'

// The postgres driver is not edge-safe — render on Node. Anonymous + cacheable: this route MUST
// NOT read the pulse_pid cookie (it stays a crawler-fetchable, CDN-cacheable image).
export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = BRAND

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const crew = await repo.getCrewByToken(token) // one cheap read for the name
  const title = crew ? ogCopy.crewTitle(crew.name) : BRAND
  const subtitle = ogCopy.crewDescription()
  return new ImageResponse(pulseCard({ title, subtitle }), size)
}
