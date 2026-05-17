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
import { ITHACA_CENTER, NYC_CENTER } from "./mapProjection";

// Which city's seed data is active. Override at build time with
// EXPO_PUBLIC_SEED_CITY=ithaca to switch back to Cornell-area mocks.
const SEED_CITY = (process.env.EXPO_PUBLIC_SEED_CITY ?? "nyc") as "nyc" | "ithaca";

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

const ithacaVenues: Venue[] = [
  { id: "v-maxie",   name: "Maxie's Supper Club", category: "bar",        neighborhood: "Collegetown", lat: 42.4423, lng: -76.4854, opentable_rid: "12345", resy_id: null },
  { id: "v-hai",     name: "Hai Hong",            category: "restaurant", neighborhood: "Collegetown", lat: 42.4419, lng: -76.4862, opentable_rid: null, resy_id: "hai-hong" },
  { id: "v-coal",    name: "Coal Yard",           category: "bar",        neighborhood: "Downtown",    lat: 42.4400, lng: -76.4985, opentable_rid: null, resy_id: null },
  { id: "v-gimme",   name: "Gimme Coffee",        category: "cafe",       neighborhood: "Downtown",    lat: 42.4404, lng: -76.4970, opentable_rid: null, resy_id: null },
  { id: "v-watershed", name: "The Watershed",     category: "bar",        neighborhood: "Downtown",    lat: 42.4391, lng: -76.4961, opentable_rid: null, resy_id: null },
];

const nycVenues: Venue[] = [
  { id: "v-reggio",    name: "Caffe Reggio",     category: "cafe",       neighborhood: "Greenwich Village", lat: 40.7298, lng: -74.0007, opentable_rid: null, resy_id: null },
  { id: "v-joes",      name: "Joe's Pizza",      category: "restaurant", neighborhood: "West Village",      lat: 40.7305, lng: -74.0024, opentable_rid: null, resy_id: null },
  { id: "v-dnc",       name: "Death & Co",       category: "bar",        neighborhood: "East Village",      lat: 40.7264, lng: -73.9853, opentable_rid: null, resy_id: "death-co" },
  { id: "v-stumptown", name: "Stumptown Coffee", category: "cafe",       neighborhood: "NoMad",             lat: 40.7448, lng: -73.9883, opentable_rid: null, resy_id: null },
  { id: "v-mcsorleys", name: "McSorley's",       category: "bar",        neighborhood: "East Village",      lat: 40.7283, lng: -73.9893, opentable_rid: null, resy_id: null },
];

