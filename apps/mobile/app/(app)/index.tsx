import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
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
import { heatmapPulseMs, light } from "@bonfire/ui-tokens";
import { buildHeatPoints } from "../../lib/mapProjection";
import { MOCK_CENTER } from "../../lib/mockSeeds";
import { useUserLocation } from "../../lib/useUserLocation";
import { useVisiblePresence, usePeople, findVenueSync } from "../../lib/data";
import { useSession } from "../../lib/session";
import { intentMeta } from "../../components/ui";

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
  const userLocation = useUserLocation(MOCK_CENTER);
  const userCenter = userLocation?.coords ?? null;
  const mapRef = useRef<MapStageHandle>(null);
  const [recentering, setRecentering] = useState(false);

  // The Go-live FAB pulses when the user has an active broadcast. The pulse
  // is the only place that surfaces "you're live right now" — the chip-row
  // status indicator was removed in favor of this.
  const isLive = useMemo(() => {
    if (!user) return false;
    const now = Date.now();
    return presence.some(
      (p) =>
        p.user_id === user.id &&
        p.ended_at == null &&
        new Date(p.expires_at).getTime() > now,
    );
  }, [presence, user]);

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!isLive) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: heatmapPulseMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [isLive, pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.28 + pulse.value * 0.42,
    transform: [{ scale: 1 + pulse.value * 0.18 }],
  }));

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
    return out;
  }, [presence, byId]);

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
          <SelfIndicator />
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

      {/* FAB — Go live. Sits just above the tab bar (64pt tall), matched size
          with the recenter control above it. When the user is live, a soft
          ember halo pulses behind it — the only "you're broadcasting" cue. */}
      <View style={{ position: "absolute", right: 18, bottom: 68, width: 52, height: 52 }}>
        {isLive ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: -10,
                top: -10,
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: light.emberGlow,
              },
              haloStyle,
            ]}
          />
        ) : null}
        <ChunkyPressable
          onPress={() => router.push("/go-live")}
          shadowColor={light.emberDeep}
          depth={4}
          radius={26}
          accessibilityLabel="Go live"
          haptic={Haptics.ImpactFeedbackStyle.Medium}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: light.ember,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="flame" size={24} color={light.hearth} />
          </View>
        </ChunkyPressable>
      </View>
    </SafeAreaView>
  );
}
