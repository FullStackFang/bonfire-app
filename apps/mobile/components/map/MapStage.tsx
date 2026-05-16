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
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { light } from "@bonfire/ui-tokens";

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
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#fff7f1;}
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
</script>
</body></html>`;

export const MapStage = forwardRef<MapStageHandle, MapStageProps>(function MapStage(
  { center, initialZoom = 14, pins, heatPoints, children }: MapStageProps,
  ref,
) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [pinPositions, setPinPositions] = useState<Record<string, { x: number; y: number }>>({});

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
      }
    } catch {
      // ignore malformed messages
    }
  };

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
      {children}
    </View>
  );
});
