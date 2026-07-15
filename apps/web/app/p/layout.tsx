import './pulse.css'
import * as repo from '@/lib/pulse/repo'
import { getViewer } from '@/lib/pulse/identity'
import { PulseTabBar } from './nav.client'

// All /p surfaces render inside the warm room — cream base, Onest body, own scroll
// container (the root layout locks body scrolling for the map home). The bottom navbar is
// mounted once here so it persists across every /p surface; pulse.css reserves the space
// beneath it (--pulse-nav-h + safe-area) so nothing hides behind the fixed bar.
export default async function PulseLayout({ children }: { children: React.ReactNode }) {
  // Live signal for the bar's spark dot — reuse the dash read (no new data source). pastLimit 0:
  // we only need whether anything is live now, not the earlier history.
  const viewer = await getViewer()
  const live = viewer
    ? (await repo.pulsesForParticipant(viewer.id, new Date(), 0)).live.length > 0
    : false
  return (
    <div className="bonfire-pulse">
      {children}
      <PulseTabBar live={live} />
    </div>
  )
}
