// Lightweight pub/sub store for user-created map events in mock (no-Supabase)
// mode. The home map reads from here via useMapEvents.

export type MapEvent = {
  id: string;
  host_id: string;
  title: string;
  address: string | null;
  lat: number;
  lng: number;
  live_now: boolean;
  created_at: string;
  expires_at: string;
};

let events: MapEvent[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

export function getMockEvents(): MapEvent[] {
  // Prune anything past its expiry so screens never see stale events.
  const now = Date.now();
  const fresh = events.filter((e) => new Date(e.expires_at).getTime() > now);
  if (fresh.length !== events.length) {
    events = fresh;
    queueMicrotask(notify);
  }
  return events;
}

export function addMockEvent(event: MapEvent): void {
  events = [...events, event];
  notify();
}

export function removeMockEvent(id: string): void {
  const next = events.filter((e) => e.id !== id);
  if (next.length === events.length) return;
  events = next;
  notify();
}

export function onMockEventsChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
