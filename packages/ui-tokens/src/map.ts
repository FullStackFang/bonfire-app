// The app's neighborhood-map style, shared so every surface reads as the same map.
// Two consumers import from here: the mobile fog-of-war map (components/map/FogMap.web.tsx)
// and the web pulse location tile (apps/web PulseMap). Single source of truth — change the
// basemap or the warm veil once, both surfaces follow.
//
// Carto Voyager raster is KEYLESS (no provider token), so rendering a tile needs no config;
// only geocoding (text -> coordinate) needs a provider, kept behind a separate server seam.

// The undiscovered city: grayscale under morning mist — quiet, not menacing. The warm veil
// laid over the basemap so the map matches the brand's cream palette, not a generic gray tile.
export const MAP_MIST = "rgba(250, 247, 243, 0.48)";

// Carto Voyager raster tiles across the four subdomains. @2x for retina.
export const CARTO_VOYAGER_TILES = ["a", "b", "c", "d"].map(
  (s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png`,
);

export const CARTO_ATTRIBUTION = "© OpenStreetMap contributors © CARTO";

// A MapLibre v8 StyleSpecification with a single Carto Voyager raster source. Typed loosely
// (the shape is the MapLibre style spec) so this package needs no maplibre dependency; both
// consumers pass it straight to `new maplibregl.Map({ style })`.
export function cartoVoyagerStyle() {
  return {
    version: 8 as const,
    sources: {
      carto: {
        type: "raster" as const,
        tiles: CARTO_VOYAGER_TILES,
        tileSize: 256,
        attribution: CARTO_ATTRIBUTION,
      },
    },
    layers: [{ id: "carto", type: "raster" as const, source: "carto" }],
  };
}
