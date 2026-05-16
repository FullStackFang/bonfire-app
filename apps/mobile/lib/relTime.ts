// Relative time formatter matching the deck's tight visual style.
// "2 min", "8 min", "21 min", "1h 12m", "yesterday".

export function relTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m === 0 ? `${h}h` : `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function timeUntil(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, t - now);
  const min = Math.round(diff / 60_000);
  if (min < 60) return `${min}m left`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h left` : `${h}h ${m}m left`;
}
