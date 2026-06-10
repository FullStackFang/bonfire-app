// Native fallback for the fog-of-war map. Expo Go can't load native MapLibre
// (and v1's WebView approach has no place in v2) — so native renders the
// ledger until the maplibre-react-native dev build lands in phase 2.
// Metro resolves FogMap.web.tsx on web, this file everywhere else.

import { MapLedger } from "./MapLedger";

export interface FogMapSelection {
  title: string;
  subtitle: string;
}

export interface FogMapProps {
  mode: "group" | "self";
  onSelect?: (sel: FogMapSelection | null) => void;
}

export function FogMap({ mode }: FogMapProps) {
  return <MapLedger mode={mode} />;
}
