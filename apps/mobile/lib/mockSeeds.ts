import type {
  Circle,
  CircleWithMembers,
  Gather,
  GatherResponse,
  InboxItem,
  PresenceEvent,
  User,
  Venue,
} from "@bonfire/shared";
import { avatarAccents, light } from "@bonfire/ui-tokens";

// Deterministic timestamps for snapshot stability.
const now = () => Date.now();
const minsAgo = (m: number) => new Date(now() - m * 60_000).toISOString();
const minsFromNow = (m: number) => new Date(now() + m * 60_000).toISOString();

export const mockUsers: User[] = [
  { id: "u-self",  phone_hash: "self",  display_name: "You",          letter_pair: "Y",  avatar_color: avatarAccents[0], created_at: minsAgo(60000) },
  { id: "u-sarah", phone_hash: "sa",    display_name: "Sarah Park",   letter_pair: "SP", avatar_color: avatarAccents[0], created_at: minsAgo(50000) },
  { id: "u-josh",  phone_hash: "jp",    display_name: "Josh Pizzaro", letter_pair: "JP", avatar_color: avatarAccents[1], created_at: minsAgo(40000) },
  { id: "u-maya",  phone_hash: "ma",    display_name: "Maya Reyes",   letter_pair: "M",  avatar_color: avatarAccents[2], created_at: minsAgo(30000) },
  { id: "u-lydia", phone_hash: "lk",    display_name: "Lydia Kim",    letter_pair: "LK", avatar_color: avatarAccents[3], created_at: minsAgo(25000) },
  { id: "u-kim",   phone_hash: "ki",    display_name: "Kim Tanaka",   letter_pair: "K",  avatar_color: avatarAccents[4], created_at: minsAgo(20000) },
  { id: "u-alex",  phone_hash: "al",    display_name: "Alex Chen",    letter_pair: "A",  avatar_color: avatarAccents[2], created_at: minsAgo(15000) },
  { id: "u-tara",  phone_hash: "ta",    display_name: "Tara Singh",   letter_pair: "T",  avatar_color: avatarAccents[0], created_at: minsAgo(10000) },
  { id: "u-dev",   phone_hash: "de",    display_name: "Devon Reed",   letter_pair: "D",  avatar_color: avatarAccents[5], created_at: minsAgo(8000) },
  { id: "u-nico",  phone_hash: "ni",    display_name: "Nico Ortiz",   letter_pair: "N",  avatar_color: avatarAccents[2], created_at: minsAgo(7000) },
];

export const mockCircles: CircleWithMembers[] = [
  {
    id: "c-cornell",
    owner_id: "u-self",
    name: "Cornell crew",
    accent_color: light.ember,
    created_at: minsAgo(40000),
    member_ids: ["u-sarah", "u-josh", "u-maya", "u-lydia", "u-kim", "u-alex", "u-tara", "u-self"],
  },
  {
    id: "c-nyc",
    owner_id: "u-self",
    name: "NYC group",
    accent_color: "#5E7FE5",
    created_at: minsAgo(30000),
    member_ids: ["u-kim", "u-alex", "u-tara", "u-self"],
  },
  {
    id: "c-room",
    owner_id: "u-self",
    name: "Roommates",
    accent_color: light.spark,
    created_at: minsAgo(20000),
    member_ids: ["u-lydia", "u-dev", "u-nico", "u-self"],
  },
];

export const mockVenues: Venue[] = [
  { id: "v-maxie",   name: "Maxie's Supper Club", category: "bar",        neighborhood: "Collegetown", lat: 42.4423, lng: -76.4854, opentable_rid: "12345", resy_id: null },
  { id: "v-hai",     name: "Hai Hong",            category: "restaurant", neighborhood: "Collegetown", lat: 42.4419, lng: -76.4862, opentable_rid: null, resy_id: "hai-hong" },
  { id: "v-coal",    name: "Coal Yard",           category: "bar",        neighborhood: "Downtown",    lat: 42.4400, lng: -76.4985, opentable_rid: null, resy_id: null },
  { id: "v-gimme",   name: "Gimme Coffee",        category: "cafe",       neighborhood: "Downtown",    lat: 42.4404, lng: -76.4970, opentable_rid: null, resy_id: null },
  { id: "v-watershed", name: "The Watershed",     category: "bar",        neighborhood: "Downtown",    lat: 42.4391, lng: -76.4961, opentable_rid: null, resy_id: null },
];

