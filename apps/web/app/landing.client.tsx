'use client'

import { useEffect, useRef } from 'react'
import { Link } from 'next-view-transitions'
import './landing.css'

// The public marketing front door. Server-renders its full markup (so no-JS visitors and
// crawlers see everything); the two browser-only behaviors — scroll reveals and the header's
// light-to-dark transition — are progressive enhancement gated behind the `.js` class added on
// mount. Motion collapses to a static page under prefers-reduced-motion (handled in landing.css).
//
// Structure (warm morning → the product → night):
//   1 HERO       — the thesis + a self-demoing live pulse card
//   2 MOMENTS    — three product moments that sell what Bonfire actually does:
//                    · make the plan (AI plan from one sentence, appless link, self-locking)
//                    · read the room (coarse, no-GPS "who's around" across crews)
//                    · keep it lit  (proactive, opt-in, crew-scoped reconnect)
//   3 QUIET      — the durable differentiators (no app / number-as-account / quiet by design)
//   4 CLOSE      — "connection isn't found, it's repeated" + drifting sparks

export function Landing() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    // Gate every reveal animation on JS being present — without this class the CSS leaves all
    // content visible.
    root.classList.add('js')

    // `.bonfire-landing` is the scroll container (globals.css locks body scroll), so the observer
    // roots on it and the scroll listener attaches to it, not window.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }
      },
      { root, threshold: 0.16 },
    )
    root.querySelectorAll('.reveal').forEach((el) => io.observe(el))

    // The sticky header gains a hairline once the page moves and darkens over dark sections.
    const head = root.querySelector<HTMLElement>('.site-head')
    const darkSections = Array.from(root.querySelectorAll<HTMLElement>('.s-quiet, .s-close, footer'))
    const onScroll = () => {
      if (!head) return
      head.classList.toggle('scrolled', root.scrollTop > 8)
      const hb = head.getBoundingClientRect().bottom
      const overDark = darkSections.some((s) => {
        const r = s.getBoundingClientRect()
        return r.top <= hb && r.bottom >= hb
      })
      head.classList.toggle('dark', overDark)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    return () => {
      io.disconnect()
      root.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <div className="bonfire-landing" ref={rootRef}>
      <header className="site-head">
        <div className="wrap">
          <div className="row">
            <span className="ember-mark ember-mark--glow" />
            <span className="wordmark">BONFIRE</span>
            <div className="actions">
              <Link className="nav-login" href="/p/login">Log in</Link>
              <Link className="nav-create" href="/p/new">Create</Link>
            </div>
          </div>
        </div>
      </header>

      {/* ══ 1 · HERO · cream, morning ══ */}
      <section className="s-hero">
        <div className="wrap">
          <div className="hero">
            <div>
              <span className="kicker">
                <span className="ping"><i /><i className="wave" /></span>
                Loneliness is a repetition problem
              </span>
              <h1>
                Your people,<br />
                <span className="lit">
                  on repeat.
                  <svg className="swash" viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M5 14 C 70 5, 150 5, 205 10 S 280 16, 296 8" />
                  </svg>
                </span>
              </h1>
              <p className="lede">
                Bonfire turns &ldquo;we should hang out more&rdquo; into actually hanging out:
                same people, same places, again and again.
              </p>
              <div className="cta-row">
                <Link className="btn btn--primary" href="/p/new">Drop a pulse&ensp;→</Link>
                <span className="mono">Free · no app<br />lives in your group chat</span>
              </div>
            </div>

            <div className="hero-art demo">
              {/* back card: the crew (the durable thing) */}
              <div className="frame frame--float hero-card hero-card--crew">
                <div className="overline">CREW</div>
                <div className="card-title">Thursday Trivia</div>
                <div className="card-meta">Rose&apos;s Tavern · most Thursdays</div>
                <div className="crew-flames">
                  <span className="ember-mark" />
                  <span className="ember-mark" />
                  <span className="ember-mark" />
                  <span className="ember-mark" />
                  <span className="ember-mark flame-lights" />
                  <span className="mono">12 nights together</span>
                </div>
              </div>
              {/* front card: the live pulse, demoing itself on a loop */}
              <div className="frame frame--float hero-card hero-card--pulse">
                <div className="overline">
                  <span className="pulse-dot" />
                  <span style={{ color: 'var(--spark)' }}>LIVE</span> · TONIGHT
                </div>
                <div className="card-title">Trivia at Rose&apos;s</div>
                <div className="card-meta">7:00 pm · Rose&apos;s Tavern</div>
                <div className="avatars">
                  <span className="avatar">M</span>
                  <span className="avatar avatar--g">J</span>
                  <span className="avatar avatar--b">S</span>
                  <span className="avatar avatar--p avatar--joins">P</span>
                  <span className="in-count">
                    <span className="num"><span className="n3">3</span><span className="n4">4</span></span> in
                  </span>
                </div>
                <div className="card-foot">
                  <button className="chip-btn" type="button" tabIndex={-1} aria-hidden="true">I&apos;m in</button>
                  <button className="chip-ghost" type="button" tabIndex={-1} aria-hidden="true">Can&apos;t tonight</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 2 · THREE PRODUCT MOMENTS · white daylight + alternating warm bands ══ */}
      <section className="s-moments">
        <div className="wrap">
          <div className="moments-head reveal">
            <h2>The group chat that never picks a place, finally picks one.</h2>
            <p>Three things Bonfire does so the night actually happens.</p>
          </div>
        </div>

        {/* C1 · make the plan */}
        <div className="band band--tint">
          <div className="wrap">
            <div className="moment reveal">
              <div className="m-copy">
                <span className="lead">Make the plan</span>
                <h3>Say it in one sentence. Bonfire does the rest.</h3>
                <p>
                  Type the vibe. It finds a real spot, proposes a couple of times, and hands you a
                  link for the chat. No app for anyone. It locks itself the moment enough people are
                  free, and lands on every calendar.
                </p>
                <span className="note"><span className="ember-mark" /> No account. No event page. No back-and-forth.</span>
              </div>
              <div className="m-art">
                <div className="art-glow" />
                <div className="frame frame--float">
                  <div className="prompt">
                    <span className="caret" />
                    <span><b>dinner, somewhere cozy, thursday-ish</b></span>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <div className="opt">
                      <span className="badge">🍜</span>
                      <span><span className="who">Rose&apos;s Tavern</span><br /><span className="opt-sub">Thu 7:00 pm · 4 min walk</span></span>
                      <span className="free">
                        <span className="bar"><i className="on" /><i className="on" /><i className="on" /><i className="on" /></span>
                        <small>4 free</small>
                      </span>
                    </div>
                    <div className="opt">
                      <span className="badge" style={{ background: 'var(--spark-tint)', color: 'var(--spark)' }}>🥢</span>
                      <span><span className="who">Han&apos;s Noodle Bar</span><br /><span className="opt-sub">Fri 7:30 pm · 9 min walk</span></span>
                      <span className="free">
                        <span className="bar"><i className="on" /><i className="on" /><i /><i /></span>
                        <small>2 free</small>
                      </span>
                    </div>
                  </div>
                  <div className="locked">
                    <span className="ember-mark" />
                    <span><b>It&apos;s on: Rose&apos;s, Thursday 7pm</b><small>4 of you in · link sent to the chat</small></span>
                    <span className="cal"><span className="pulse-dot" />on calendar</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* C2 · read the room */}
        <div className="band">
          <div className="wrap">
            <div className="moment moment--flip reveal">
              <div className="m-copy">
                <span className="lead">Read the room</span>
                <h3>See who&apos;s actually around this week.</h3>
                <p>
                  Skip the &ldquo;you up?&rdquo; text. A quiet read on who&apos;s free, across every
                  crew you&apos;re in. One tap turns a few open evenings into a plan.
                </p>
                <span className="note"><span className="ember-mark" /> No map. No location. No pin dropped on you.</span>
              </div>
              <div className="m-art">
                <div className="art-glow" />
                <div className="frame frame--float around">
                  <div className="overline" style={{ marginBottom: 4 }}><span className="pulse-dot" />AROUND THIS WEEK</div>
                  <div className="row2">
                    <span className="avatar avatar--g">M</span>
                    <span><span className="who">Maya</span><br /><span className="crewtag">Thursday Trivia</span></span>
                    <span className="win">Free most nights</span>
                  </div>
                  <div className="row2">
                    <span className="avatar avatar--b">J</span>
                    <span><span className="who">Jordan</span><br /><span className="crewtag">Thursday Trivia · Run Club</span></span>
                    <span className="win win--soon">Here till Fri</span>
                  </div>
                  <div className="row2">
                    <span className="avatar avatar--p">S</span>
                    <span><span className="who">Sam</span><br /><span className="crewtag">Run Club</span></span>
                    <span className="win">Around this wknd</span>
                  </div>
                  <div className="privacy"><span className="dot-static" /> You choose your window. It clears itself on Sunday.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* C3 · keep it lit */}
        <div className="band band--tint">
          <div className="wrap">
            <div className="moment reveal">
              <div className="m-copy">
                <span className="lead">Keep it lit</span>
                <h3>Bonfire reaches out before you forget to.</h3>
                <p>
                  It notices when a good thing goes quiet and offers to bring it back. One tap and it
                  plans the whole night. Only for people you actually show up with, and only when you
                  want it.
                </p>
                <span className="note"><span className="ember-mark" /> Opt-in. Crew-only. Never a &ldquo;days since&rdquo; ledger.</span>
              </div>
              <div className="m-art">
                <div className="art-glow" />
                <div className="frame frame--float reconnect">
                  <div className="overline"><span className="ember-mark" style={{ width: 11, height: 11 }} /> RECONNECT</div>
                  <div className="pair">
                    <span className="avatar avatar--g">M</span>
                    <span className="avatar">you</span>
                  </div>
                  <div className="say">
                    You and <em>Maya</em> haven&apos;t lit anything in a few weeks. She&apos;s around
                    Thursday, want me to plan it?
                  </div>
                  <div className="r-foot">
                    <button className="chip-btn" type="button" tabIndex={-1} aria-hidden="true">Plan it</button>
                    <button className="chip-ghost" type="button" tabIndex={-1} aria-hidden="true">Not now</button>
                  </div>
                  <div className="opt-out">Turn Reconnect off anytime in settings.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 3 · QUIET BY DESIGN · coal, the lit room ══ */}
      <section className="s-quiet">
        <div className="wrap">
          <div className="reveal">
            <h2>Built for the hang, not the event.</h2>
            <p className="sub">
              Party apps perfect the invitation. Bonfire perfects the repetition, because
              connection comes from the fourth hang, not the first.
            </p>
          </div>
          <div className="grid reveal">
            <div className="cell">
              <span className="glyph">🔗</span>
              <h3>No app to install</h3>
              <p>A pulse is just a link. It opens in any browser, works for everyone in the chat, and quietly expires when the night ends.</p>
            </div>
            <div className="cell">
              <span className="glyph">📱</span>
              <h3>Your number is your account</h3>
              <p>Verify once and every device knows you. No passwords, no profile to groom, no feed to keep up with.</p>
            </div>
            <div className="cell">
              <span className="glyph">🤫</span>
              <h3>Quiet on purpose</h3>
              <p>No streaks, no read receipts, no out-lists. Missing a night costs nothing. Showing up is the only thing that counts.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 4 · CLOSING · near-black, around the fire ══ */}
      <section className="s-close">
        <div className="sparks" aria-hidden="true">
          <i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
        </div>
        <div className="wrap">
          <div className="reveal">
            <h2>Connection isn&apos;t found.<br /><span className="lit">It&apos;s repeated.</span></h2>
            <p className="sub">The people you see every week don&apos;t stay strangers.</p>
            <Link className="btn btn--primary" href="/p/new">Drop a pulse&ensp;→</Link>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="row">
            <span className="ember-mark" />
            <span className="wordmark">BONFIRE</span>
            <Link className="signin" href="/p/login">Log in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
