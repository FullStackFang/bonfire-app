export type Status = "available" | "out" | "down" | "place" | "invisible";

export const STATUS_LABEL: Record<Status, string> = {
  available: "Available now",
  out: "Out tonight",
  down: "Down for something",
  place: "At a place",
  invisible: "Invisible",
};

export const STATUS_SHORT: Record<Status, string> = {
  available: "Available",
  out: "Out",
  down: "Down",
  place: "Out",
  invisible: "Invisible",
};

export const STATUS_ORDER: Status[] = ["available", "out", "down", "place", "invisible"];

export type Profile = {
  id: string;
  display_name: string;
  gradient_from: string;
  gradient_to: string;
  phone_e164: string;
  expo_push_token: string | null;
  tz: string | null;
  created_at: string;
};

export type PresenceRow = {
  user_id: string;
  status: Status;
  note: string | null;
  lat: number | null;
  lng: number | null;
  expires_at: string;
  updated_at: string;
};

export type PlanVisibility = "friends" | "fof" | "network" | "everyone";

export type PlanRow = {
  id: string;
  short_id: string;
  creator_id: string;
  title: string;
  vibe: string | null;
  lat: number;
  lng: number;
  visibility: PlanVisibility;
  expires_at: string;
  created_at: string;
};

export type PlanAttendeeState = "in" | "interested" | "out";
