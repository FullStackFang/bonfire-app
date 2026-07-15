# Pulse Link — UI kit

The flagship Live Pulse surface: **the shared pulse-link web view**, as it opens in mobile Safari with no app and no account.

`index.html` is a working click-through:
- **Presence roster** — everyone's current self-reported status (around / at the pool / asleep / out) + optional note. "You" is highlighted in ember.
- **Live sparks** — droppable one-line plans (title + place + time-or-"now") with a head-count and an "I'm in" toggle. Tap **I'm in** to join/leave; the count updates.
- **Drop a spark** — the primary chunky CTA opens a slide-up sheet; add a spark and it appears fresh (ember glow) at the top of Live now.
- **Set your status** — the round control opens a status sheet; pick a state + note and your roster row updates.

Composes the design-system primitives (StatusPill, PresenceRow, SparkCard, Avatar, Ember, chunky CTA). Rendered self-contained here for reliability; in production these come from `window.Bonfire`.
