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
import { Ionicons } from "@expo/vector-icons";
import { light, MAP_MIST, cartoVoyagerStyle } from "@bonfire/ui-tokens";
import type { VenueKind } from "../../lib/mockV2";
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
  /** Ionicons glyph codepoint shown in the badge — what this place is. */
  icon?: number;
  /** Live headcount bubble (pulse "coming", tonight's arrivals/ins). */
  count?: number;
  breathes: boolean;
  /** Set while the ignition bloom animation runs. */
  ignitedAt?: number | null;
  sel: FogMapSelection;
}

// The undiscovered city: grayscale under morning mist — quiet, not menacing. MIST + the Carto
// Voyager basemap come from @bonfire/ui-tokens so the web pulse map tile stays in lockstep.
const MIST = MAP_MIST;
const GRAY = "#808080"; // zero-saturation fill for the blend veil

// What-it-is icons. Pulses get "flash" (happening now), the anchor gets
// "bonfire" (the ritual); everything else shows its venue kind.
const KIND_GLYPH: Record<VenueKind, number> = {
  restaurant: Number(Ionicons.glyphMap["restaurant"]),
  bar: Number(Ionicons.glyphMap["wine"]),
  cafe: Number(Ionicons.glyphMap["cafe"]),
  park: Number(Ionicons.glyphMap["leaf"]),
};
const GLYPH_FLASH = Number(Ionicons.glyphMap["flash"]);
const GLYPH_BONFIRE = Number(Ionicons.glyphMap["bonfire"]);

/** The Ionicons web font family once it's loaded, else null (skip icons). */
function iconFontFamily(): string | null {
  if (typeof document === "undefined" || !document.fonts) return null;
  if (document.fonts.check("12px Ionicons")) return "Ionicons";
  if (document.fonts.check("12px ionicons")) return "ionicons";
  return null;
}

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

