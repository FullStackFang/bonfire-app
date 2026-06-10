// Fog of war — web implementation. (spec §Fog of war, §Platform)
// The undiscovered city is black-and-white under a pale mist; color and heat
// return only where the group has actually been. Three stacked layers:
//   1. Colored raster tiles (Carto voyager) — the city as it really is.
//   2. A desaturation veil (canvas with mix-blend-mode: saturation, filled
//      gray) — renders the whole map grayscale. Light pools are punched out,
//      so discovered places keep their true color.
//   3. A heat canvas (normal blending) — pale mist over the undiscovered,
//      punched by the same pools, plus warm ember glow and venue dots inside.
// Lit territory breathes ember; embers glow faint dusk; an active pulse
// breathes spark. During the anchor-night sim, tonight's venue grows with
// each arrival and blooms open at ignition (3+ co-present).
// Native gets components/map/FogMap.tsx (the ledger list) until the
// maplibre-react-native build lands.

import { useEffect, useMemo, useRef } from "react";
import { View, Text } from "react-native";
import maplibregl from "maplibre-gl";
import { light } from "@bonfire/ui-tokens";
import {
  litTerritory,
  embers,
  pulses,
  personalSpots,
  anchor,
  mapCenter,
  memberById,
} from "../../lib/mockV2";
import { useLiveSim } from "../../lib/liveSim";

export interface FogMapSelection {
  title: string;
  subtitle: string;
}

export interface FogMapProps {
  mode: "group" | "self";
  onSelect?: (sel: FogMapSelection | null) => void;
}

interface Pool {
  lng: number;
  lat: number;
  /** Reveal radius in px at zoom 14 (scales 2^Δz). */
  radius: number;
  /** How fully color + clarity return at the pool core (0–1). */
  strength: number;
  /** Heat color drawn inside the pool. */
  color: string;
  /** Dot color at the exact venue point. */
  dot: string;
  breathes: boolean;
  /** Set while the ignition bloom animation runs. */
  ignitedAt?: number | null;
  title: string;
  subtitle: string;
}

