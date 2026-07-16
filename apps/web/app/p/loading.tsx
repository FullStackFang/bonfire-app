import { BrandRow } from './ui.client'

// Instant paint for every /p surface: client-side tab switches and cold loads show this
// shell the moment navigation starts, while the page's DB reads stream in behind it.
// Generic on purpose — it stands in for the dash, Events, Groups, and detail pages alike.
export default function PulseLoading() {
  return (
    <main className="mx-auto min-h-full w-full bp-main-wide px-4 pt-4 pb-8" aria-busy>
      <BrandRow />
      <div className="bp-skel bp-skel--title mt-4" />
      <div className="bp-list mt-6">
        <div className="bp-skel bp-skel--card" />
        <div className="bp-skel bp-skel--card" />
        <div className="bp-skel bp-skel--card" />
      </div>
    </main>
  )
}
