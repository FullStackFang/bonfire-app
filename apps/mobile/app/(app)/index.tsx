import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
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
  Avatar,
  AvatarStack,
  ChunkyPressable,
  EmptyState,
  T,
} from "../../components/ui";
import {
  MapStage,
  type MapStageHandle,
  type PinSpec,
} from "../../components/map/MapStage";
import { PulsingMapPin } from "../../components/map/PulsingMapPin";
import { SELF_INDICATOR_SIZE, SelfIndicator } from "../../components/map/SelfIndicator";
import { EventPin } from "../../components/map/EventPin";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { heatmapPulseMs, light } from "@bonfire/ui-tokens";
import { buildHeatPoints } from "../../lib/mapProjection";
import { MOCK_CENTER } from "../../lib/mockSeeds";
import { useUserLocation } from "../../lib/useUserLocation";
import {
  useVisiblePresence,
  usePeople,
  findVenueSync,
  useMapEvents,
} from "../../lib/data";
import { useSession } from "../../lib/session";
import { intentMeta } from "../../components/ui";
import type { Intent } from "@bonfire/shared";

// Per-intent FAB config: face color, icon, shadow.
// available_now → EmberRippleHalo, out_today/out_tonight → SpokeHalo.
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

// Pin renders are anchored at their geographic point. These offsets pull each
// pin so its visual anchor (the avatar centre for loose pins; the bottom of
// the avatar stack for venue groups) lands exactly on the geo coordinate.
const LOOSE_PIN_SIZE = 32;
const LOOSE_ANCHOR_OFFSET = -LOOSE_PIN_SIZE / 2;
const VENUE_ANCHOR_OFFSET_X = -32;
const VENUE_ANCHOR_OFFSET_Y = -28;
const SELF_ANCHOR_OFFSET = -SELF_INDICATOR_SIZE / 2;

