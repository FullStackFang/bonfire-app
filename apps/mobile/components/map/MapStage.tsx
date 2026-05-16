// Real interactive map for Bonfire. Boots MapLibre GL JS inside a WebView,
// loads OSM raster tiles, and renders the heatmap natively in the map.
// Friend pins stay as React Native overlays — the WebView projects each pin's
// lat/lng to pixel coords on every camera change and posts them back so the
// RN overlay layer can reposition.
//
// Why WebView and not @maplibre/maplibre-react-native: that's a native module
// and won't run in Expo Go. This path works in Expo Go today; swap to the
// native module once a dev client build is in place.

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { light } from "@bonfire/ui-tokens";

// Visible kindle window — must match LP_KINDLE_DURATION in the WebView script
// (LP_TOTAL_DELAY - LP_INTENT_DELAY = 600 - 100).
const KINDLE_DURATION_MS = 500;
const BURST_DURATION_MS = 320;
const FLICKER_PERIOD_MS = 240;

// Per-spark definitions. dx/dy are roughly unit-length direction vectors
// (lengths intentionally vary slightly for an organic spread). `phase`
// offsets each spark against the shared flicker timer so they don't pulse
// in lockstep. Colors mix ember + emberGlow + emberDeep for depth.
type SparkDef = {
  dx: number;
  dy: number;
  size: number;
  phase: number;
  color: string;
};
const SPARKS: SparkDef[] = [
  { dx:  0.95, dy: -0.18, size: 5, phase: 0.00, color: light.ember },
  { dx:  0.30, dy: -0.92, size: 4, phase: 0.27, color: light.emberGlow },
  { dx: -0.55, dy: -0.78, size: 6, phase: 0.55, color: light.ember },
  { dx: -0.95, dy:  0.05, size: 4, phase: 0.78, color: light.emberDeep },
  { dx: -0.62, dy:  0.72, size: 5, phase: 0.13, color: light.ember },
  { dx:  0.18, dy:  0.96, size: 4, phase: 0.42, color: light.emberGlow },
  { dx:  0.80, dy:  0.55, size: 5, phase: 0.65, color: light.ember },
  { dx:  0.32, dy: -0.22, size: 3, phase: 0.91, color: light.emberGlow },
];
const SPARK_KINDLE_RADIUS = 26;   // px from center when kindle = 1
const SPARK_BURST_DISTANCE = 110; // additional px on burst

export interface PinSpec {
  id: string;
  lat: number;
  lng: number;
  render: React.ReactNode;
}

export interface HeatPoint {
  lat: number;
  lng: number;
  weight: number;
}

export interface MapStageProps {
  center: { lat: number; lng: number };
  initialZoom?: number;
  pins: PinSpec[];
  heatPoints: HeatPoint[];
  onZoomChange?: (zoom: number) => void;
  onLongPress?: (coords: { lat: number; lng: number }) => void;
  children?: React.ReactNode;
}

export interface MapStageHandle {
  flyTo: (center: { lat: number; lng: number }, zoom?: number) => void;
}