// The undiscovered city: grayscale under morning mist — quiet, not menacing.
const MIST = "rgba(250, 247, 243, 0.48)";
const GRAY = "#808080"; // zero-saturation fill for the blend veil
const TILES = ["a", "b", "c", "d"].map(
  (s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png`,
);

let cssInjected = false;
function injectMapCss() {
  if (cssInjected || typeof document === "undefined") return;
  cssInjected = true;
  const style = document.createElement("style");
  style.textContent =
    ".maplibregl-map{position:relative;overflow:hidden;width:100%;height:100%;}" +
    ".maplibregl-canvas-container,.maplibregl-canvas{position:absolute;left:0;top:0;width:100%;height:100%;}" +
    ".maplibregl-canvas{outline:none;}";
  document.head.appendChild(style);
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function fitCanvas(canvas: HTMLCanvasElement, w: number, h: number, dpr: number) {
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function FogMap({ mode, onSelect }: FogMapProps) {
  const sim = useLiveSim();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const desatRef = useRef<HTMLCanvasElement | null>(null);
  const heatRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const rafRef = useRef<number>(0);
  const poolsRef = useRef<Pool[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Rebuild the pool inventory whenever mode or sim state changes.
  const pools = useMemo<Pool[]>(() => {
    if (mode === "self") {
      return personalSpots.map((s) => ({
        lng: s.lng,
        lat: s.lat,
        radius: 44,
        strength: 0.9,
        color: light.emberGlow,
        dot: light.ember,
        breathes: true,
        title: s.name,
        subtitle: "On your map · only you can see this",
      }));
    }

    const arrivalsN = sim.arrivals.length;
    const tonightActive = arrivalsN > 0;

    const lit: Pool[] = litTerritory.map((v) => ({
      lng: v.lng,
      lat: v.lat,
      radius: 64,
      strength: 1,
      color: light.ember,
      dot: light.ember,
      breathes: true,
      title: v.name,
      subtitle: `${v.litLabel} · found by ${memberById(v.foundById).name}`,
    }));

    const emberPools: Pool[] = embers
      // Once tonight is underway, the anchor pool replaces Le Fanfare's ember.
      .filter((e) => !(tonightActive && e.lng === anchor.lng && e.lat === anchor.lat))
      .map((e) => ({
        lng: e.lng,
        lat: e.lat,
        radius: 24,
        strength: 0.5,
        color: light.dusk,
        dot: light.dusk,
        breathes: true,
        title: e.venueName,
        subtitle: `“${e.note}” — ${memberById(e.droppedById).name} · ${e.fadesLabel}`,
      }));

    const pulsePools: Pool[] = pulses.map((p) => {
      const coming = p.comingIds.length + sim.pulseJoins.length;
      return {
        lng: p.lng,
        lat: p.lat,
        radius: 30,
        strength: 0.6,
        color: light.spark,
        dot: light.spark,
        breathes: true,
        title: `${memberById(p.memberId).name} is at ${p.venueName}`,
        subtitle: `“${p.note}” · ${p.minutesLeft} min left · ${coming} coming`,
      };
    });

    const tonight: Pool[] = tonightActive
      ? [
          {
            lng: anchor.lng,
            lat: anchor.lat,
            radius: sim.ignited ? 78 : 24 + arrivalsN * 9,
            strength: sim.ignited ? 1 : 0.55 + arrivalsN * 0.12,
            color: sim.ignited ? light.ember : light.dusk,
            dot: sim.ignited ? light.ember : light.dusk,
            breathes: true,
            ignitedAt: sim.ignitedAt,
            title: anchor.venueName,
            subtitle: sim.ignited
              ? `Lit tonight · found by Noor · ${arrivalsN} here`
              : `Tonight's anchor · ${arrivalsN} checked in`,
          },
        ]
      : [];

    return [...lit, ...emberPools, ...pulsePools, ...tonight];
  }, [mode, sim]);
  poolsRef.current = pools;

  // Map + fog lifecycle (created once).
  useEffect(() => {
    const container = containerRef.current;
    const desatCanvas = desatRef.current;
    const heatCanvas = heatRef.current;
    if (!container || !desatCanvas || !heatCanvas) return;
    injectMapCss();

    const map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {
          carto: {
            type: "raster",
            tiles: TILES,
            tileSize: 256,
            attribution: "© OpenStreetMap contributors © CARTO",
          },
        },
        layers: [{ id: "carto", type: "raster", source: "carto" }],
      },
      center: [mapCenter.lng, mapCenter.lat],
      zoom: mapCenter.zoom,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    map.on("click", (e) => {
      const z = map.getZoom();
      const scale = Math.pow(2, z - 14);
      let hit: Pool | null = null;
      let best = Infinity;
      for (const p of poolsRef.current) {
        const pt = map.project([p.lng, p.lat]);
        const d = Math.hypot(pt.x - e.point.x, pt.y - e.point.y);
        const reach = Math.max(22, p.radius * scale * 0.6);
        if (d < reach && d < best) {
          best = d;
          hit = p;
        }
      }
      onSelectRef.current?.(hit ? { title: hit.title, subtitle: hit.subtitle } : null);
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);

    const punchPool = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      r: number,
      strength: number,
    ) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${strength})`);
      g.addColorStop(0.6, `rgba(0,0,0,${strength * 0.55})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      const dctx = fitCanvas(desatCanvas, w, h, dpr);
      const hctx = fitCanvas(heatCanvas, w, h, dpr);
      if (!dctx || !hctx) return;

      const now = performance.now();
      const breath = 0.5 + 0.5 * Math.sin((now / 3200) * Math.PI * 2); // 3.2s house cadence
      const z = map.getZoom();
      const scale = Math.pow(2, z - 14);

      // Layer 2 — the desaturation veil: gray everywhere color hasn't been earned.
      dctx.globalCompositeOperation = "source-over";
      dctx.clearRect(0, 0, w, h);
      dctx.fillStyle = GRAY;
      dctx.fillRect(0, 0, w, h);

      // Layer 3 — mist over the undiscovered city.
      hctx.globalCompositeOperation = "source-over";
      hctx.clearRect(0, 0, w, h);
      hctx.fillStyle = MIST;
      hctx.fillRect(0, 0, w, h);

      for (const p of poolsRef.current) {
        const pt = map.project([p.lng, p.lat]);
        if (pt.x < -150 || pt.y < -150 || pt.x > w + 150 || pt.y > h + 150) continue;

        // Ignition bloom: ease the pool open over 1.4s.
        let bloom = 1;
        if (p.ignitedAt) {
          bloom = easeOutCubic(Math.min(1, (Date.now() - p.ignitedAt) / 1400));
        }
        const r =
          p.radius * scale * bloom * (p.breathes ? 1 + 0.06 * (breath * 2 - 1) : 1);
        if (r <= 1) continue;

        // Color and clarity return together.
        punchPool(dctx, pt.x, pt.y, r, p.strength);
        punchPool(hctx, pt.x, pt.y, r, Math.min(1, p.strength + 0.1));

        // Heat: the warm glow that lives in the pool.
        const glowAlpha = (0.14 + 0.18 * breath) * p.strength;
        const glow = hctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r * 0.9);
        glow.addColorStop(
          0,
          p.color + Math.round(glowAlpha * 255).toString(16).padStart(2, "0"),
        );
        glow.addColorStop(1, p.color + "00");
        hctx.globalCompositeOperation = "source-over";
        hctx.fillStyle = glow;
        hctx.beginPath();
        hctx.arc(pt.x, pt.y, r * 0.9, 0, Math.PI * 2);
        hctx.fill();

        // The venue point itself.
        hctx.fillStyle = p.dot;
        hctx.beginPath();
        hctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
        hctx.fill();
      }
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: light.cream }}>
      {/* isolation keeps the saturation blend scoped to the map stack */}
      <div style={{ position: "absolute", inset: 0, isolation: "isolate" }}>
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
        <canvas
          ref={desatRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            mixBlendMode: "saturation",
          }}
        />
        <canvas
          ref={heatRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      </div>
      <Text
        style={{
          position: "absolute",
          bottom: 4,
          left: 8,
          color: light.smoke,
          fontSize: 9,
          fontFamily: "Onest_400Regular",
        }}
      >
        © OpenStreetMap © CARTO
      </Text>
    </View>
  );
}
