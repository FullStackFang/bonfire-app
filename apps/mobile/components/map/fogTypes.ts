// Shared FogMap contract — one source of truth for both platform files
// (FogMap.web.tsx and the native FogMap.tsx fallback must never drift).

import type { VenueKind } from "../../lib/mockV2";

export type FogSelectionKind =
  | "lit" // group territory — permanent, credited
  | "ember" // a staked scout flag, waiting for co-presence
  | "pulse" // someone is there right now
  | "tonight" // the anchor venue during the live sim
  | "personal" // your private map (solo check-ins)
  | "info"; // non-venue notices (e.g. location unavailable)

export interface FogMapSelection {
  kind: FogSelectionKind;
  id?: string;
  title: string;
  subtitle: string;
  /** Optional third line — the move, the ember note, the pulse note. */
  detail?: string;
  /** Venue identity, present when actions (pulse here / drop ember) apply. */
  venue?: { name: string; lng: number; lat: number; kind: VenueKind };
}

export interface FogMapHandle {
  flyTo: (target: { lng: number; lat: number; zoom?: number }) => void;
}

export interface FogMapProps {
  mode: "group" | "self";
  userPos?: { lng: number; lat: number } | null;
  onSelect?: (sel: FogMapSelection | null) => void;
}