const HTML_TEMPLATE = `<!doctype html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/>
<link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet"/>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#fff7f1;
    -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}
  .maplibregl-ctrl-attrib{font-size:9px;background:rgba(255,247,241,0.6) !important;}
  .maplibregl-ctrl-attrib a{color:#716664 !important;}
  .maplibregl-canvas{outline:none !important;}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>
  function send(m){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  const map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        basemap: {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
            'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
            'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
            'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap &copy; CARTO'
        },
        heat: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }
      },
      layers: [
        {
          id: 'basemap',
          type: 'raster',
          source: 'basemap',
          paint: { 'raster-fade-duration': 350 }
        },
        {
          id: 'heat',
          type: 'heatmap',
          source: 'heat',
          paint: {
            'heatmap-weight': ['coalesce', ['get', 'weight'], 1],
            'heatmap-intensity': 1.2,
            'heatmap-radius': 48,
            'heatmap-opacity': 0.65,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(240,88,70,0)',
              0.2, 'rgba(240,88,70,0.35)',
              0.5, 'rgba(240,88,70,0.65)',
              1, 'rgba(165,42,36,0.85)'
            ]
          }
        }
      ]
    },
    center: [__LNG__, __LAT__],
    zoom: __ZOOM__,
    attributionControl: false,
    fadeDuration: 350
  });
  let registeredPins = [];
  function projectPins(){
    const out = registeredPins.map(function(p){
      const px = map.project([p.lng, p.lat]);
      return { id: p.id, x: px.x, y: px.y };
    });
    send({ type: 'pins', pins: out });
  }
  // Throttle the projection on pan: postMessage hop is expensive across the
  // JS bridge. Coalesce to one update per animation frame instead of every
  // map 'move' tick, then fire a final precise update on 'moveend'.
  var projectScheduled = false;
  function scheduleProjectPins(){
    if (projectScheduled) return;
    projectScheduled = true;
    requestAnimationFrame(function(){
      projectScheduled = false;
      projectPins();
    });
  }
  // Heatmap breathes — sine-eased pulse over 3.2s, in phase with the avatar
  // halos. Time-driven so the cadence stays steady regardless of frame rate.
  const HEAT_PERIOD_MS = 3200;
  let breatheStart = 0;
  function breathe(now){
    if (!breatheStart) breatheStart = now;
    const phase = (Math.sin(((now - breatheStart) / HEAT_PERIOD_MS) * Math.PI * 2) + 1) / 2;
    if (map.getLayer('heat')) {
      map.setPaintProperty('heat', 'heatmap-intensity', 1.0 + phase * 0.55);
      map.setPaintProperty('heat', 'heatmap-opacity', 0.5 + phase * 0.22);
    }
    requestAnimationFrame(breathe);
  }
  map.on('load', function(){
    send({ type: 'ready' });
    requestAnimationFrame(breathe);
  });
  map.on('move', scheduleProjectPins);
  map.on('moveend', projectPins);
  var zoomScheduled = false;
  function scheduleZoom(){
    if(zoomScheduled) return;
    zoomScheduled = true;
    requestAnimationFrame(function(){
      zoomScheduled = false;
      send({ type: 'zoom', zoom: map.getZoom() });
    });
  }
  map.on('zoom', scheduleZoom);
  window.bonfireSetHeat = function(points){
    const src = map.getSource('heat');
    if(!src) return;
    src.setData({
      type: 'FeatureCollection',
      features: points.map(function(p){
        return {
          type: 'Feature',
          properties: { weight: p.weight },
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] }
        };
      })
    });
  };
  window.bonfireSetPins = function(pins){ registeredPins = pins; projectPins(); };
  window.bonfireFlyTo = function(lat, lng, zoom){
    const opts = { center: [lng, lat], essential: true, speed: 1.4 };
    if (typeof zoom === 'number') opts.zoom = zoom;
    map.flyTo(opts);
  };
  // Long-press vs. pan/zoom: we wait LP_INTENT_DELAY for the finger to hold
  // still before emitting pressstart. A real pan begins moving within
  // ~50–100ms, so the intent window cleanly filters it out — the ember never
  // appears for a drag. Four signals to RN drive the overlay:
  //   pressstart (intent confirmed, x/y in canvas coords)
  //   presswarm  (commit imminent — RN fires a heads-up haptic)
  //   presscommit (held the full window — fires with lat/lng for the sheet)
  //   presscancel (finger lifted or moved off after pressstart)
  // We also tap MapLibre's own gesture events so any drag/zoom/rotate that
  // bypasses our touch math still cancels the kindle.
  var intentTimer = null;   // confirms "this is a hold, not a pan"
  var warmTimer = null;     // fires presswarm shortly before commit
  var commitTimer = null;   // fires presscommit after the kindle window
  var lpStart = null;       // canvas point of the active touch
  var lpPhase = 0;          // 0 = idle, 1 = intent pending, 2 = kindling
  var LP_INTENT_DELAY = 100;
  var LP_TOTAL_DELAY = 600;
  var LP_MOVE_TOLERANCE = 8;
  var LP_KINDLE_DURATION = LP_TOTAL_DELAY - LP_INTENT_DELAY; // 500
  var LP_WARM_LEAD = 100; // ms before commit to fire heads-up haptic
  function clearLp(){
    if (intentTimer) { clearTimeout(intentTimer); intentTimer = null; }
    if (warmTimer) { clearTimeout(warmTimer); warmTimer = null; }
    if (commitTimer) { clearTimeout(commitTimer); commitTimer = null; }
    lpStart = null;
    lpPhase = 0;
  }
  // Cancel from any source. If we already told RN about pressstart, send
  // presscancel so it can unwind the kindle visual; otherwise stay silent.
  function cancelLp(){
    var hadVisuals = lpPhase === 2;
    clearLp();
    if (hadVisuals) send({ type: 'presscancel' });
  }
  function getCanvasPoint(touch){
    var rect = map.getCanvas().getBoundingClientRect();
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }
  map.getCanvasContainer().addEventListener('touchstart', function(ev){
    // Multi-touch (pinch) is never a long-press.
    if (ev.touches.length !== 1) { cancelLp(); return; }
    var p = getCanvasPoint(ev.touches[0]);
    lpStart = p;
    lpPhase = 1;
    intentTimer = setTimeout(function(){
      if (!lpStart) return;
      intentTimer = null;
      lpPhase = 2;
      send({ type: 'pressstart', x: lpStart.x, y: lpStart.y });
      warmTimer = setTimeout(function(){
        warmTimer = null;
        send({ type: 'presswarm' });
      }, LP_KINDLE_DURATION - LP_WARM_LEAD);
      commitTimer = setTimeout(function(){
        if (!lpStart) return;
        var ll = map.unproject([lpStart.x, lpStart.y]);
        commitTimer = null;
        lpStart = null;
        lpPhase = 0;
        send({ type: 'presscommit', lat: ll.lat, lng: ll.lng });
      }, LP_KINDLE_DURATION);
    }, LP_INTENT_DELAY);
  }, { passive: true });
  map.getCanvasContainer().addEventListener('touchmove', function(ev){
    if (lpPhase === 0 || !lpStart || ev.touches.length === 0) return;
    var p = getCanvasPoint(ev.touches[0]);
    var dx = p.x - lpStart.x;
    var dy = p.y - lpStart.y;
    if (Math.hypot(dx, dy) > LP_MOVE_TOLERANCE) cancelLp();
  }, { passive: true });
  map.getCanvasContainer().addEventListener('touchend', cancelLp, { passive: true });
  map.getCanvasContainer().addEventListener('touchcancel', cancelLp, { passive: true });
  // MapLibre's own gesture system has its own thresholds — if it decides the
  // user is panning/zooming/rotating, kill the press immediately even if our
  // touch math hasn't tripped yet.
  map.on('movestart', function(){ if (lpPhase !== 0) cancelLp(); });
  map.on('zoomstart', function(){ if (lpPhase !== 0) cancelLp(); });
  map.on('rotatestart', function(){ if (lpPhase !== 0) cancelLp(); });
</script>
</body></html>`;

