import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import {
  AppHeader,
  type AvatarStackItem,
  ChunkyPressable,
  EmptyState,
  IconButton,
  T,
} from "../../components/ui";
import {
  MapStage,
  type MapStageHandle,
  type PinSpec,
} from "../../components/map/MapStage";
import {
  FriendFlamePin,
  FRIEND_FLAME_H,
  FRIEND_FLAME_W,
} from "../../components/map/FriendFlamePin";
import { SELF_INDICATOR_SIZE, SelfIndicator } from "../../components/map/SelfIndicator";
import { EventPin } from "../../components/map/EventPin";
import { EventRadius, metersPerPixel } from "../../components/map/EventRadius";
import { BonfiresNearby, type NearbyEvent } from "../../components/map/BonfiresNearby";
import { CircleFilterChip } from "../../components/map/CircleFilterChip";
import { LayersControl, type LayerState } from "../../components/map/LayersControl";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { heatmapPulseMs, light } from "@bonfire/ui-tokens";
import { buildHeatPoints } from "../../lib/mapProjection";
import { distanceKm, distanceMeters } from "../../lib/geo";
import { MOCK_CENTER } from "../../lib/mockSeeds";
import { useUserLocation } from "../../lib/useUserLocation";
import {
  useVisiblePresence,
  usePeople,
  findVenueSync,
  useMapEvents,
  useMyCircles,
} from "../../lib/data";
import { getEventStatus } from "../../lib/mockEventStore";
import { useSession } from "../../lib/session";
import { intentMeta } from "../../components/ui";
import type { Intent } from "@bonfire/shared";

// Per-intent FAB config: face color, icon, shadow.
// available_now → EmberParticleHalo, out_today/out_tonight → SpokeHalo.
const INTENT_FAB = {
  available_now: {
    bg: light.ember,
    icon: "flame" as const,
    shadow: light.emberDeep,
  },
  out_today: {
    bg: light.dusk,
    icon: "sunny" as const,
    shadow: "#8b5520",
  },
  out_tonight: {
    bg: light.night,
    icon: "moon" as const,
    shadow: "#080f19",
  },
} as const;

// Radius (km) within which a map event counts as "near you" for the footer
// summary chip. ~5mi covers a city's hangout footprint without including
// distant pins that wouldn't be walkable.
const NEARBY_RADIUS_KM = 8;

// Footprint of an event's gathering circle (matches the EventRadius drawn
// in `pins` below). Friend presences inside this radius are subsumed into
// the event pin so they don't double-render as loose avatars.
const EVENT_FOOTPRINT_M = 120;
// Pull a stray friend into a venue avatar stack when they're within this
// many metres of the venue's centroid. Tight enough that genuinely separate
// hangouts stay distinct, loose enough that "right outside the bar" folds in.
const VENUE_SUBSUME_M = 30;
// Below this zoom we suppress individual loose-friend avatars and let the
// heatmap carry social density. Venue stacks + event pins still render.
const LOOSE_PIN_MIN_ZOOM = 13;
// When the Bonfires layer is on, scale the heatmap opacity down so the two
// pulsing layers don't fight for attention.
const HEATMAP_DIM_WITH_BONFIRES = 0.6;
const LAYERS_STORAGE_KEY = "bonfire:mapLayers:v1";
const DEFAULT_LAYERS: LayerState = { friends: true, bonfires: true, heatmap: true };

// Deterministic 0..N from a pin id so each pin gets its own breathing phase.
// djb2 — fast, no deps, more than enough entropy for visual jitter.
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function phaseFor(id: string): number {
  return hashStr(id) % heatmapPulseMs;
}

// Pin renders are anchored at their geographic point. These offsets pull each
// pin so its visual anchor (the bottom-centre of the flame for loose & venue
// pins; the centre of the dot for self) lands exactly on the geo coordinate.
const LOOSE_ANCHOR_OFFSET_X = -FRIEND_FLAME_W / 2;
const LOOSE_ANCHOR_OFFSET_Y = -FRIEND_FLAME_H;
const VENUE_FLAME_SCALE = 0.72;
const VENUE_FLAME_W = FRIEND_FLAME_W * VENUE_FLAME_SCALE;
const VENUE_FLAME_H = FRIEND_FLAME_H * VENUE_FLAME_SCALE;
const VENUE_FLAME_GAP = 2;
const VENUE_MAX_VISIBLE = 3;
const SELF_ANCHOR_OFFSET = -SELF_INDICATOR_SIZE / 2;

