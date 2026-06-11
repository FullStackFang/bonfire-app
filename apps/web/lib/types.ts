// v1 prototype presence status; was imported from @bonfire/shared, which never shipped it.
export type Status = "available" | "down" | "out" | "place" | "invisible";

export type User = {
  id: string;
  name: string;
  initials: string;
  /** X position as a percentage of the map canvas (0–100) */
  x: number;
  /** Y position as a percentage of the map canvas (0–100) */
  y: number;
  status: Status;
  /** [start, end] colors for the avatar gradient */
  gradient: [string, string];
  note: string;
  distance: string;
  /** Whether the floating "AIM-style" note bubble appears above this avatar */
  showNote?: boolean;
};

export type Plan = {
  id: string;
  title: string;
  vibe: string;
  count: number;
  x: number;
  y: number;
  distance: string;
  /** Colors for the small face avatars stacked in the plan card */
  faces: string[];
};