export const MapStage = forwardRef<MapStageHandle, MapStageProps>(function MapStage(
  { center, initialZoom = 14, pins, heatPoints, onZoomChange, onLongPress, children }: MapStageProps,
  ref,
) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [pinPositions, setPinPositions] = useState<Record<string, { x: number; y: number }>>({});
  // Touch indicator state for the kindling overlay. `pressPoint` is the
  // canvas-relative position of the active long-press; `kindle` drives the
  // 0→1 build phase and `burst` drives the radiating flame on commit.
  const [pressPoint, setPressPoint] = useState<{ x: number; y: number } | null>(null);
  const kindle = useSharedValue(0);
  const burst = useSharedValue(0);
  // Continuous timer for spark flicker. Only runs while a press is active so
  // we don't spin the UI thread when nothing's on screen.
  const flicker = useSharedValue(0);

  const clearPressPoint = () => setPressPoint(null);

  useEffect(() => {
    if (!pressPoint) return;
    flicker.value = 0;
    flicker.value = withRepeat(
      withTiming(1, { duration: FLICKER_PERIOD_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(flicker);
  }, [pressPoint, flicker]);

  useImperativeHandle(ref, () => ({
    flyTo: (c, zoom) => {
      const zoomArg = typeof zoom === "number" ? zoom : "undefined";
      webRef.current?.injectJavaScript(
        `window.bonfireFlyTo(${c.lat}, ${c.lng}, ${zoomArg}); true;`,
      );
    },
  }));

  // The HTML is built once with the initial camera; subsequent center changes
  // go through bonfireFlyTo so the map smoothly recenters without remounting.
  const initialCenterRef = useRef(center);
  const html = useMemo(
    () =>
      HTML_TEMPLATE.replace("__LNG__", String(initialCenterRef.current.lng))
        .replace("__LAT__", String(initialCenterRef.current.lat))
        .replace("__ZOOM__", String(initialZoom)),
    [initialZoom],
  );

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(
      `window.bonfireFlyTo(${center.lat}, ${center.lng}); true;`,
    );
  }, [center.lat, center.lng, ready]);

  useEffect(() => {
    if (!ready) return;
    const data = JSON.stringify(heatPoints);
    webRef.current?.injectJavaScript(`window.bonfireSetHeat(${data}); true;`);
  }, [heatPoints, ready]);

  useEffect(() => {
    if (!ready) return;
    const lite = pins.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng }));
    webRef.current?.injectJavaScript(`window.bonfireSetPins(${JSON.stringify(lite)}); true;`);
  }, [pins, ready]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "ready") {
        setReady(true);
      } else if (msg.type === "pins" && Array.isArray(msg.pins)) {
        const next: Record<string, { x: number; y: number }> = {};
        for (const p of msg.pins) next[p.id] = { x: p.x, y: p.y };
        setPinPositions(next);
      } else if (msg.type === "zoom" && typeof msg.zoom === "number") {
        onZoomChange?.(msg.zoom);
      } else if (
        msg.type === "pressstart" &&
        typeof msg.x === "number" &&
        typeof msg.y === "number"
      ) {
        // Finger down — light haptic, plant the ember, build over 1.5s.
        setPressPoint({ x: msg.x, y: msg.y });
        cancelAnimation(kindle);
        cancelAnimation(burst);
        kindle.value = 0;
        burst.value = 0;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        kindle.value = withTiming(1, {
          duration: KINDLE_DURATION_MS,
          easing: Easing.out(Easing.cubic),
        });
      } else if (msg.type === "presscancel") {
        // Released or dragged off before commit — shrink the ember away.
        cancelAnimation(kindle);
        kindle.value = withTiming(
          0,
          { duration: 180, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(clearPressPoint)();
          },
        );
      } else if (msg.type === "presswarm") {
        // Commit imminent — anticipation tap right before the modal opens.
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } else if (
        msg.type === "presscommit" &&
        typeof msg.lat === "number" &&
        typeof msg.lng === "number"
      ) {
        // Full hold reached — radiate outward, fire commit haptic, navigate.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        kindle.value = 1;
        burst.value = withTiming(
          1,
          { duration: BURST_DURATION_MS, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(clearPressPoint)();
          },
        );
        onLongPress?.({ lat: msg.lat, lng: msg.lng });
      }
    } catch {
      // ignore malformed messages
    }
  };

  // Animated style for the ember core — tight glowing dot at the press point
  // that the sparks fly off from. No halo: the sparks are the show.
  const coreStyle = useAnimatedStyle(() => {
    // Tiny independent flicker on the core so it pulses like a live ember
    // rather than holding a flat fill.
    const f = (flicker.value * 2) % 1;
    const beat = 0.85 + 0.15 * Math.sin(f * Math.PI * 2);
    return {
      transform: [{ scale: (0.2 + kindle.value * 0.7 + burst.value * 1.6) * beat }],
      opacity: kindle.value * (1 - burst.value),
    };
  });

  return (
    <View
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        backgroundColor: light.cream,
      }}
    >
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={onMessage}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "transparent" }]}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        androidLayerType="hardware"
        cacheEnabled
      />
      {pins.map((p) => {
        const pos = pinPositions[p.id];
        if (!pos) return null;
        return (
          <View
            key={p.id}
            pointerEvents="box-none"
            style={{ position: "absolute", left: pos.x, top: pos.y }}
          >
            {p.render}
          </View>
        );
      })}
      {pressPoint ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            // 160px overlay leaves room for sparks to fling outward on burst
            left: pressPoint.x - 80,
            top: pressPoint.y - 80,
            width: 160,
            height: 160,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Animated.View
            style={[
              {
                position: "absolute",
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: light.ember,
              },
              coreStyle,
            ]}
          />
          {SPARKS.map((s, i) => (
            <Spark
              key={i}
              def={s}
              kindle={kindle}
              burst={burst}
              flicker={flicker}
            />
          ))}
        </View>
      ) : null}
      {children}
    </View>
  );
});

