// Lightweight pub/sub store for the user's own presence in mock (no-Supabase)
// mode. go-live writes here; useVisiblePresence merges it into the feed.

import type { PresenceEvent } from "@bonfire/shared";

let current: PresenceEvent | null = null;
const listeners = new Set<() => void>();

export function setMockSelfPresence(event: PresenceEvent | null): void {
  current = event;
  listeners.forEach((cb) => cb());
}

export function getMockSelfPresence(): PresenceEvent | null {
  return current;
}

export function onMockSelfPresenceChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
