'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { navCopy } from '@/lib/pulse/copy'
import { EmberMark } from './ui.client'

// The shared primary nav for every /p surface: three tabs (Home · Events · Groups) plus an auth
// chip (Log in → /p/login when signed out, Account → /p/account when verified). Active state
// derives from the route — detail pages count toward the section they belong to (a pulse → Events,
// a crew → Groups) so one tab is always lit.
//
// Two forms from one markup (see pulse.css): on phones a fixed bottom bar of chunky chips
// (thumb-reachable), on desktop (≥860px) a slim left icon rail (the Partiful desktop idiom).
// Both are icon-only — the plain-word destination rides each tab's aria-label. Bottom bars read
// as a phone app in a browser; the rail is the cursor-era idiom.

// Icons are inline (currentColor) — the chip drives fill via its text color (white when active,
// smoke when not). Simple, dependency-free line/solid marks that read at 22px.

function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2c.6 3-1.4 4.6-2.9 6C7.4 9.6 6 11.3 6 14a6 6 0 0 0 12 0c0-2-.8-3.6-1.8-4.8-.3.9-.9 1.6-1.7 1.9.5-2.2-.3-4.6-2.5-6.4-.1 1.6-.9 2.5-1.8 3.2C10.4 6 11 4 12 2Z" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  )
}
function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 5.2a3 3 0 0 1 0 5.8M17 14.4c2.3.5 3.8 2.3 3.8 4.6" />
    </svg>
  )
}
function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="7.5" r="3.6" />
      <path d="M5 20c0-3.4 3-5.6 7-5.6s7 2.2 7 5.6" />
    </svg>
  )
}
type Tab = { href: string; label: string; icon: React.ReactNode; active: (p: string) => boolean }

const TABS: Tab[] = [
  // Home also owns /p/new and any surface not claimed by a section below.
  { href: '/p', label: navCopy.home, icon: <FlameIcon />, active: (p) => p === '/p' || p.startsWith('/p/new') },
  // A single pulse (/p/s/*) is an event detail.
  { href: '/p/events', label: navCopy.events, icon: <CalendarIcon />, active: (p) => p === '/p/events' || p.startsWith('/p/s/') },
  // A crew board (/p/c/*) is a group detail.
  { href: '/p/groups', label: navCopy.groups, icon: <PeopleIcon />, active: (p) => p === '/p/groups' || p.startsWith('/p/c/') },
]

export function PulseTabBar(
  { live = false, verified = false, displayName = null }:
  { live?: boolean; verified?: boolean; displayName?: string | null },
) {
  const pathname = usePathname()
  // The auth chip: the one route in when signed out, the account surface when signed in.
  // Same chunky-chip states as the tabs; active only on its own route. Rendered as a tab for
  // the phone bottom bar; on the desktop top bar it's hidden in favor of the right cluster below.
  const auth: Tab = verified
    ? { href: '/p/account', label: navCopy.account, icon: <PersonIcon />, active: (p) => p === '/p/account' }
    : { href: '/p/login', label: navCopy.login, icon: <PersonIcon />, active: (p) => p === '/p/login' }
  const initial = (displayName?.trim().charAt(0) || '?').toUpperCase()
  return (
    <nav className="bp-nav" aria-label="Primary">
      {/* Brand + way home. Hidden on the phone bottom bar; mark + wordmark up top on desktop. */}
      <Link href="/p" className="bp-nav-brand" aria-label="Bonfire home">
        <EmberMark glow size={18} />
        <span className="bp-wordmark">BONFIRE</span>
      </Link>
      {[...TABS, auth].map((tab) => {
        const active = tab.active(pathname)
        // The spark rides the Events tab: it points at the surface where a live pulse lives.
        const showSpark = live && tab.href === '/p/events'
        const isAuth = tab.href === auth.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            className={`bp-nav-tab${active ? ' bp-nav-tab--active' : ''}${isAuth ? ' bp-nav-tab--auth' : ''}`}
          >
            {tab.icon}
            {/* Label shows only on the desktop top bar; the phone bar stays icon-only. */}
            <span className="bp-nav-label">{tab.label}</span>
            {showSpark && <span className="bp-nav-spark" aria-hidden />}
          </Link>
        )
      })}
      {/* Desktop top-bar right cluster (hidden on the phone bar, where the auth chip rides the
          bottom bar as a tab). Signed out it mirrors the marketing header's Log in + Create so
          crossing / ↔ /p holds the same chrome; signed in it becomes the account chip. */}
      <div className="bp-nav-right">
        {verified ? (
          <Link href="/p/account" className="bp-nav-account" aria-label={navCopy.account}>
            <span className="bp-nav-avatar">
              {initial}
              <span className="bp-nav-avatar-dot" aria-hidden />
            </span>
            <span className="bp-nav-acctmeta">
              <span className="bp-nav-acctname">{displayName || 'You'}</span>
              <span className="bp-nav-acctsub">Signed in</span>
            </span>
          </Link>
        ) : (
          <>
            <Link href="/p/login" className="bp-nav-login">{navCopy.login}</Link>
            <Link href="/p/new" className="bp-nav-create">Create</Link>
          </>
        )}
      </div>
    </nav>
  )
}
