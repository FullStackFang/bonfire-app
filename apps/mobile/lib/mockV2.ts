// Mock cast for the v2 shell (spec: docs/superpowers/specs/2026-06-09-bonfire-mvp-spec-v2.1.md).
// Self-contained on purpose — v1 mockSeeds describes a friend-graph world that
// no longer exists. This file is the offline stand-in until the v2 Supabase
// schema lands; shapes mirror the spec's data model, not the v1 tables.

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
  /** Torch holder's one line. */
  note: string;
  torchHolderId: string;
  /** Member ids who tapped In. */
  inIds: string[];
}

export interface LitVenue {
  id: string;
  name: string;
  litLabel: string; // "Lit May 14"
  foundById: string;
}

export interface Ember {
  id: string;
  venueName: string;
  note: string;
  droppedById: string;
  fadesLabel: string; // "fades in 3 weeks"
}

export interface Pulse {
  id: string;
  memberId: string;
  venueName: string;
  note: string;
  minutesLeft: number;
  comingIds: string[];
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

export const memberById = (id: string): Member =>
  members.find((x) => x.id === id) ?? members[0];

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

export const anchor: AnchorInstance = {
  dayLabel: "Thursday",
  timeLabel: "6:30 PM",
  venueName: "Black Rabbit",
  note: "back patio, order the mortadella",
  torchHolderId: "maya",
  inIds: ["maya", "theo", "priya", "noor", "felix", "iris", "omar"],
};

export const litTerritory: LitVenue[] = [
  { id: "v-blackrabbit", name: "Black Rabbit", litLabel: "Lit May 14", foundById: "maya" },
  { id: "v-devocion", name: "Devoción", litLabel: "Lit May 21", foundById: "theo" },
  { id: "v-ramona", name: "Ramona", litLabel: "Lit May 28", foundById: "priya" },
  { id: "v-ona", name: "Oña", litLabel: "Lit Jun 4", foundById: "sam" },
];

export const embers: Ember[] = [
  {
    id: "e-fanfare",
    venueName: "Le Fanfare",
    note: "best back garden in Greenpoint, dead quiet on weeknights",
    droppedById: "noor",
    fadesLabel: "fades in 3 weeks",
  },
  {
    id: "e-pencil",
    venueName: "Pencil Factory",
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
    note: "big table in the back until 3",
    minutesLeft: 38,
    comingIds: ["june"],
  },
];
