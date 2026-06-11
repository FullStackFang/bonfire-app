/** Brightness ∝ repeat visits. Floor keeps single visits visible; max glows fully. */
export function glowOpacity(visits: number, maxVisits: number): number {
  if (maxVisits <= 0) return 0.35
  return 0.35 + 0.65 * (visits / maxVisits)
}
