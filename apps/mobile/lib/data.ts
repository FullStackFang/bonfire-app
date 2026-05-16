// Single data-access layer. Returns mock data when Supabase isn't configured;
// otherwise queries the real backend. Screens import from here, not from
// supabase or mockSeeds directly.

import { useEffect, useState } from "react";
import type {
  CircleWithMembers,
  Gather,
  GatherResponse,
  InboxItem,
  PresenceEvent,
  User,
  Venue,
} from "@bonfire/shared";
import { supabase, supabaseConfigured } from "./supabase";
import {
  findUser as mockFindUser,
  findVenue as mockFindVenue,
  findCircle as mockFindCircle,
  mockCircles,
  mockGather,
  mockGatherResponses,
  mockInbox,
  mockPresence,
  mockUsers,
  mockVenues,
} from "./mockSeeds";
import { getMockSelfPresence, onMockSelfPresenceChange } from "./mockPresenceStore";
import {
  getMockEvents,
  onMockEventsChange,
  type MapEvent,
} from "./mockEventStore";

const isMock = !supabaseConfigured;

// ---- Users ----

export function usePeople(): { users: User[]; byId: Map<string, User> } {
  const [users, setUsers] = useState<User[]>(isMock ? mockUsers : []);
  useEffect(() => {
    if (isMock) return;
    supabase.from("users").select("*").then(({ data }) => {
      if (data) setUsers(data as User[]);
    });
  }, []);
  const byId = new Map(users.map((u) => [u.id, u]));
  return { users, byId };
}

export function findUserSync(id: string): User | undefined {
  return mockFindUser(id);
}

// ---- Circles ----

export function useMyCircles(): CircleWithMembers[] {
  const [circles, setCircles] = useState<CircleWithMembers[]>(isMock ? mockCircles : []);
  useEffect(() => {
    if (isMock) return;
    (async () => {
      const { data: cs } = await supabase.from("circles").select("*");
      const { data: ms } = await supabase.from("circle_members").select("*");
      if (cs) {
        const byId = new Map<string, string[]>();
        for (const m of ms ?? []) {
          const arr = byId.get(m.circle_id) ?? [];
          arr.push(m.user_id);
          byId.set(m.circle_id, arr);
        }
        setCircles(
          (cs as CircleWithMembers[]).map((c) => ({
            ...c,
            member_ids: byId.get(c.id) ?? [],
          })),
        );
      }
    })();
  }, []);
  return circles;
}

export function findCircleSync(id: string): CircleWithMembers | undefined {
  return mockFindCircle(id);
}

// ---- Venues ----

export function findVenueSync(id: string | null): Venue | undefined {
  return mockFindVenue(id);
}

export function useVenues(): Venue[] {
  const [venues, setVenues] = useState<Venue[]>(isMock ? mockVenues : []);
  useEffect(() => {
    if (isMock) return;
    supabase.from("venues").select("*").then(({ data }) => {
      if (data) setVenues(data as Venue[]);
    });
  }, []);
  return venues;
}

// ---- Presence ----

function mockPresenceWithSelf(): PresenceEvent[] {
  const self = getMockSelfPresence();
  if (!self || new Date(self.expires_at).getTime() <= Date.now()) return mockPresence;
  return [...mockPresence, self];
}

export function useVisiblePresence(): PresenceEvent[] {
  const [events, setEvents] = useState<PresenceEvent[]>(isMock ? mockPresenceWithSelf() : []);
  useEffect(() => {
    if (isMock) {
      return onMockSelfPresenceChange(() => setEvents(mockPresenceWithSelf()));
    }
    const load = async () => {
      const { data } = await supabase.rpc("visible_presence_for_me");
      if (data) setEvents(data as PresenceEvent[]);
    };
    load();
    const channel = supabase
      .channel("presence-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "presence_events" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  return events;
}

// ---- Gathers ----

export function useGather(id: string): {
  gather: Gather | undefined;
  responses: GatherResponse[];
} {
  const [gather, setGather] = useState<Gather | undefined>(
    isMock && id === mockGather.id ? mockGather : undefined,
  );
  const [responses, setResponses] = useState<GatherResponse[]>(
    isMock && id === mockGather.id ? mockGatherResponses : [],
  );
  useEffect(() => {
    if (isMock) return;
    supabase.from("gathers").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setGather(data as Gather | undefined);
    });
    supabase.from("gather_responses").select("*").eq("gather_id", id).then(({ data }) => {
      if (data) setResponses(data as GatherResponse[]);
    });
  }, [id]);
  return { gather, responses };
}

// ---- Map events (user-placed pins with 1h lifetime) ----

// Re-tick every second so countdowns stay live. Cheap: snapshot is small and
// the store auto-prunes expired entries.
export function useMapEvents(): MapEvent[] {
  const [events, setEvents] = useState<MapEvent[]>(() => getMockEvents().slice());
  useEffect(() => {
    const refresh = () => setEvents(getMockEvents().slice());
    const off = onMockEventsChange(refresh);
    const tick = setInterval(refresh, 1000);
    return () => {
      off();
      clearInterval(tick);
    };
  }, []);
  return events;
}

// ---- Inbox ----

export function useInbox(): InboxItem[] {
  const [items, setItems] = useState<InboxItem[]>(isMock ? mockInbox : []);
  useEffect(() => {
    if (isMock) return;
    const load = async () => {
      const { data } = await supabase
        .from("inbox_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setItems(data as InboxItem[]);
    };
    load();
    const channel = supabase
      .channel("inbox-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inbox_items" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  return items;
}
