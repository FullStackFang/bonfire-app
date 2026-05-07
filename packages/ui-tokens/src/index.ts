import type { Status } from "@bonfire/shared";

export const colors = {
  bg: "#0a0a0c",
  bgRaised: "#141418",
  surface: "rgba(255, 255, 255, 0.92)",
  surfaceStrong: "rgba(255, 255, 255, 0.97)",
  surfaceDark: "rgba(20, 20, 22, 0.85)",
  border: "rgba(0, 0, 0, 0.08)",
  borderStrong: "rgba(0, 0, 0, 0.12)",
  borderDark: "rgba(255, 255, 255, 0.08)",

  text: "rgba(20, 20, 22, 0.96)",
  textMuted: "rgba(20, 20, 22, 0.55)",
  textFaint: "rgba(20, 20, 22, 0.38)",
  textInverse: "rgba(245, 245, 247, 0.96)",
  textInverseMuted: "rgba(245, 245, 247, 0.55)",

  accent: "#ff5c3a",
  accentWarm: "#ff8c42",
  accentGlow: "rgba(255, 92, 58, 0.45)",
} as const;

export const statusColor: Record<Status, string> = {
  available: "#00c46a",
  out: "#ff8c42",
  down: "#9333ea",
  place: "#0891b2",
  invisible: "#6b7280",
};

export const statusGlow: Record<Status, string> = {
  available: "rgba(0, 196, 106, 0.55)",
  out: "rgba(255, 140, 66, 0.55)",
  down: "rgba(147, 51, 234, 0.55)",
  place: "rgba(8, 145, 178, 0.55)",
  invisible: "rgba(107, 114, 128, 0.4)",
};

export const radii = {
  sm: 6,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const motion = {
  simmerDuration: 3600,
  noteFloatDuration: 4000,
  livePulseDuration: 2000,
  sheetTiming: 320,
  easeOutBack: [0.18, 0.89, 0.32, 1.18] as const,
  easeStandard: [0.4, 0, 0.2, 1] as const,
} as const;

export const map = {
  cluster: {
    radius: 50,
    maxZoom: 14,
  },
  jitterMeters: 20,
  jitterMinZoom: 17,
  presenceTtlMinutes: 15,
  locationFloorMs: 30_000,
  locationFloorMeters: 75,
} as const;
