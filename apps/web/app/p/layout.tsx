import { Suspense } from 'react'
import { getViewer } from '@/lib/pulse/identity'
import { viewerPulses } from '@/lib/pulse/dashReads'
import { PulseTabBar } from './nav.client'
import './pulse.css'

// All /p surfaces render inside the warm room — cream base, Onest body, own scroll
// container (the root layout locks body scrolling for the map home). The bottom navbar is
// mounted once here so it persists across every /p surface; pulse.css reserves the space
// beneath it (--pulse-nav-h + safe-area) so nothing hides behind the fixed bar.
export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bonfire-pulse">
      {children}
      {/* The bar paints immediately (spark off); the live read streams in behind it so the
          layout never blocks first paint on a DB round-trip. */}
      <Suspense fallback={<PulseTabBar />}>
        <LiveTabBar />
      </Suspense>
    </div>
  )
}

// Live signal for the bar's spark dot — the same per-request-cached read the dash/events
// pages use, so on those surfaces this costs no extra query.
async function LiveTabBar() {
  const viewer = await getViewer()
  const live = viewer ? (await viewerPulses(viewer.id)).live.length > 0 : false
  return <PulseTabBar live={live} />
}
