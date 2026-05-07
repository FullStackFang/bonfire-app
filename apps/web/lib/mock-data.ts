import type { User, Plan } from "./types";

/**
 * Mock data for early development.
 * When you wire up Supabase, replace these with queries against
 * the `presence` and `plans` tables.
 */
export const MOCK_USERS: User[] = [
  { id: "u1", name: "Sarah",   initials: "SK", x: 51, y: 22, status: "out",       gradient: ["#ff6b6b", "#ff8e53"], note: "thinking rooftop",   distance: "0.2 mi", showNote: true },
  { id: "u2", name: "Josh M.", initials: "JM", x: 49, y: 41, status: "down",      gradient: ["#a78bfa", "#7c3aed"], note: "down for anything",  distance: "0.4 mi" },
  { id: "u3", name: "Lydia",   initials: "LP", x: 55, y: 53, status: "available", gradient: ["#22d3ee", "#0891b2"], note: "walking around",     distance: "0.5 mi" },
  { id: "u4", name: "Alex",    initials: "AT", x: 49, y: 67, status: "place",     gradient: ["#f59e0b", "#d97706"], note: "at attaboy",         distance: "0.3 mi" },
  { id: "u5", name: "Riley",   initials: "RR", x: 68, y: 60, status: "out",       gradient: ["#ec4899", "#be185d"], note: "late dinner vibes",  distance: "0.6 mi" },
  { id: "u6", name: "Mike",    initials: "MV", x: 53, y: 33, status: "available", gradient: ["#10b981", "#059669"], note: "free for an hour",   distance: "0.4 mi" },
  { id: "u7", name: "Nina",    initials: "NB", x: 78, y: 80, status: "down",      gradient: ["#0ea5e9", "#1e40af"], note: "brooklyn vibes",     distance: "1.4 mi" },
  { id: "u8", name: "Theo",    initials: "TG", x: 18, y: 75, status: "available", gradient: ["#84cc16", "#365314"], note: "exploring SI",       distance: "3.2 mi" },
];

export const MOCK_PLANS: Plan[] = [
  { id: "p1", title: "Drinks @ 8",            vibe: "🍺 Drinks", count: 4, x: 56, y: 48, distance: "0.3 mi", faces: ["#ff6b6b", "#a78bfa", "#22d3ee", "#f59e0b"] },
  { id: "p2", title: "Walk in Battery Park",  vibe: "🚶 Walk",   count: 2, x: 45, y: 78, distance: "0.7 mi", faces: ["#10b981", "#ec4899"] },
];
