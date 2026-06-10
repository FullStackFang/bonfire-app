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
// The self marker (userPos) rides the heat canvas: finding yourself never
// reveals territory — only co-presence does.
// Native gets components/map/FogMap.tsx (the ledger list) until the
// maplibre-react-native build lands.

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
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
  selfId,
} from "../../lib/mockV2";
import { useLiveSim } from "../../lib/liveSim";
import { useMapActions } from "../../lib/mapActions";
import type { FogMapHandle, FogMapProps, FogMapSelection } from "./fogTypes";

export type { FogMapHandle, FogMapProps, FogMapSelection } from "./fogTypes";

interface Pool {
  lng: number;
  lat: number;
  /** Reveal radius in px at zoom 14 (scales 2^Δz). */
  radius: number;
  /** How fully color + clarity return at the pool core (0–1). */
  strength: number;
  /** Heat color drawn inside the pool. */
  color: string;
  /** Flame color at the exact venue point. */
  dot: string;
  /** Engagement 0–1 — drives flame size, flicker brightness, glow. */
  heat: number;
  breathes: boolean;
  /** Set while the ignition bloom animation runs. */
  ignitedAt?: number | null;
  sel: FogMapSelection;
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

/** Stable per-pool phase so every flame flickers on its own rhythm. */
function flickerPhase(lng: number, lat: number) {
  return ((lng * 7919 + lat * 104729) % (Math.PI * 2)) + Math.PI * 2;
}

/** Candle flicker: fast, small, irregular — layered sines, no randomness. */
function flickerAt(now: number, phase: number) {
  return (
    0.84 +
    0.11 * Math.sin(now / 95 + phase) +
    0.06 * Math.sin(now / 41 + phase * 1.7) +
    0.04 * Math.sin(now / 23 + phase * 2.9)
  );
}

/** A little teardrop flame with a warm core, base anchored at (x, y). */
function drawFlame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  tipDx: number,
  color: string,
  core: string,
) {
  const w = h * 0.58;
  const flame = (s: number, fill: string) => {
    const hh = h * s;
    const ww = w * s;
    const by = y + hh * 0.28; // base sits just below the anchor point
    ctx.beginPath();
    ctx.moveTo(x + tipDx * s, by - hh * 1.3); // tip, leaning with the flicker
    ctx.bezierCurveTo(x + ww, by - hh * 0.55, x + ww, by - hh * 0.05, x, by);
    ctx.bezierCurveTo(x - ww, by - hh * 0.05, x - ww * 0.55, by - hh * 0.6, x + tipDx * s, by - hh * 1.3);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  flame(1, color);
  flame(0.52, core);
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

export const FogMap = forwardRef<FogMapHandle, FogMapProps>(function FogMap(
  { mode, userPos, onSelect },
  ref,
) {
  const sim = useLiveSim();
  const act = useMapActions();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const desatRef = useRef<HTMLCanvasElement | null>(null);
  const heatRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const rafRef = useRef<number>(0);
  const poolsRef = useRef<Pool[]>([]);
  const userPosRef = useRef<typeof userPos>(userPos);
  userPosRef.current = userPos;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useImperativeHandle(ref, () => ({
    flyTo: (target) => {
      mapRef.current?.flyTo({
        center: [target.lng, target.lat],
        zoom: target.zoom ?? 15,
        duration: 1400,
        essential: true,
      });
    },
  }));

  // Rebuild the pool inventory whenever mode, sim, or your own actions change.
  const pools = useMemo<Pool[]>(() => {
    if (mode === "self") {
      return personalSpots.map((s) => ({
        lng: s.lng,
        lat: s.lat,
        radius: 44,
        strength: 0.9,
        color: light.emberGlow,
        dot: light.ember,
        heat: 0.5,
        breathes: true,
        sel: {
          kind: "personal",
          id: s.id,
          title: s.name,
          subtitle: "On your map · only you can see this",
          venue: { name: s.name, lng: s.lng, lat: s.lat },
        },
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
      // Brighter the more nights the group has burned here.
      heat: Math.min(1, 0.45 + v.nights * 0.14),
      breathes: true,
      sel: {
        kind: "lit",
        id: v.id,
        title: v.name,
        subtitle: `${v.litLabel} · found by ${memberById(v.foundById).name}`,
        detail: `The move: ${v.move}`,
        venue: { name: v.name, lng: v.lng, lat: v.lat },
      },
    }));

    const emberPools: Pool[] = [...embers, ...act.droppedEmbers]
      // Once tonight is underway, the anchor pool replaces Le Fanfare's ember.
      .filter((e) => !(tonightActive && e.lng === anchor.lng && e.lat === anchor.lat))
      .map((e) => ({
        lng: e.lng,
        lat: e.lat,
        radius: 24,
        strength: 0.5,
        color: light.dusk,
        dot: light.dusk,
        heat: 0.25, // a stake, not a fire — small and patient
        breathes: true,
        sel: {
          kind: "ember",
          id: e.id,
          title: e.venueName,
          subtitle: `Staked by ${memberById(e.droppedById).name} · ${e.fadesLabel}`,
          detail: `“${e.note}”`,
          venue: { name: e.venueName, lng: e.lng, lat: e.lat },
        },
      }));

    const livePulses = [...pulses, ...(act.myPulse ? [act.myPulse] : [])];
    const pulsePools: Pool[] = livePulses.map((p) => {
      const coming =
        p.comingIds.length +
        (p.id === "p-1" ? sim.pulseJoins.length : 0) +
        (act.joinedPulseIds.includes(p.id) ? 1 : 0);
      const who = memberById(p.memberId);
      return {
        lng: p.lng,
        lat: p.lat,
        radius: 30,
        strength: 0.6,
        color: light.spark,
        dot: light.spark,
        // Each "coming" feeds the flame.
        heat: Math.min(1, 0.4 + coming * 0.18),
        breathes: true,
        sel: {
          kind: "pulse",
          id: p.id,
          title:
            p.memberId === selfId
              ? `You're at ${p.venueName}`
              : `${who.name} is at ${p.venueName}`,
          subtitle: `${p.minutesLeft} min left · ${coming} coming`,
          detail: `“${p.note}”`,
          venue: { name: p.venueName, lng: p.lng, lat: p.lat },
        },
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
            // Every arrival stokes it; ignition maxes it out.
            heat: sim.ignited ? 1 : Math.min(1, 0.3 + arrivalsN * 0.12),
            breathes: true,
            ignitedAt: sim.ignitedAt,
            sel: {
              kind: "tonight",
              id: "tonight",
              title: anchor.venueName,
              subtitle: sim.ignited
                ? `Lit tonight · found by Noor · ${arrivalsN} here`
                : `Tonight's anchor · ${arrivalsN} checked in`,
            },
          },
        ]
      : [];

    return [...lit, ...emberPools, ...pulsePools, ...tonight];
  }, [mode, sim, act]);
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
      onSelectRef.current?.(hit ? hit.sel : null);
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

        // Heat: the warm glow that lives in the pool — brighter with
        // engagement, trembling like real firelight.
        const phase = flickerPhase(p.lng, p.lat);
        const flick = flickerAt(now, phase);
        const glowAlpha = Math.min(
          0.55,
          (0.14 + 0.18 * breath) * p.strength * (0.6 + 0.8 * p.heat) * flick,
        );
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

        // The venue point: a flickering flame, taller and brighter the more
        // people engage. Tip leans with its own wobble.
        const flameH =
          (7 + 9 * p.heat) *
          Math.min(1.25, Math.max(0.85, scale)) *
          (0.92 + 0.16 * (flick - 0.84));
        const tipDx = flameH * 0.16 * Math.sin(now / 70 + phase * 3);
        // Soft halo right behind the flame so it pops on busy tiles.
        const halo = hctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, flameH * 1.7);
        halo.addColorStop(0, light.hearth + "b3");
        halo.addColorStop(1, light.hearth + "00");
        hctx.fillStyle = halo;
        hctx.beginPath();
        hctx.arc(pt.x, pt.y, flameH * 1.7, 0, Math.PI * 2);
        hctx.fill();
        drawFlame(hctx, pt.x, pt.y, flameH, tipDx, p.dot, light.hearth);
      }

      // You are here — a breathing self marker. Drawn last so it rides above
      // mist and pools; deliberately never punches the fog (finding yourself
      // doesn't reveal territory — co-presence does).
      const u = userPosRef.current;
      if (u) {
        const pt = map.project([u.lng, u.lat]);
        if (pt.x > -60 && pt.y > -60 && pt.x < w + 60 && pt.y < h + 60) {
          const haloR = 24 * (1 + 0.3 * breath);
          const halo = hctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, haloR);
          halo.addColorStop(0, light.emberGlow + "73");
          halo.addColorStop(1, light.emberGlow + "00");
          hctx.globalCompositeOperation = "source-over";
          hctx.fillStyle = halo;
          hctx.beginPath();
          hctx.arc(pt.x, pt.y, haloR, 0, Math.PI * 2);
          hctx.fill();

          hctx.fillStyle = light.hearth;
          hctx.beginPath();
          hctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
          hctx.fill();
          hctx.fillStyle = light.ember;
          hctx.beginPath();
          hctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
          hctx.fill();
        }
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
});