const ithacaPresence: PresenceEvent[] = [
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

// Deterministic per-event attendee seeder. Picks 4-8 non-host, non-self
// users in a stable order so the count and avatar identities never churn
// between renders. The detail screen previously invented these from the
// same event id; now they're a real fact about the event so the home pin,
// the "near you" footer, and the detail screen all agree.
function seedAttendees(eventId: string, hostId: string): string[] {
  let h = 0;
  for (let i = 0; i < eventId.length; i++) h = (h * 31 + eventId.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const candidates = mockUsers
    .filter((u) => u.id !== hostId && u.id !== "u-self")
    .map((u, i) => ({ id: u.id, sort: ((h + i * 31) ^ (i * 7)) >>> 0 }))
    .sort((a, b) => a.sort - b.sort)
    .map((x) => x.id);
  const count = Math.min(candidates.length, 4 + (h % 5)); // 4-8
  return candidates.slice(0, count);
}

// Seeded MapEvents (user-placed bonfires). Hydrated into mockEventStore on
// first import so the "bonfires near you" footer has content out of the box.
// Same shape as MapEvent in lib/mockEventStore — kept untyped here to avoid
// a circular import.
const nycMapEvents = [
  {
    id: "e-seed-1",
    host_id: "u-josh",
    title: "Washington Sq chess",
    address: "Washington Square Park, NW corner",
    lat: 40.7312,
    lng: -74.0014,
    live_now: true,
    created_at: minsAgo(8),
    expires_at: minsFromNow(42),
    description:
      "Casual blitz tables under the arch. New players welcome — Josh will spot you a queen if you need it.",
    what_to_bring: "Yourself. Boards and clocks are already out.",
  },
  {
    id: "e-seed-2",
    host_id: "u-maya",
    title: "Joe's late slice",
    address: "Joe's Pizza, Carmine St",
    lat: 40.7305,
    lng: -74.0024,
    live_now: true,
    created_at: minsAgo(3),
    expires_at: minsFromNow(18),
    description: "Quick slice run before the bars. Roll through whenever.",
    what_to_bring: "Cash for the second slice.",
  },
  {
    id: "e-seed-3",
    host_id: "u-kim",
    title: "McSorley's pints",
    address: "McSorley's Old Ale House",
    lat: 40.7283,
    lng: -73.9893,
    live_now: false,
    created_at: minsAgo(20),
    expires_at: minsFromNow(40),
    description:
      "Light or dark — they only serve two beers. Long table at the back, ask for Kim.",
    what_to_bring: "Cash only. Bring some ones for tips.",
  },
  {
    id: "e-seed-4",
    host_id: "u-sarah",
    title: "Stumptown coffee meetup",
    address: "Stumptown Coffee, NoMad",
    lat: 40.7448,
    lng: -73.9883,
    live_now: true,
    created_at: minsAgo(12),
    expires_at: minsFromNow(55),
    description: "Working remote and looking for company. Pull up, no agenda.",
    what_to_bring: "Laptop, headphones if you want a working zone.",
  },
  {
    id: "e-seed-upcoming-1",
    host_id: "u-lydia",
    title: "Sunset run, the loop",
    address: "Washington Square Park fountain",
    lat: 40.7308,
    lng: -73.9973,
    live_now: false,
    created_at: minsAgo(45),
    starts_at: minsFromNow(25),
    expires_at: minsFromNow(85),
    description:
      "Easy 5k loop down to the river and back. Bringing a small speaker.",
    what_to_bring: "Shoes you can actually run in.",
  },
];

const ithacaMapEvents = [
  {
    id: "e-seed-1",
    host_id: "u-josh",
    title: "Pickup soccer on the slope",
    address: "Libe Slope",
    lat: 42.4474,
    lng: -76.4866,
    live_now: true,
    created_at: minsAgo(5),
    expires_at: minsFromNow(40),
    description: "Casual 5v5, rolling subs. Skill level: anything.",
    what_to_bring: "Cleats if you have them, water.",
  },
  {
    id: "e-seed-2",
    host_id: "u-maya",
    title: "Gimme study session",
    address: "Gimme Coffee, Downtown",
    lat: 42.4404,
    lng: -76.4970,
    live_now: false,
    created_at: minsAgo(15),
    expires_at: minsFromNow(35),
    description: "Heads-down work block until 6. Quiet table reserved.",
    what_to_bring: "Laptop, your loudest playlist on noise-cancelling.",
  },
  {
    id: "e-seed-upcoming-1",
    host_id: "u-lydia",
    title: "Cornell cinema double feature",
    address: "Cornell Cinema, Willard Straight",
    lat: 42.4459,
    lng: -76.4849,
    live_now: false,
    created_at: minsAgo(60),
    starts_at: minsFromNow(25),
    expires_at: minsFromNow(180),
    description: "Two 35mm prints back-to-back. Grab seats up top.",
    what_to_bring: "Snacks from the lobby are fine, nothing too crunchy.",
  },
];

const nycPresence: PresenceEvent[] = [
  {
    id: "p-1",
    user_id: "u-sarah",
    intent: "available_now",
    visible_to_circle_ids: ["c-cornell"],
    venue_id: "v-reggio",
    lat: 40.7298,
    lng: -74.0007,
    started_at: minsAgo(2),
    expires_at: minsFromNow(58),
    ended_at: null,
  },
  {
    id: "p-2",
    user_id: "u-josh",
    intent: "available_now",
    visible_to_circle_ids: ["c-cornell"],
    venue_id: "v-stumptown",
    lat: 40.7448,
    lng: -73.9883,
    started_at: minsAgo(8),
    expires_at: minsFromNow(52),
    ended_at: null,
  },
  {
    id: "p-3",
    user_id: "u-maya",
    intent: "available_now",
    visible_to_circle_ids: ["c-cornell"],
    venue_id: "v-reggio",
    lat: 40.7298,
    lng: -74.0007,
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
    lat: 40.7280,
    lng: -73.9920,
    started_at: minsAgo(45),
    expires_at: minsFromNow(180),
    ended_at: null,
  },
  {
    id: "p-5",
    user_id: "u-kim",
    intent: "out_today",
    visible_to_circle_ids: ["c-cornell", "c-nyc"],
    venue_id: "v-dnc",
    lat: 40.7264,
    lng: -73.9853,
    started_at: minsAgo(35),
    expires_at: minsFromNow(150),
    ended_at: null,
  },
];

const ithacaGather: Gather = {
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

const nycGather: Gather = {
  id: "g-1",
  host_id: "u-sarah",
  title: "Dinner in the Village",
  starts_at: minsFromNow(180),
  primary_venue_id: "v-joes",
  candidate_venue_ids: ["v-joes", "v-reggio", "v-dnc"],
  invited_circle_ids: ["c-cornell"],
  party_size_target: 6,
  reservation_provider: null,
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

const ithacaInbox: InboxItem[] = [
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

const nycInbox: InboxItem[] = [
  {
    id: "i-1",
    recipient_id: "u-self",
    kind: "gather_invite",
    payload: { gather_id: "g-1", title: "Dinner in the Village", host_name: "Sarah", in_count: 4 },
    source_event_id: "g-1",
    created_at: minsAgo(2),
    read_at: null,
  },
  {
    id: "i-2",
    recipient_id: "u-self",
    kind: "friend_live",
    payload: { user_id: "u-josh", user_name: "Josh", venue_id: "v-stumptown", venue_name: "Stumptown Coffee" },
    source_event_id: "p-2",
    created_at: minsAgo(8),
    read_at: null,
  },
  {
    id: "i-3",
    recipient_id: "u-self",
    kind: "heatmap_hot",
    payload: { neighborhood: "Greenwich Village", nearby_count: 5 },
    source_event_id: null,
    created_at: minsAgo(12),
    read_at: null,
  },
  {
    id: "i-4",
    recipient_id: "u-self",
    kind: "friend_arrived",
    payload: { user_id: "u-maya", user_name: "Maya", venue_name: "Caffe Reggio" },
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

// Selected dataset based on SEED_CITY. Helpers (findVenue) read mockVenues
// so they automatically follow the active city.
export const mockVenues: Venue[] = SEED_CITY === "nyc" ? nycVenues : ithacaVenues;
export const mockPresence: PresenceEvent[] = SEED_CITY === "nyc" ? nycPresence : ithacaPresence;
export const mockGather: Gather = SEED_CITY === "nyc" ? nycGather : ithacaGather;
export const mockInbox: InboxItem[] = SEED_CITY === "nyc" ? nycInbox : ithacaInbox;
export const mockMapEventSeeds = (SEED_CITY === "nyc" ? nycMapEvents : ithacaMapEvents).map(
  (s) => ({ ...s, attendee_ids: seedAttendees(s.id, s.host_id) }),
);
export const MOCK_CENTER = SEED_CITY === "nyc" ? NYC_CENTER : ITHACA_CENTER;

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