/** Candle flicker: slow, small, irregular — layered sines, no randomness. */
function flickerAt(now: number, phase: number) {
  return (
    0.88 +
    0.08 * Math.sin(now / 520 + phase) +
    0.05 * Math.sin(now / 230 + phase * 1.7) +
    0.02 * Math.sin(now / 120 + phase * 2.9)
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

/** The what-it-is badge: warm disc, colored ring, category icon. */
function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  ring: string,
  glyph: number | undefined,
  font: string | null,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = light.hearth;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = ring;
  ctx.stroke();
  if (glyph && font) {
    ctx.fillStyle = ring;
    ctx.font = `${Math.round(r * 1.3)}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String.fromCodePoint(glyph), x, y + 0.5);
  }
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
        icon: KIND_GLYPH[s.kind],
        breathes: true,
        sel: {
          kind: "personal",
          id: s.id,
          title: s.name,
          subtitle: "On your map · only you can see this",
          venue: { name: s.name, lng: s.lng, lat: s.lat, kind: s.kind },
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
      icon: KIND_GLYPH[v.kind],
      breathes: true,
      sel: {
        kind: "lit",
        id: v.id,
        title: v.name,
        subtitle: `${v.litLabel} · found by ${memberById(v.foundById).name} · ${v.nights} ${v.nights === 1 ? "night" : "nights"}`,
        detail: `The move: ${v.move}`,
        venue: { name: v.name, lng: v.lng, lat: v.lat, kind: v.kind },
      },
    }));

    const emberPools: Pool[] = [...embers, ...act.droppedEmbers]
      // The anchor venue always renders as tonight's marker, not its ember.
      .filter((e) => !(e.lng === anchor.lng && e.lat === anchor.lat))
      .map((e) => ({
        lng: e.lng,
        lat: e.lat,
        radius: 24,
        strength: 0.5,
        color: light.dusk,
        dot: light.dusk,
        heat: 0.25, // a stake, not a fire — small and patient
        icon: KIND_GLYPH[e.venueKind],
        breathes: true,
        sel: {
          kind: "ember",
          id: e.id,
          title: e.venueName,
          subtitle: `Staked by ${memberById(e.droppedById).name} · ${e.fadesLabel}`,
          detail: `“${e.note}”`,
          venue: { name: e.venueName, lng: e.lng, lat: e.lat, kind: e.venueKind },
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
        icon: GLYPH_FLASH,
        count: coming + 1, // the broadcaster is a body in the room too
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
        },
      };
    });

    // Tonight's anchor is always on the group map — the soonest thing.
    const tonight: Pool[] = [
      {
        lng: anchor.lng,
        lat: anchor.lat,
        radius: !tonightActive ? 24 : sim.ignited ? 78 : 24 + arrivalsN * 9,
        strength: !tonightActive ? 0.5 : sim.ignited ? 1 : 0.55 + arrivalsN * 0.12,
        color: sim.ignited ? light.ember : light.dusk,
        dot: sim.ignited ? light.ember : light.dusk,
        // Every arrival stokes it; ignition maxes it out.
        heat: !tonightActive ? 0.4 : sim.ignited ? 1 : Math.min(1, 0.3 + arrivalsN * 0.12),
        icon: GLYPH_BONFIRE,
        count: tonightActive ? arrivalsN : anchor.inIds.length,
        breathes: true,
        ignitedAt: sim.ignitedAt,
        sel: {
          kind: "tonight",
          id: "tonight",
          title: anchor.venueName,
          subtitle: !tonightActive
            ? `Tonight's anchor · ${anchor.dayLabel} ${anchor.timeLabel} · ${anchor.inIds.length} in`
            : sim.ignited
              ? `Lit tonight · found by Noor · ${arrivalsN} here`
              : `Tonight's anchor · ${arrivalsN} checked in`,
          detail: !tonightActive ? `“${anchor.note}”` : undefined,
        },
      },
    ];

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
      style: cartoVoyagerStyle(),
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
      const iconFont = iconFontFamily();
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

        // The marker: a what-it-is badge with a flame rising behind it.
        // Icon says what this place is; flame height says how alive it is.
        const sizeK = Math.min(1.25, Math.max(0.85, scale));
        const badgeR = (10 + 3.5 * p.heat) * sizeK;
        const flameH =
          (6 + 13 * p.heat) * sizeK * (0.92 + 0.16 * (flick - 0.88));
        const tipDx = flameH * 0.14 * Math.sin(now / 340 + phase * 3);

        // Soft halo behind the marker so it pops on busy tiles.
        const halo = hctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, badgeR * 2.1);
        halo.addColorStop(0, light.hearth + "b3");
        halo.addColorStop(1, light.hearth + "00");
        hctx.fillStyle = halo;
        hctx.beginPath();
        hctx.arc(pt.x, pt.y, badgeR * 2.1, 0, Math.PI * 2);
        hctx.fill();

        // Flame first (base tucked behind the badge's top edge), then badge.
        drawFlame(hctx, pt.x, pt.y - badgeR * 0.85, flameH, tipDx, p.dot, light.hearth);
        drawBadge(hctx, pt.x, pt.y, badgeR, p.dot, p.icon, iconFont);

        // Live headcount — who's engaged right now.
        if (p.count != null && p.count > 0) {
          const bx = pt.x + badgeR * 0.95;
          const by = pt.y - badgeR * 0.95;
          hctx.beginPath();
          hctx.arc(bx, by, 7.5, 0, Math.PI * 2);
          hctx.fillStyle = light.coal;
          hctx.fill();
          hctx.lineWidth = 1.5;
          hctx.strokeStyle = light.hearth;
          hctx.stroke();
          hctx.fillStyle = light.hearth;
          hctx.font = "9px Onest_700Bold, system-ui, sans-serif";
          hctx.textAlign = "center";
          hctx.textBaseline = "middle";
          hctx.fillText(String(p.count), bx, by + 0.5);
        }
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