export const mockPresence: PresenceEvent[] = [
  {
    id: "p-1",
    user_id: "u-sarah",
    intent: "available_now",
    visible_to_circle_ids: ["c-cornell"],
    venue_id: "v-maxie",
    lat: 42.4423,
    lng: -76.4854,
    started_at: minsAgo(2),
    expires_at: minsFromNow(58),
    ended_at: null,
  },
  {
    id: "p-2",
    user_id: "u-josh",
    intent: "available_now",
    visible_to_circle_ids: ["c-cornell"],
    venue_id: "v-gimme",
    lat: 42.4404,
    lng: -76.4970,
    started_at: minsAgo(8),
    expires_at: minsFromNow(52),
    ended_at: null,
  },
  {
    id: "p-3",
    user_id: "u-maya",
    intent: "available_now",
    visible_to_circle_ids: ["c-cornell"],
    venue_id: "v-maxie",
    lat: 42.4423,
    lng: -76.4854,
    started_at: minsAgo(21),
    expires_at: minsFromNow(39),
    ended_at: null,
  },
  {
    id: "p-4",
    user_id: "u-lydia",
    intent: "out_tonight",
    visible_to_circle_ids: ["c-cornell", "c-room"],
    venue_id: null,
    lat: 42.4406,
    lng: -76.4900,
    started_at: minsAgo(45),
    expires_at: minsFromNow(180),
    ended_at: null,
  },
  {
    id: "p-5",
    user_id: "u-kim",
    intent: "out_today",
    visible_to_circle_ids: ["c-cornell", "c-nyc"],
    venue_id: "v-coal",
    lat: 42.4400,
    lng: -76.4985,
    started_at: minsAgo(35),
    expires_at: minsFromNow(150),
    ended_at: null,
  },
];

export const mockGather: Gather = {
  id: "g-1",
  host_id: "u-sarah",
  title: "Dinner downtown",
  starts_at: minsFromNow(180),
  primary_venue_id: "v-maxie",
  candidate_venue_ids: ["v-maxie", "v-hai", "v-coal"],
  invited_circle_ids: ["c-cornell"],
  party_size_target: 6,
  reservation_provider: "opentable",
  reservation_url: null,
  created_at: minsAgo(5),
  ended_at: null,
};

export const mockGatherResponses: GatherResponse[] = [
  { gather_id: "g-1", user_id: "u-sarah", response: "in", responded_at: minsAgo(5) },
  { gather_id: "g-1", user_id: "u-josh",  response: "in", responded_at: minsAgo(4) },
  { gather_id: "g-1", user_id: "u-lydia", response: "in", responded_at: minsAgo(3) },
  { gather_id: "g-1", user_id: "u-maya",  response: "in", responded_at: minsAgo(2) },
  { gather_id: "g-1", user_id: "u-kim",   response: "maybe", responded_at: minsAgo(1) },
  { gather_id: "g-1", user_id: "u-alex",  response: "maybe", responded_at: minsAgo(1) },
];

export const mockInbox: InboxItem[] = [
  {
    id: "i-1",
    recipient_id: "u-self",
    kind: "gather_invite",
    payload: { gather_id: "g-1", title: "Dinner downtown", host_name: "Sarah", in_count: 4 },
    source_event_id: "g-1",
    created_at: minsAgo(2),
    read_at: null,
  },
  {
    id: "i-2",
    recipient_id: "u-self",
    kind: "friend_live",
    payload: { user_id: "u-josh", user_name: "Josh", venue_id: "v-gimme", venue_name: "Gimme Coffee" },
    source_event_id: "p-2",
    created_at: minsAgo(8),
    read_at: null,
  },
  {
    id: "i-3",
    recipient_id: "u-self",
    kind: "heatmap_hot",
    payload: { neighborhood: "Collegetown", nearby_count: 5 },
    source_event_id: null,
    created_at: minsAgo(12),
    read_at: null,
  },
  {
    id: "i-4",
    recipient_id: "u-self",
    kind: "friend_arrived",
    payload: { user_id: "u-maya", user_name: "Maya", venue_name: "Maxie's" },
    source_event_id: "p-3",
    created_at: minsAgo(21),
    read_at: null,
  },
  {
    id: "i-5",
    recipient_id: "u-self",
    kind: "milestone",
    payload: { name: "Prometheus", reason: "first gather hosted" },
    source_event_id: null,
    created_at: new Date(now() - 24 * 60 * 60 * 1000).toISOString(),
    read_at: minsAgo(60),
  },
];

export const mockSession = {
  user: mockUsers[0],
};

export function findUser(id: string): User | undefined {
  return mockUsers.find((u) => u.id === id);
}

export function findVenue(id: string | null): Venue | undefined {
  if (!id) return undefined;
  return mockVenues.find((v) => v.id === id);
}

export function findCircle(id: string): CircleWithMembers | undefined {
  return mockCircles.find((c) => c.id === id);
}
