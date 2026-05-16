// Tiny linear projection: bounds → screen space. Used by the MVP map stage
// to position friend pins and heatmap cells.

import type { PresenceEvent } from "@bonfire/shared";

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export const ITHACA_BOUNDS: Bounds = {
  minLat: 42.435,
  maxLat: 42.448,
  minLng: -76.502,
  maxLng: -76.478,
};

export const ITHACA_CENTER = {
  lat: (ITHACA_BOUNDS.minLat + ITHACA_BOUNDS.maxLat) / 2,
  lng: (ITHACA_BOUNDS.minLng + ITHACA_BOUNDS.maxLng) / 2,
};

// Washington Square Park — central to the Village seed venues.
export const NYC_CENTER = { lat: 40.7308, lng: -73.9973 };

export function projectPoint(
  lat: number,
  lng: number,
  bounds: Bounds,
  width: number,
  height: number,
): { x: number; y: number } {
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * width;
  const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * height;
  return { x, y };
}

// Heatmap points in lat/lng space, weighted by recency. MapLibre's built-in
// heatmap layer does its own kernel falloff, so we don't pre-aggregate here.
export function buildHeatPoints(
  presence: PresenceEvent[],
  now = Date.now(),
): { lat: number; lng: number; weight: number }[] {
  const out: { lat: number; lng: number; weight: number }[] = [];
  for (const e of presence) {
    if (e.ended_at || e.lat == null || e.lng == null) continue;
    const ageMin = Math.max(0, (now - new Date(e.started_at).getTime()) / 60_000);
    const weight = ageMin < 10 ? 1 : ageMin < 30 ? 0.7 : 0.4;
    out.push({ lat: e.lat, lng: e.lng, weight });
  }
  return out;
}

// Heatmap cells: collapse pins into 80px buckets, weight by recency.
export function buildHeatCells(
  presence: PresenceEvent[],
  bounds: Bounds,
  width: number,
  height: number,
  now = Date.now(),
): { x: number; y: number; weight: number }[] {
  const buckets = new Map<string, { x: number; y: number; weight: number }>();
  for (const e of presence) {
    if (e.ended_at || e.lat == null || e.lng == null) continue;
    const p = projectPoint(e.lat, e.lng, bounds, width, height);
    const ageMin = Math.max(0, (now - new Date(e.started_at).getTime()) / 60_000);
    const recency = ageMin < 10 ? 1 : ageMin < 30 ? 0.7 : 0.4;
    const cellX = Math.round(p.x / 80) * 80;
    const cellY = Math.round(p.y / 80) * 80;
    const key = `${cellX},${cellY}`;
    const prev = buckets.get(key);
    if (prev) {
      prev.weight = Math.min(1, prev.weight + recency * 0.3);
    } else {
      buckets.set(key, { x: cellX, y: cellY, weight: recency * 0.6 });
    }
  }
  return Array.from(buckets.values());
}
