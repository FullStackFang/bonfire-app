// Lightweight pub/sub store for user-created map events in mock (no-Supabase)
// mode. The home map reads from here via useMapEvents.

import { mockMapEventSeeds } from "./mockSeeds";

export type MapEvent = {
  id: string;
  host_id: string;
  title: string;
  address: string | null;
  lat: number;
  lng: number;
  // Host override: forces an upcoming event into live status before
  // starts_at. Cannot un-live an event that's already in its window, and
  // cannot revive an ended event. See getEventStatus.
  live_now: boolean;
  created_at: string;
  // When the gathering is meant to begin. Before this, the event reads as
  // "upcoming" (unless live_now is set). For walk-up bonfires this is
  // typically equal to created_at.
  starts_at: string;
  expires_at: string;
  // Optional, host-editable. Surfaced on the event detail view.
  description: string | null;
  what_to_bring: string | null;
  // Users who have RSVP'd to this event. Host is NOT auto-included; the host
  // is rendered as "host" elsewhere and joining is a separate signal.
  attendee_ids: string[];
  // Circles the host invited at create time. Empty = open to anyone nearby.
  // Visibility-only in mock mode; no notification side effects.
  invited_circle_ids: string[];
};

export type EventStatus = "upcoming" | "live" | "ended";

// Derived lifecycle. starts_at / expires_at are the source of truth; the
// host's live_now flag can pull an upcoming event live early, but cannot
// push a live event back to upcoming and cannot revive an ended one.
export function getEventStatus(event: MapEvent, now: number = Date.now()): EventStatus {
  const start = new Date(event.starts_at).getTime();
  const end = new Date(event.expires_at).getTime();
  if (now >= end) return "ended";
  if (now >= start) return "live";
  return event.live_now ? "live" : "upcoming";
}

// Seeded events hydrate the store on first import so the home map +
// "bonfires near you" footer have content before any user pin is placed.
// The cast widens each seed to the optional shape — keeps the spread happy
// when a future seed omits description/what_to_bring without forcing every
// existing one to repeat null explicitly.
type SeedShape = Omit<
  MapEvent,
  "description" | "what_to_bring" | "attendee_ids" | "invited_circle_ids" | "starts_at"
> &
  Partial<
    Pick<
      MapEvent,
      "description" | "what_to_bring" | "attendee_ids" | "invited_circle_ids" | "starts_at"
    >
  >;

let events: MapEvent[] = mockMapEventSeeds.map((raw) => {
  const seed = raw as SeedShape;
  return {
    ...seed,
    description: seed.description ?? null,
    what_to_bring: seed.what_to_bring ?? null,
    attendee_ids: seed.attendee_ids ?? [],
    invited_circle_ids: seed.invited_circle_ids ?? [],
    // Walk-up bonfires start the moment they're created; upcoming seeds
    // override this with a future timestamp.
    starts_at: seed.starts_at ?? seed.created_at,
  };
});
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

export function findMockEvent(id: string): MapEvent | undefined {
  return events.find((e) => e.id === id);
}

export function updateMockEvent(
  id: string,
  patch: Partial<
    Pick<MapEvent, "title" | "address" | "live_now" | "description" | "what_to_bring">
  >,
): MapEvent | undefined {
  let updated: MapEvent | undefined;
  events = events.map((e) => {
    if (e.id !== id) return e;
    updated = { ...e, ...patch };
    return updated;
  });
  if (updated) notify();
  return updated;
}

// Idempotent: joining twice is the same as joining once. Returns the updated
// event (or undefined if the id is unknown) so callers can read back the new
// attendee_ids without a separate find.
export function joinMockEvent(id: string, userId: string): MapEvent | undefined {
  let updated: MapEvent | undefined;
  events = events.map((e) => {
    if (e.id !== id) return e;
    if (e.attendee_ids.includes(userId)) {
      updated = e;
      return e;
    }
    updated = { ...e, attendee_ids: [...e.attendee_ids, userId] };
    return updated;
  });
  if (updated && updated.attendee_ids.includes(userId)) notify();
  return updated;
}

export function leaveMockEvent(id: string, userId: string): MapEvent | undefined {
  let updated: MapEvent | undefined;
  let changed = false;
  events = events.map((e) => {
    if (e.id !== id) return e;
    if (!e.attendee_ids.includes(userId)) {
      updated = e;
      return e;
    }
    changed = true;
    updated = { ...e, attendee_ids: e.attendee_ids.filter((u) => u !== userId) };
    return updated;
  });
  if (changed) notify();
  return updated;
}

export function onMockEventsChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
