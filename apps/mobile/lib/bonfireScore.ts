// Deterministic Bonfire score formula per spec §7.5.
// score = 40 + 8*friends_here + 3*arrivals_last_hour + 2*heatmap_neighbors
//         - 0.3*minutes_since_peak
// Clamped 0..99. Cached per venue.

import type { PresenceEvent } from "@bonfire/shared";

export function bonfireScoreForVenue(
  venueId: string,
  presence: PresenceEvent[],
  now = Date.now(),
): number {
  const here = presence.filter((p) => p.venue_id === venueId && !p.ended_at);
  const friendsHere = here.length;

  const arrivalsLastHour = here.filter((p) => {
    const ageMin = (now - new Date(p.started_at).getTime()) / 60_000;
    return ageMin <= 60;
  }).length;

  // Heatmap neighbors: count presence events at OTHER venues within "nearby" — we approximate
  // by counting any active event in the same neighborhood. We don't have a join here so just
  // count all live events (good enough for MVP).
  const heatmapNeighbors = Math.min(8, presence.filter((p) => !p.ended_at && p.venue_id && p.venue_id !== venueId).length);

  // Minutes since peak: oldest active event's age.
  let minutesSincePeak = 0;
  if (here.length > 0) {
    const oldest = Math.max(...here.map((p) => now - new Date(p.started_at).getTime()));
    minutesSincePeak = oldest / 60_000;
  }

  const raw =
    40 +
    8 * friendsHere +
    3 * arrivalsLastHour +
    2 * heatmapNeighbors -
    0.3 * minutesSincePeak;

  return Math.max(0, Math.min(99, Math.round(raw)));
}
