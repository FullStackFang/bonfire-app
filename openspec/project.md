# Project: Bonfire

Bonfire is a real-time presence + lightweight events app for friend circles. The map is the product; the home surface is a live map of friends and bonfires (user-placed events) around the user.

## Capabilities tracked here

- **map-events** — user-placed bonfires that appear as pins on the map. Lifecycle, display variants, RSVP, and ancillary surfaces (nearby footer, detail screen, list, legend).
- *(more added as they're specced)*

## Conventions

- Mobile app lives in `apps/mobile`. Expo Router for navigation; mock data layer in `apps/mobile/lib/` until Supabase is wired.
- Specs in this folder describe **behaviour the app must exhibit**, not implementation details. File paths only appear in `tasks.md`.
- Change deltas use the OpenSpec format: `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, each with `### Requirement:` blocks and `#### Scenario:` WHEN/THEN bodies.