export default function Home() {
  const { user } = useSession();
  const presence = useVisiblePresence();
  const { byId } = usePeople();
  const mapEvents = useMapEvents();
  const userLocation = useUserLocation(MOCK_CENTER);
  const userCenter = userLocation?.coords ?? null;
  const mapRef = useRef<MapStageHandle>(null);
  const [recentering, setRecentering] = useState(false);
  const [mapZoom, setMapZoom] = useState(14);

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

  const heatPoints = useMemo(() => buildHeatPoints(presence), [presence]);

  // Group presence into venue clusters (rendered as avatar stacks) and loose
  // pins (rendered as single avatars). Coordinates stay in lat/lng — MapStage
  // projects them based on the live camera.
  const pins = useMemo<PinSpec[]>(() => {
    type VenueGroup = {
      lat: number;
      lng: number;
      users: ReturnType<typeof byId.get>[];
      intent: string;
      venueName: string | null;
    };
    const byVenue = new Map<string, VenueGroup>();
    const loose: { lat: number; lng: number; user: ReturnType<typeof byId.get>; intent: string; id: string }[] = [];

    for (const e of presence) {
      if (e.lat == null || e.lng == null) continue;
      const user = byId.get(e.user_id);
      if (!user) continue;
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

    const out: PinSpec[] = [];
    for (const [venueId, g] of byVenue.entries()) {
      out.push({
        id: `venue:${venueId}`,
        lat: g.lat,
        lng: g.lng,
        render: (
          <View style={{ transform: [{ translateX: VENUE_ANCHOR_OFFSET_X }, { translateY: VENUE_ANCHOR_OFFSET_Y }] }}>
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
            <Pressable onPress={() => router.push(`/venue/${venueId}`)}>
              <AvatarStack
                size="sm"
                max={3}
                avatars={g.users.map((u: any) => ({
                  label: u.letter_pair,
                  color: u.avatar_color,
                  live: true,
                }))}
              />
            </Pressable>
          </View>
        ),
      });
    }
    for (const p of loose) {
      out.push({
        id: `loose:${p.id}`,
        lat: p.lat,
        lng: p.lng,
        render: (
          <View style={{ transform: [{ translateX: LOOSE_ANCHOR_OFFSET }, { translateY: LOOSE_ANCHOR_OFFSET }] }}>
            <PulsingMapPin pinSize={LOOSE_PIN_SIZE}>
              <Avatar
                label={(p.user as any)?.letter_pair ?? "?"}
                color={(p.user as any)?.avatar_color ?? light.smoke}
                size="sm"
                live
              />
            </PulsingMapPin>
          </View>
        ),
      });
    }
    // User-placed events. Anchored at the bottom of the pin notch — the
    // EventPin component handles its own internal layout; we just push it up
    // so the notch tip sits on the geo point.
    for (const ev of mapEvents) {
      out.push({
        id: `event:${ev.id}`,
        lat: ev.lat,
        lng: ev.lng,
        render: (
          <View
            style={{
              transform: [{ translateX: -100 }, { translateY: -42 }],
              width: 200,
              alignItems: "center",
            }}
          >
            <EventPin event={ev} />
          </View>
        ),
      });
    }
    return out;
  }, [presence, byId, mapEvents]);

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
          onZoomChange={setMapZoom}
          onLongPress={handleLongPress}
        >
          {/* Recenter on user — chunky 3D press, same footprint as the FAB */}
          <View style={{ position: "absolute", right: 18, bottom: 132 }}>
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

          {presence.length === 0 ? (
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
                  headline="No one out yet."
                  body="Be the first. Your circles will see you on the map."
                  cta={{ label: "Go live", onPress: () => router.push("/go-live") }}
                />
              </View>
            </View>
          ) : null}
        </MapStage>
        ) : null}
      </View>

      {/* FAB — available-now toggle. Tap = go live / end session.
          Long-press = picker for out_today / out_tonight.
          Halo color + pulse speed changes per active intent. */}
      <View style={{ position: "absolute", right: 18, bottom: 68, width: 52, height: 52 }}>
        {myIntent === "out_today" ? (
          <SpokeHalo color={light.dusk} duration={10000} id="spd" />
        ) : myIntent === "out_tonight" ? (
          <SpokeHalo color="#aac4e0" duration={14000} id="spn" />
        ) : myIntent === "available_now" ? (
          <EmberRippleHalo />
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

// Three ember rings that expand and fade sequentially, staggered by 1/3 of
// heatmapPulseMs each. Rings overlap in time so there's always motion — like
// fire radiating outward from the button.
const EMBER_CYCLE = heatmapPulseMs; // 3200ms

function EmberRippleHalo() {
  const r0 = useSharedValue(0);
  const r1 = useSharedValue(0);
  const r2 = useSharedValue(0);

  useEffect(() => {
    const stagger = Math.round(EMBER_CYCLE / 3);
    const ring = (delay: number) =>
      withDelay(delay, withRepeat(
        withTiming(1, { duration: EMBER_CYCLE, easing: Easing.out(Easing.cubic) }),
        -1, false,
      ));
    r0.value = ring(0);
    r1.value = ring(stagger);
    r2.value = ring(stagger * 2);
    return () => { cancelAnimation(r0); cancelAnimation(r1); cancelAnimation(r2); };
  }, [r0, r1, r2]);

  const s0 = useAnimatedStyle(() => ({
    opacity: interpolate(r0.value, [0, 1], [0.62, 0]),
    transform: [{ scale: interpolate(r0.value, [0, 1], [1.0, 2.5]) }],
  }));
  const s1 = useAnimatedStyle(() => ({
    opacity: interpolate(r1.value, [0, 1], [0.62, 0]),
    transform: [{ scale: interpolate(r1.value, [0, 1], [1.0, 2.5]) }],
  }));
  const s2 = useAnimatedStyle(() => ({
    opacity: interpolate(r2.value, [0, 1], [0.62, 0]),
    transform: [{ scale: interpolate(r2.value, [0, 1], [1.0, 2.5]) }],
  }));

  const base = {
    position: "absolute" as const,
    left: 0, top: 0,
    width: 52, height: 52,
    borderRadius: 26,
    backgroundColor: light.ember,
  };

  return (
    <>
      <Animated.View pointerEvents="none" style={[base, s0]} />
      <Animated.View pointerEvents="none" style={[base, s1]} />
      <Animated.View pointerEvents="none" style={[base, s2]} />
    </>
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