// One ember spark. Its position is the spark def's unit direction multiplied
// by a radius that grows with `kindle` and explodes with `burst`. Its opacity
// is gated by `kindle` (off when idle) and modulated by a per-spark flicker
// phase against the shared `flicker` timer — sparks brighten and dim
// independently, like real embers.
function Spark({
  def,
  kindle,
  burst,
  flicker,
}: {
  def: SparkDef;
  kindle: SharedValue<number>;
  burst: SharedValue<number>;
  flicker: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const t = (flicker.value + def.phase) % 1;
    // |sin| ping-pongs 0→1→0 within the cycle — gives each spark a
    // crackling brighten-then-dim rather than a smooth sine.
    const bright = 0.25 + 0.75 * Math.abs(Math.sin(t * Math.PI * 2));
    const radius =
      SPARK_KINDLE_RADIUS * kindle.value + SPARK_BURST_DISTANCE * burst.value;
    // Sparks settle slightly outward as kindle progresses; on burst they
    // shrink as they fling, mimicking embers cooling mid-air.
    const scale = (0.55 + kindle.value * 0.6) * (1 - burst.value * 0.55);
    return {
      transform: [
        { translateX: def.dx * radius },
        { translateY: def.dy * radius },
        { scale },
      ],
      opacity: kindle.value * bright * (1 - burst.value * 0.6),
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: def.size,
          height: def.size,
          borderRadius: def.size / 2,
          backgroundColor: def.color,
        },
        style,
      ]}
    />
  );
}