export default function Home() {
  const { user } = useSession();
  const presence = useVisiblePresence();
  const { byId } = usePeople();
  const mapEvents = useMapEvents();
  const myCircles = useMyCircles();
  // null = "All circles"; otherwise the circle whose members are visible.
  const [activeCircleId, setActiveCircleId] = useState<string | null>(null);
  const userLocation = useUserLocation(MOCK_CENTER);
  const userCenter = userLocation?.coords ?? null;
  const mapRef = useRef<MapStageHandle>(null);
  const [recentering, setRecentering] = useState(false);
  const [mapZoom, setMapZoom] = useState(14);
  // Measured height of the "bonfires near you" footer so the FAB + recenter
  // button can hop above it instead of being hidden by it. 0 when hidden.
  const [footerHeight, setFooterHeight] = useState(0);
  // Map-layer visibility. Persisted to AsyncStorage so the user's choice
  // survives across launches. `loaded` gates the first persist write so we
  // don't immediately overwrite stored state with the default.
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [layersLoaded, setLayersLoaded] = useState(false);
  // The currently tapped event pin. First tap reveals its title; second tap
  // navigates to /event/[id]. Empty-map taps clear it.
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(LAYERS_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<LayerState>;
            setLayers({ ...DEFAULT_LAYERS, ...parsed });
          } catch {
            // ignore malformed; fall back to defaults
          }
        }
      })
      .finally(() => setLayersLoaded(true));
  }, []);

  useEffect(() => {
    if (!layersLoaded) return;
    AsyncStorage.setItem(LAYERS_STORAGE_KEY, JSON.stringify(layers)).catch(() => {});
  }, [layers, layersLoaded]);

  // Long-press on the map opens the create-event sheet with the tapped coords.
  // MapStage owns the touch animation + haptic — we just navigate on commit.
  const handleLongPress = (coords: { lat: number; lng: number }) => {
    router.push({
      pathname: "/event/new",
      params: { lat: String(coords.lat), lng: String(coords.lng) },
    });
  };

  // Derive the user's active broadcast intent (null = not live).
  const myIntent = useMemo<Intent | null>(() => {
    if (!user) return null;
    const now = Date.now();
    const active = presence.find(
      (p) =>
        p.user_id === user.id &&
        p.ended_at == null &&
        new Date(p.expires_at).getTime() > now,
    );
    return (active?.intent as Intent) ?? null;
  }, [presence, user]);

  const fabCfg = myIntent ? INTENT_FAB[myIntent] : INTENT_FAB.available_now;

  const handleFabPress = () => router.push("/go-live");

  // Recenter is two-phase:
  //   1. SYNCHRONOUS — if we already have a real fix in memory, flyTo right
  //      now (no awaits). The camera starts moving in the same frame as the
  //      tap, so the button feels instant.
  //   2. BACKGROUND — fetch a fresh High-accuracy fix and flyTo again. The
  //      spinner stays visible during this until GPS lock returns.
  const handleRecenter = async () => {
    Haptics.selectionAsync().catch(() => {});

    // Phase 1 — fully synchronous when we have a real fix.
    if (userLocation?.isReal) {
      mapRef.current?.flyTo(userLocation.coords, 15);
    }

    setRecentering(true);
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) {
        perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) return;
      }
      // If phase 1 was a no-op (no cached real fix), use last-known as a
      // mid-latency fly while we wait for GPS.
      if (!userLocation?.isReal) {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          mapRef.current?.flyTo(
            { lat: last.coords.latitude, lng: last.coords.longitude },
            15,
          );
        }
      }
      // Phase 2 — refine with a fresh GPS fix.
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      mapRef.current?.flyTo(
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
        15,
      );
    } catch {
      // best-effort; silently ignore failures
    } finally {
      setRecentering(false);
    }
  };

  // Presence narrowed by the active circle filter. Self always stays visible
  // regardless of filter so you can see your own pin.
  const filteredPresence = useMemo(() => {
    if (!activeCircleId) return presence;
    const circle = myCircles.find((c) => c.id === activeCircleId);
    if (!circle) return presence;
    const members = new Set(circle.member_ids);
    return presence.filter(
      (p) => p.user_id === user?.id || members.has(p.user_id),
    );
  }, [presence, activeCircleId, myCircles, user?.id]);

  const allHeatPoints = useMemo(() => buildHeatPoints(filteredPresence), [filteredPresence]);
  // Heatmap layer can be toggled off — pass an empty array so the WebView
  // source flushes rather than keeping stale data.
  const heatPoints = layers.heatmap ? allHeatPoints : [];
  // Dim the heatmap whenever bonfire radii are on screen so the two pulsing
  // layers don't compete. The heatmap stays as an ambient density signal.
  const heatmapDim =
    layers.heatmap && layers.bonfires ? HEATMAP_DIM_WITH_BONFIRES : 1;

  // Map events within NEARBY_RADIUS_KM of the user, annotated with distance
  // and sorted nearest-first. Drives the "bonfires near you" footer.
  const nearbyEvents = useMemo<NearbyEvent[]>(() => {
    if (!userCenter) return [];
    return mapEvents
      .map((e) => ({
        ...e,
        distanceKm: distanceKm(userCenter, { lat: e.lat, lng: e.lng }),
      }))
      .filter((e) => e.distanceKm <= NEARBY_RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [mapEvents, userCenter]);

  // Unique host avatars across nearby events, in distance order. AvatarStack
  // handles the "+N" overflow internally against `max`. We pad a few past the
  // visible cap so the overflow count stays accurate when hosts repeat.
  const nearbyAttendees = useMemo<AvatarStackItem[]>(() => {
    const seen = new Set<string>();
    const items: AvatarStackItem[] = [];
    for (const ev of nearbyEvents) {
      if (seen.has(ev.host_id)) continue;
      seen.add(ev.host_id);
      const u = byId.get(ev.host_id) as
        | { letter_pair: string; avatar_color: string; display_name: string }
        | undefined;
      if (!u) continue;
      items.push({
        label: u.letter_pair,
        color: u.avatar_color,
        name: u.display_name,
      });
    }
    return items;
  }, [nearbyEvents, byId]);

  // Reset measured footer height when the panel unmounts (no nearby events),
  // so the FAB drops back to its default bottom offset.
  useEffect(() => {
    if (nearbyEvents.length === 0) setFooterHeight(0);
  }, [nearbyEvents.length]);

  // Tap the pill → opens the events-management screen. The list there
  // re-derives nearby + distance from the user's current location so we
  // don't need to pass anything through params.
  const handleNearbyPress = () => router.push("/event/list");

  // Group presence into venue clusters (rendered as avatar stacks) and loose
  // pins (rendered as single avatars). Coordinates stay in lat/lng — MapStage
  // projects them based on the live camera.
  //
  // Decluttering, in order:
  //   1. Presences within an event's footprint are subsumed — the event pin
  //      already represents that gathering, so we don't double-stack avatars.
  //   2. Loose presences within ~30m of a venue centroid fold into that
  //      venue's avatar stack instead of rendering separately.
  //   3. Below LOOSE_PIN_MIN_ZOOM we drop the remaining loose pins entirely;
  //      the heatmap carries social density at city scale.
  //   4. Friends / Bonfires layers can be toggled off wholesale.
  const pins = useMemo<PinSpec[]>(() => {
    type VenueGroup = {
      lat: number;
      lng: number;
      users: ReturnType<typeof byId.get>[];
      intent: string;
      venueName: string | null;
    };

    const out: PinSpec[] = [];

    // --- Friends pass ---------------------------------------------------
    if (layers.friends) {
    const byVenue = new Map<string, VenueGroup>();
    const loose: { lat: number; lng: number; user: ReturnType<typeof byId.get>; intent: string; id: string }[] = [];

    for (const e of filteredPresence) {
      if (e.lat == null || e.lng == null) continue;
      const user = byId.get(e.user_id);
      if (!user) continue;

      // (1) Subsume into a nearby event. Only when bonfires are visible — if
      // the user has hidden them, the friend pin is the only representation
      // left, so we must keep it.
      if (layers.bonfires) {
        let inEvent = false;
        for (const ev of mapEvents) {
          if (
            distanceMeters({ lat: e.lat, lng: e.lng }, { lat: ev.lat, lng: ev.lng }) <=
            EVENT_FOOTPRINT_M
          ) {
            inEvent = true;
            break;
          }
        }
        if (inEvent) continue;
      }

      if (e.venue_id) {
        const venue = findVenueSync(e.venue_id);
        const g = byVenue.get(e.venue_id);
        if (g) {
          g.users.push(user);
        } else {
          byVenue.set(e.venue_id, {
            lat: e.lat,
            lng: e.lng,
            users: [user],
            intent: e.intent,
            venueName: venue?.name ?? null,
          });
        }
      } else {
        loose.push({ id: e.id, lat: e.lat, lng: e.lng, user, intent: e.intent });
      }
    }

    // (2) Fold stray loose presences into a venue group when they're
    // essentially at the same spot. Second pass so every venue centroid is
    // known before we measure distances.
    const stillLoose: typeof loose = [];
    for (const p of loose) {
      let absorbed = false;
      for (const g of byVenue.values()) {
        if (
          distanceMeters({ lat: p.lat, lng: p.lng }, { lat: g.lat, lng: g.lng }) <=
          VENUE_SUBSUME_M
        ) {
          g.users.push(p.user);
          absorbed = true;
          break;
        }
      }
      if (!absorbed) stillLoose.push(p);
    }

    for (const [venueId, g] of byVenue.entries()) {
      const visible = g.users.slice(0, VENUE_MAX_VISIBLE);
      const overflow = g.users.length - visible.length;
      const rowWidth =
        visible.length * VENUE_FLAME_W +
        Math.max(0, visible.length - 1) * VENUE_FLAME_GAP +
        (overflow > 0 ? VENUE_FLAME_W + VENUE_FLAME_GAP : 0);
      out.push({
        id: `venue:${venueId}`,
        lat: g.lat,
        lng: g.lng,
        render: (
          // Anchor: bottom-center of the flame row sits on the geo point.
          // The venue-name pill floats above; glow extends below.
          <View
            style={{
              transform: [
                { translateX: -rowWidth / 2 },
                { translateY: -VENUE_FLAME_H },
              ],
              alignItems: "center",
            }}
          >
            {g.venueName ? (
              <Pressable
                onPress={() => router.push(`/venue/${venueId}`)}
                style={{
                  backgroundColor: light.hearth,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 10,
                  alignSelf: "center",
                  marginBottom: 4,
                  flexDirection: "row",
                  columnGap: 5,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: light.ash,
                }}
              >
                <Ionicons
                  name={g.intent === "available_now" ? "beer" : "moon"}
                  size={12}
                  color={intentMeta[g.intent as "available_now"].color}
                />
                <T variant="bodySm" style={{ fontFamily: "Onest_600SemiBold" }}>
                  {g.venueName}
                </T>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push(`/venue/${venueId}`)}
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                columnGap: VENUE_FLAME_GAP,
              }}
            >
              {visible.map((u: any, i) => (
                <FriendFlamePin
                  key={`${venueId}:${u.id ?? i}`}
                  label={u.letter_pair ?? "?"}
                  seed={u.id ?? `${venueId}:${i}`}
                  phaseOffsetMs={phaseFor(`${venueId}:${u.id ?? i}`)}
                  scale={VENUE_FLAME_SCALE}
                />
              ))}
              {overflow > 0 ? (
                // Quiet "+N" stub at the row's tail. Drawn at the flame's
                // base line so it visually sits beside the row, not on top.
                <View
                  style={{
                    width: VENUE_FLAME_W,
                    height: VENUE_FLAME_H,
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingBottom: 2,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: light.coal,
                      paddingHorizontal: 6,
                      paddingVertical: 3,
                      borderRadius: 10,
                    }}
                  >
                    <T
                      variant="bodySm"
                      style={{
                        color: light.cream,
                        fontFamily: "Onest_600SemiBold",
                        fontSize: 9,
                        lineHeight: 9,
                      }}
                    >
                      +{overflow}
                    </T>
                  </View>
                </View>
              ) : null}
            </Pressable>
          </View>
        ),
      });
    }
    // (3) Zoom-gate the remaining loose pins. At city scale the heatmap
    // carries density; individual loose avatars only render once we've
    // zoomed in enough that they're unlikely to overlap.
    if (mapZoom >= LOOSE_PIN_MIN_ZOOM) {
      for (const p of stillLoose) {
        const userId = (p.user as any)?.id as string | undefined;
        out.push({
          id: `loose:${p.id}`,
          lat: p.lat,
          lng: p.lng,
          render: (
            // Anchor: bottom-center of the flame on the geo point. Glow
            // ellipse sits just below — it's allowed to overflow downward.
            <View
              style={{
                transform: [
                  { translateX: LOOSE_ANCHOR_OFFSET_X },
                  { translateY: LOOSE_ANCHOR_OFFSET_Y },
                ],
              }}
            >
              <Pressable
                onPress={() => {
                  if (userId) router.push(`/(app)/profile/${userId}`);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Open ${(p.user as any)?.display_name ?? "profile"}`}
              >
                <FriendFlamePin
                  label={(p.user as any)?.letter_pair ?? "?"}
                  seed={userId ?? p.id}
                  phaseOffsetMs={phaseFor(p.id)}
                />
              </Pressable>
            </View>
          ),
        });
      }
    }
    } // end friends pass

    // --- Bonfires pass --------------------------------------------------
    // User-placed events. Each event emits TWO pin specs: a translucent
    // radius drawn first (so it sits beneath the pin), then the pin itself.
    // The radius is sized from the live camera zoom; mapZoom is in the deps
    // so the circle rescales as the user pinches.
    if (layers.bonfires) {
      const RADIUS_M = EVENT_FOOTPRINT_M;
      // Pin is a 60×60 SVG; the geo anchor is the bottom-center, which lines
      // up with the base of the bonfire logs inside the SVG.
      const EVENT_PIN_HEIGHT = 60;
      const EVENT_PIN_WIDTH = 60;
      for (const ev of mapEvents) {
        const status = getEventStatus(ev);
        const mPerPx = metersPerPixel(mapZoom, ev.lat);
        const diameterPx = Math.max(24, (RADIUS_M / mPerPx) * 2);
        out.push({
          id: `radius:${ev.id}`,
          lat: ev.lat,
          lng: ev.lng,
          render: (
            <View
              pointerEvents="none"
              style={{
                transform: [
                  { translateX: -diameterPx / 2 },
                  { translateY: -diameterPx / 2 },
                ],
              }}
            >
              <EventRadius status={status} diameterPx={diameterPx} />
            </View>
          ),
        });
        const isSelected = ev.id === selectedEventId;
        out.push({
          id: `event:${ev.id}`,
          lat: ev.lat,
          lng: ev.lng,
          render: (
            <View
              style={{
                transform: [
                  { translateX: -EVENT_PIN_WIDTH / 2 },
                  { translateY: -EVENT_PIN_HEIGHT },
                ],
                width: EVENT_PIN_WIDTH,
                alignItems: "center",
              }}
            >
              <EventPin
                event={ev}
                showTitle={isSelected}
                phaseOffsetMs={phaseFor(ev.id)}
                onPress={() => {
                  // First tap reveals the title; second tap navigates.
                  if (isSelected) {
                    setSelectedEventId(null);
                    router.push(`/event/${ev.id}`);
                  } else {
                    setSelectedEventId(ev.id);
                  }
                }}
              />
            </View>
          ),
        });
      }
    }
    return out;
  }, [filteredPresence, byId, mapEvents, mapZoom, layers, selectedEventId]);

  // "You are here" pin. Rendered first so friend pins draw on top — that
  // matches Apple Maps / Google Maps convention where your blue dot is the
  // lowest layer in the map's marker stack.
  const pinsWithSelf = useMemo<PinSpec[]>(() => {
    if (!userLocation?.isReal) return pins;
    const selfPin: PinSpec = {
      id: "self",
      lat: userLocation.coords.lat,
      lng: userLocation.coords.lng,
      render: (
        <View
          pointerEvents="none"
          style={{ transform: [{ translateX: SELF_ANCHOR_OFFSET }, { translateY: SELF_ANCHOR_OFFSET }] }}
        >
          <SelfIndicator zoom={mapZoom} />
        </View>
      ),
    };
    return [selfPin, ...pins];
  }, [pins, userLocation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }} edges={[]}>
      <AppHeader
        leading={
          <View
            style={{
              height: 40,
              backgroundColor: light.cream,
              borderRadius: 999,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              columnGap: 8,
              borderWidth: 1,
              borderColor: light.ash,
            }}
          >
            <Ionicons name="search" size={16} color={light.smoke} />
            <T variant="body" color={light.smoke} style={{ flex: 1 }}>
              Find friends or hangouts...
            </T>
          </View>
        }
        rightAction={
          <IconButton
            icon="information-circle-outline"
            variant="ghost"
            size={40}
            iconSize={20}
            onPress={() => router.push("/legend")}
            accessibilityLabel="Map legend"
          />
        }
      />

      <View style={{ flex: 1 }}>
        {/* Hold off mounting the map until we have a real location to open at.
            The hook resolves from AsyncStorage cache first (~20ms on returning
            launches), so this skips the visible fly-to-user animation. */}
        {userCenter ? (
        <MapStage
          ref={mapRef}
          center={userCenter}
          initialZoom={14}
          pins={pinsWithSelf}
          heatPoints={heatPoints}
          heatmapDim={heatmapDim}
          onZoomChange={setMapZoom}
          onLongPress={handleLongPress}
          onMapPress={() => setSelectedEventId(null)}
        >
          {/* Recenter on user — chunky 3D press, same footprint as the FAB.
              Lifts above the "bonfires near you" footer when present. */}
          <View
            style={{
              position: "absolute",
              right: 18,
              bottom: (footerHeight > 0 ? footerHeight + 24 : 68) + 64,
            }}
          >
            <ChunkyPressable
              onPress={handleRecenter}
              disabled={recentering}
              shadowColor={light.warmShadow}
              depth={4}
              radius={26}
              accessibilityLabel="Recenter on me"
              haptic="none"
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: light.hearth,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: recentering ? light.ember : light.warmShadow,
                }}
              >
                {recentering ? (
                  <ActivityIndicator size="small" color={light.ember} />
                ) : (
                  <Ionicons name="locate" size={22} color={light.coal} />
                )}
              </View>
            </ChunkyPressable>
          </View>

          {/* Layers toggle — stacked above the recenter button. Opens an
              inline popover with Friends / Bonfires / Heatmap switches. */}
          <View
            style={{
              position: "absolute",
              right: 18,
              bottom: (footerHeight > 0 ? footerHeight + 24 : 68) + 64 + 64,
            }}
          >
            <LayersControl value={layers} onChange={setLayers} />
          </View>

          {filteredPresence.length === 0 ? (
            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                left: 24,
                right: 24,
                top: "40%",
              }}
            >
              <View
                style={{
                  backgroundColor: light.hearth,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: light.ash,
                  paddingVertical: 12,
                }}
              >
                <EmptyState
                  nextGesture="go-live"
                  headline={
                    activeCircleId ? "No one from here is out." : "No one out yet."
                  }
                  body={
                    activeCircleId
                      ? "Try another circle, or be the first."
                      : "Be the first. Your circles will see you on the map."
                  }
                  cta={{ label: "Go live", onPress: () => router.push("/go-live") }}
                />
              </View>
            </View>
          ) : null}
        </MapStage>
        ) : null}
      </View>

      {/* "Bonfires near you" — collapsible footer pill. Tap to expand into
          a horizontal carousel of preview cards for the nearest events.
          Hides entirely when no events fall within NEARBY_RADIUS_KM. */}
      {nearbyEvents.length > 0 ? (
        <View
          onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 12,
          }}
        >
          <BonfiresNearby
            count={nearbyEvents.length}
            attendees={nearbyAttendees}
            onPress={handleNearbyPress}
          />
        </View>
      ) : null}

      {/* Circle filter chip — bottom-left, opposite the FAB. Tap cycles
          through filters, long-press opens the popover picker. */}
      <CircleFilterChip
        circles={myCircles}
        activeCircleId={activeCircleId}
        onSelect={setActiveCircleId}
        bottomOffset={footerHeight > 0 ? footerHeight + 24 : 68}
      />

      {/* FAB — available-now toggle. Tap = go live / end session.
          Long-press = picker for out_today / out_tonight.
          Halo color + pulse speed changes per active intent.
          Lifts when the "bonfires near you" footer is visible. */}
      <View
        style={{
          position: "absolute",
          right: 18,
          bottom: footerHeight > 0 ? footerHeight + 24 : 68,
          width: 52,
          height: 52,
        }}
      >
        {myIntent === "out_today" ? (
          <SpokeHalo color={light.dusk} duration={10000} id="spd" />
        ) : myIntent === "out_tonight" ? (
          <SpokeHalo color="#aac4e0" duration={14000} id="spn" />
        ) : myIntent === "available_now" ? (
          <EmberParticleHalo />
        ) : null}
        <ChunkyPressable
          onPress={handleFabPress}
          shadowColor={myIntent ? fabCfg.shadow : light.emberDeep}
          depth={4}
          radius={26}
          accessibilityLabel={myIntent ? "Stop broadcasting" : "Go live"}
          haptic={Haptics.ImpactFeedbackStyle.Medium}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: myIntent ? fabCfg.bg : light.ember,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={myIntent ? fabCfg.icon : "flame"}
              size={24}
              color={light.hearth}
            />
          </View>
        </ChunkyPressable>
      </View>
    </SafeAreaView>
  );
}

// Radiating ember storm — 24 sparks burst outward in every direction from
// the FAB edge, each with its own speed, distance, color, flicker frequency,
// and perpendicular curl. Density + chaos is what makes it read as fire
// rather than discrete particles.
type EmberParticleCfg = {
  angle: number;       // 0° = right, counter-clockwise (math; sin negated for screen)
  distance: number;
  duration: number;
  delay: number;
  color: string;
  size: number;
  flickerFreq: number; // oscillations per particle lifetime × π
  curl: number;        // perpendicular wobble amplitude (px)
  curlPhase: number;
};

const FAB_CENTER = 26;
const FAB_EDGE_R = 26;

const EMBER_PARTICLES: EmberParticleCfg[] = [
  { angle: 5,   distance: 28, duration: 3400, delay: 0,    color: light.ember,     size: 8, flickerFreq: 48, curl: 4, curlPhase: 0.0 },
  { angle: 22,  distance: 42, duration: 4400, delay: 85,   color: light.emberGlow, size: 6, flickerFreq: 36, curl: 6, curlPhase: 1.3 },
  { angle: 38,  distance: 32, duration: 3000, delay: 170,  color: light.ember,     size: 10, flickerFreq: 54, curl: 3, curlPhase: 2.1 },
  { angle: 52,  distance: 48, duration: 4800, delay: 255,  color: light.emberGlow, size: 6, flickerFreq: 42, curl: 5, curlPhase: 0.7 },
  { angle: 67,  distance: 26, duration: 3200, delay: 340,  color: light.emberDeep, size: 8, flickerFreq: 60, curl: 4, curlPhase: 1.9 },
  { angle: 82,  distance: 38, duration: 4000, delay: 425,  color: light.ember,     size: 8, flickerFreq: 33, curl: 6, curlPhase: 0.3 },
  { angle: 96,  distance: 30, duration: 3600, delay: 510,  color: light.emberGlow, size: 10, flickerFreq: 51, curl: 3, curlPhase: 2.5 },
  { angle: 112, distance: 44, duration: 4600, delay: 595,  color: light.ember,     size: 6, flickerFreq: 39, curl: 5, curlPhase: 1.1 },
  { angle: 128, distance: 34, duration: 3800, delay: 680,  color: light.emberGlow, size: 8, flickerFreq: 57, curl: 4, curlPhase: 0.5 },
  { angle: 143, distance: 28, duration: 3400, delay: 765,  color: light.ember,     size: 8, flickerFreq: 45, curl: 6, curlPhase: 2.3 },
  { angle: 158, distance: 40, duration: 4200, delay: 850,  color: light.emberGlow, size: 6, flickerFreq: 63, curl: 3, curlPhase: 0.9 },
  { angle: 173, distance: 32, duration: 4400, delay: 935,  color: light.ember,     size: 10, flickerFreq: 42, curl: 5, curlPhase: 1.7 },
  { angle: 188, distance: 46, duration: 5000, delay: 1020, color: light.emberGlow, size: 6, flickerFreq: 36, curl: 4, curlPhase: 2.7 },
  { angle: 203, distance: 26, duration: 3200, delay: 1105, color: light.emberDeep, size: 8, flickerFreq: 54, curl: 6, curlPhase: 0.2 },
  { angle: 218, distance: 38, duration: 4000, delay: 1190, color: light.ember,     size: 8, flickerFreq: 48, curl: 3, curlPhase: 1.5 },
  { angle: 232, distance: 30, duration: 3600, delay: 1275, color: light.emberGlow, size: 10, flickerFreq: 33, curl: 5, curlPhase: 0.6 },
  { angle: 247, distance: 42, duration: 4400, delay: 1360, color: light.ember,     size: 6, flickerFreq: 66, curl: 4, curlPhase: 2.2 },
  { angle: 262, distance: 34, duration: 3800, delay: 1445, color: light.emberGlow, size: 8, flickerFreq: 39, curl: 6, curlPhase: 1.0 },
  { angle: 278, distance: 28, duration: 3400, delay: 1530, color: light.ember,     size: 8, flickerFreq: 51, curl: 3, curlPhase: 0.4 },
  { angle: 293, distance: 44, duration: 4600, delay: 1615, color: light.emberGlow, size: 6, flickerFreq: 45, curl: 5, curlPhase: 1.8 },
  { angle: 308, distance: 36, duration: 4200, delay: 1700, color: light.ember,     size: 8, flickerFreq: 57, curl: 4, curlPhase: 2.4 },
  { angle: 322, distance: 30, duration: 3600, delay: 1785, color: light.emberGlow, size: 10, flickerFreq: 42, curl: 6, curlPhase: 0.8 },
  { angle: 338, distance: 40, duration: 4800, delay: 1870, color: light.emberDeep, size: 6, flickerFreq: 60, curl: 3, curlPhase: 1.4 },
  { angle: 352, distance: 34, duration: 3800, delay: 1955, color: light.ember,     size: 8, flickerFreq: 36, curl: 5, curlPhase: 2.0 },
];

function EmberParticleHalo() {
  return (
    <>
      {EMBER_PARTICLES.map((cfg, i) => (
        <EmberParticle key={i} {...cfg} />
      ))}
    </>
  );
}

function EmberParticle({
  angle, distance, duration, delay, color, size, flickerFreq, curl, curlPhase,
}: EmberParticleCfg) {
  const t = useSharedValue(0);

  // Direction unit vector. Screen Y grows downward, so sin is negated.
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = -Math.sin(rad);
  // Perpendicular vector (rotated +90°), for curl motion.
  const px = -dy;
  const py = dx;

  // Spawn position: at the FAB edge along the particle's angle.
  const startX = FAB_CENTER + FAB_EDGE_R * dx - size / 2;
  const startY = FAB_CENTER + FAB_EDGE_R * dy - size / 2;

  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(t);
  }, [t, duration, delay]);

  const animStyle = useAnimatedStyle(() => {
    const envelope = interpolate(t.value, [0, 0.08, 0.8, 1], [0, 1, 0.5, 0]);
    const flicker = 0.65 + 0.35 * Math.sin(t.value * Math.PI * flickerFreq);
    // Curl: perpendicular sine wave that grows with t (more sway as it travels).
    const curlOffset = Math.sin(t.value * Math.PI * 2.5 + curlPhase) * curl * t.value;
    return {
      opacity: envelope * flicker,
      transform: [
        { translateX: distance * dx * t.value + px * curlOffset },
        { translateY: distance * dy * t.value + py * curlOffset },
        { scale: interpolate(t.value, [0, 1], [1, 0.3]) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: startX,
          top: startY,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
  );
}

// 8 thin rays arranged radially around the FAB, rotating slowly.
// Each ray fades to transparent at its tip via a vertical linear gradient.
// Used for out_today (golden) and out_tonight (silver-blue) with different speeds.
const SPOKE_SIZE = 96;
const SPOKE_CX = SPOKE_SIZE / 2;
const SPOKE_CY = SPOKE_SIZE / 2;
const SPOKE_INNER_R = 30; // 4px gap beyond FAB edge (26px radius)
const SPOKE_OUTER_R = 46;
const SPOKE_LEN = SPOKE_OUTER_R - SPOKE_INNER_R;
const SPOKE_W = 3;
const SPOKE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function SpokeHalo({ color, duration, id }: { color: string; duration: number; id: string }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(
      withTiming(360, { duration, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(rot);
  }, [duration, rot]);
  const rotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: -(SPOKE_SIZE - 52) / 2,
          top: -(SPOKE_SIZE - 52) / 2,
          width: SPOKE_SIZE,
          height: SPOKE_SIZE,
        },
        rotStyle,
      ]}
    >
      <Svg width={SPOKE_SIZE} height={SPOKE_SIZE}>
        <Defs>
          {/* y1=0 is the tip (transparent), y2=1 is the base near the FAB (opaque) */}
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.9" />
          </LinearGradient>
        </Defs>
        {SPOKE_ANGLES.map((angle) => (
          <Rect
            key={angle}
            x={SPOKE_CX - SPOKE_W / 2}
            y={SPOKE_CY - SPOKE_OUTER_R}
            width={SPOKE_W}
            height={SPOKE_LEN}
            rx={SPOKE_W / 2}
            fill={`url(#${id})`}
            transform={`rotate(${angle}, ${SPOKE_CX}, ${SPOKE_CY})`}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}
