// Native fallback for the fog-of-war map. Expo Go can't load native MapLibre
// (and v1's WebView approach has no place in v2) — so native renders the
// ledger until the maplibre-react-native dev build lands in phase 2.
// Metro resolves FogMap.web.tsx on web, this file everywhere else.
// The interface (types in ./fogTypes) matches the web file exactly.

import { forwardRef, useImperativeHandle } from "react";
import { MapLedger } from "./MapLedger";
import type { FogMapHandle, FogMapProps } from "./fogTypes";

export type { FogMapHandle, FogMapProps, FogMapSelection } from "./fogTypes";

export const FogMap = forwardRef<FogMapHandle, FogMapProps>(function FogMap(
  { mode },
  ref,
) {
  useImperativeHandle(ref, () => ({ flyTo: () => {} }));
  return <MapLedger mode={mode} />;
});
