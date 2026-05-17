# Add the Discover → Explore → Join event-click workflow

## Why

The `references/event-click-workflow.png` mockup commits to a three-tap path from map discovery to confirmed RSVP, plus a map legend that names the five visual entities a user sees on the map. The app already covers steps 1 and 2 (pin tap → detail screen with attendees/distance/weather), but several pieces from the mockup are not yet behaviours of the system:

- Tapping **I'm going!** is not durable — the "You're in!" state lives in `useState` and disappears on remount, so the user's avatar never joins the attendee stack and the count never moves.
- Attendee counts and avatars on the detail screen are invented per-render from a hash of the event id, so the home pin, the "bonfires near you" footer, and the detail screen are free to disagree.
- The legend distinguishes **Live** vs **Upcoming** bonfires, but the model only carries `live_now: boolean` + `expires_at` — there is no notion of an event that hasn't started yet.
- The legend names **Bonfire radius** as a first-class map entity, but no radius is rendered.
- The legend names **More people (number shows how many)** as a pin affordance, but pins only display the title and a countdown.
- There is no surface that shows the legend itself, so the visual vocabulary on the map is undocumented to the user.

This change makes the workflow and its legend real: RSVP becomes a persistent fact about an event, attendee data flows from one source, upcoming events become a modelled state, the radius and headcount become rendered, and the legend becomes a surface a user can open.

## What changes

- **map-events** capability gets requirements for: an event-attendance fact (`attendee_ids`), an event lifecycle (`upcoming | live | ended` derived from `starts_at` / `expires_at` plus an optional host `live_now` override), a headcount affordance on the pin, a gathering-area radius rendered on the map, and a legend surface.
- The detail screen's RSVP toggle becomes the user-facing write path for the attendance fact. The home pin, the "bonfires near you" footer, and the events list all read attendee counts from the same source as the detail screen.
- The seeded mock data set is updated so each seeded bonfire has a believable attendee list, at least two upcoming seeds exist, and the legend has something to point at out of the box.

## Impact

- Affected capability spec: `map-events` (new — this change creates it).
- Affected surfaces in the app: home map, event pin, event detail, event list, "bonfires near you" footer, and the new legend sheet.
- No backend impact (still mock-only). The shape changes here (`attendee_ids`, `starts_at`) are the shape we want when Supabase is wired, so the Supabase migration that follows can mirror this spec.
- Breaking for any in-flight work that reads `MapEvent.live_now` as the sole source of liveness — that field stays, but `live` is now a derived status that callers should read instead.
