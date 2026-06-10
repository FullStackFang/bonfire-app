// Mock cast for the v2 shell (spec: docs/superpowers/specs/2026-06-09-bonfire-mvp-spec-v2.1.md).
// Self-contained on purpose — v1 mockSeeds describes a friend-graph world that
// no longer exists. This file is the offline stand-in until the v2 Supabase
// schema lands; shapes mirror the spec's data model, not the v1 tables.
// Coordinates are real-ish Greenpoint, Brooklyn — the launch neighborhood.

import { avatarColorFor } from "@bonfire/ui-tokens";

export type FireState = "roaring" | "burning" | "dimming" | "embers" | "out";

export interface Member {
  id: string;
  name: string;
  /** "ask me about" — a conversation hook used in person, not browsed. */
  hook: string;
  color: string;
}

export interface AnchorInstance {
  dayLabel: string; // "Thursday"
  timeLabel: string; // "6:30 PM"
  venueName: string;
  lng: number;
  lat: number;
  /** Torch holder's one line. */
  note: string;
  torchHolderId: string;
  /** Member ids who tapped In. */
  inIds: string[];
}

export interface LitVenue {
  id: string;
  name: string;
  lng: number;
  lat: number;
  litLabel: string; // "Lit May 14"
  foundById: string;
  /** "The move" — the one line that travels with the territory. */
  move: string;
}

export interface Ember {
  id: string;
  venueName: string;
  lng: number;
  lat: number;
  note: string;
  droppedById: string;
  fadesLabel: string; // "fades in 3 weeks"
}

export interface Pulse {
  id: string;
  memberId: string;
  venueName: string;
  lng: number;
  lat: number;
  note: string;
  minutesLeft: number;
  comingIds: string[];
}

export interface PersonalSpot {
  id: string;
  name: string;
  lng: number;
  lat: number;
}

const m = (id: string, name: string, hook: string): Member => ({
  id,
  name,
  hook,
  color: avatarColorFor(id),
});

export const members: Member[] = [
  m("maya", "Maya", "bouldering, fermentation projects"),
  m("theo", "Theo", "film photography, bad sci-fi"),
  m("priya", "Priya", "marathon training, dumpling spots"),
  m("sam", "Sam", "woodworking, the perfect negroni"),
  m("noor", "Noor", "urban planning, karaoke"),
  m("dev", "Dev", "chess hustling, vinyl digging"),
  m("alice", "Alice", "open-water swimming, zines"),
  m("jonah", "Jonah", "sourdough, pickup soccer"),
  m("rosa", "Rosa", "birding in McCarren, salsa"),
  m("felix", "Felix", "homebrew, trivia nights"),
  m("iris", "Iris", "ceramics, long bike loops"),
  m("omar", "Omar", "jazz piano, street food"),
  m("june", "June", "bookbinding, climbing"),
  m("leo", "Leo", "kite surfing, espresso nerdery"),
  m("zara", "Zara", "improv, rooftop gardening"),
  m("nate", "Nate", "fly tying, old maps"),
  m("ada", "Ada", "synthesizers, cold plunges"),
  m("kai", "Kai", "surf reports, ramen quests"),
  m("vera", "Vera", "letterpress, tango"),
  m("milo", "Milo", "beekeeping, pub quizzes"),
  m("suki", "Suki", "analog games, natural wine"),
  m("ben", "Ben", "kayaking, smash burgers"),
  m("lena", "Lena", "stand-up, screen printing"),
];

/** You — the person holding the phone. Kept out of the roster on purpose. */
export const selfId = "you";
export const self: Member = m(selfId, "You", "");

export const memberById = (id: string): Member =>
  id === selfId ? self : (members.find((x) => x.id === id) ?? members[0]);

export const group = {
  name: "Greenpoint Embers",
  neighborhood: "Greenpoint",
  capacity: 50,
  fireState: "burning" as FireState,
  /** Recap line for the fire — celebration framing only (spec principle 3). */
  recap: "It roared last Thursday — 11 of you.",
  weeksRunning: 5,
  litSinceLabel: "Lit 4 spots since May",
  vouchesAvailable: 2,
};

// Tonight's torch pick is a glowing ember — Noor's stake. If 3+ check in,
// the demo plays the core loop on the map: ember → co-presence → territory.
export const anchor: AnchorInstance = {
  dayLabel: "Thursday",
  timeLabel: "6:30 PM",
  venueName: "Le Fanfare",
  lng: -73.9546,
  lat: 40.7338,
  note: "Noor staked an ember on the back garden — tonight we find out",
  torchHolderId: "maya",
  inIds: ["maya", "theo", "priya", "noor", "felix", "iris", "omar"],
};

export const mapCenter = { lng: -73.955, lat: 40.7302, zoom: 14.1 };

export const litTerritory: LitVenue[] = [
  { id: "v-blackrabbit", name: "Black Rabbit", lng: -73.9556, lat: 40.7302, litLabel: "Lit May 14", foundById: "maya", move: "back booths by the fireplace" },
  { id: "v-devocion", name: "Devoción", lng: -73.9514, lat: 40.7253, litLabel: "Lit May 21", foundById: "theo", move: "the big table under the skylight" },
  { id: "v-ramona", name: "Ramona", lng: -73.9582, lat: 40.7297, litLabel: "Lit May 28", foundById: "priya", move: "happy hour till 7 — get the frozen one" },
  { id: "v-ona", name: "Oña", lng: -73.9536, lat: 40.727, litLabel: "Lit Jun 4", foundById: "sam", move: "counter seats, ask for Manny" },
];

export const embers: Ember[] = [
  {
    id: "e-fanfare",
    venueName: "Le Fanfare",
    lng: -73.9546,
    lat: 40.7338,
    note: "best back garden in Greenpoint, dead quiet on weeknights",
    droppedById: "noor",
    fadesLabel: "fades in 3 weeks",
  },
  {
    id: "e-pencil",
    venueName: "Pencil Factory",
    lng: -73.9579,
    lat: 40.729,
    note: "old-man-bar energy, perfect post-anchor",
    droppedById: "dev",
    fadesLabel: "fades in 2 weeks",
  },
];

export const pulses: Pulse[] = [
  {
    id: "p-1",
    memberId: "theo",
    venueName: "Devoción",
    lng: -73.9514,
    lat: 40.7253,
    note: "big table in the back until 3",
    minutesLeft: 38,
    comingIds: ["june"],
  },
];

// My Map — private personal territory (solo check-ins). Includes the two
// ember venues: you scouted them alone before staking them for the group.
export const personalSpots: PersonalSpot[] = [
  { id: "s-fanfare", name: "Le Fanfare", lng: -73.9546, lat: 40.7338 },
  { id: "s-pencil", name: "Pencil Factory", lng: -73.9579, lat: 40.729 },
  { id: "s-bakeri", name: "Bakeri", lng: -73.956, lat: 40.7349 },
  { id: "s-arche", name: "Archestratus", lng: -73.9555, lat: 40.732 },
  { id: "s-transmitter", name: "Transmitter Park", lng: -73.9613, lat: 40.7297 },
];
