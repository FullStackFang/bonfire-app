// Bonfire domain types. Mirror the columns defined in supabase/migrations.

export type Intent = "available_now" | "out_today" | "out_tonight";

export const INTENT_LABEL: Record<Intent, string> = {
  available_now: "Available now",
  out_today: "Out today",
  out_tonight: "Out tonight",
};

export const INTENT_DESCRIPTION: Record<Intent, string> = {
  available_now: "Active for the next 60 minutes. Auto-detects your venue.",
  out_today: "Floating around until evening. Shows up on the map all day.",
  out_tonight: "Active for the night-time loop, 6pm onward.",
};

export const INTENT_DURATION_MS: Record<Intent, number> = {
  available_now: 60 * 60 * 1000,
  out_today: 8 * 60 * 60 * 1000,
  out_tonight: 6 * 60 * 60 * 1000,
};

export type User = {
  id: string;
  phone_hash: string;
  display_name: string;
  letter_pair: string;
  avatar_color: string;
  created_at: string;
};

export type Circle = {
  id: string;
  owner_id: string;
  name: string;
  accent_color: string;
  created_at: string;
};

export type CircleMember = {
  circle_id: string;
  user_id: string;
  added_at: string;
};

export type CircleWithMembers = Circle & {
  member_ids: string[];
};

export type Friendship = {
  user_a: string;
  user_b: string;
  established_via: "contact_match" | "qr" | "phone_search";
  created_at: string;
};

export type Venue = {
  id: string;
  name: string;
  category: "bar" | "restaurant" | "cafe" | "other";
  neighborhood: string | null;
  lat: number;
  lng: number;
  opentable_rid: string | null;
  resy_id: string | null;
};

export type PresenceEvent = {
  id: string;
  user_id: string;
  intent: Intent;
  visible_to_circle_ids: string[];
  venue_id: string | null;
  lat: number | null;
  lng: number | null;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
};

export type Gather = {
  id: string;
  host_id: string;
  title: string;
  starts_at: string | null;
  primary_venue_id: string | null;
  candidate_venue_ids: string[];
  invited_circle_ids: string[];
  party_size_target: number | null;
  reservation_provider: "opentable" | "resy" | null;
  reservation_url: string | null;
  created_at: string;
  ended_at: string | null;
};

export type GatherResponse = {
  gather_id: string;
  user_id: string;
  response: "in" | "maybe" | "out";
  responded_at: string;
};

export type InboxKind =
  | "friend_live"
  | "gather_invite"
  | "heatmap_hot"
  | "friend_arrived"
  | "milestone";

export type InboxItem = {
  id: string;
  recipient_id: string;
  kind: InboxKind;
  payload: Record<string, unknown>;
  source_event_id: string | null;
  created_at: string;
  read_at: string | null;
};

export type UserLocation = {
  lat: number;
  lng: number;
  accuracy_m: number | null;
};
