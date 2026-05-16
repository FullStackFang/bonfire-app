import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
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
  Chip,
  EmptyState,
  T,
} from "../../components/ui";
import {
  MapStage,
  type MapStageHandle,
  type PinSpec,
} from "../../components/map/MapStage";
import { PulsingMapPin } from "../../components/map/PulsingMapPin";
import { light } from "@bonfire/ui-tokens";
import { buildHeatPoints } from "../../lib/mapProjection";
import { MOCK_CENTER } from "../../lib/mockSeeds";
import { useUserLocation } from "../../lib/useUserLocation";
import { useVisiblePresence, usePeople, findVenueSync } from "../../lib/data";
import { useSession } from "../../lib/session";
import { intentMeta } from "../../components/ui";

type Filter = "people" | "events" | "available";

// Pin renders are anchored at their geographic point. These offsets pull each
// pin so its visual anchor (the avatar centre for loose pins; the bottom of
// the avatar stack for venue groups) lands exactly on the geo coordinate.
const LOOSE_PIN_SIZE = 32;
const LOOSE_ANCHOR_OFFSET = -LOOSE_PIN_SIZE / 2;
const VENUE_ANCHOR_OFFSET_X = -32;
const VENUE_ANCHOR_OFFSET_Y = -28;

export default function Home() {
  const { user } = useSession();
  const presence = useVisiblePresence();
  const { byId } = usePeople();
  const [filter, setFilter] = useState<Filter>("people");
  const userLocation = useUserLocation(MOCK_CENTER);
  const userCenter = userLocation?.coords ?? null;
  const mapRef = useRef<MapStageHandle>(null);
  const [recentering, setRecentering] = useState(false);

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

  const filtered = useMemo(() => {
    if (filter === "available") {
      return presence.filter((p) => p.intent === "available_now");
    }
    return presence;
  }, [presence, filter]);

  const heatPoints = useMemo(() => buildHeatPoints(filtered), [filtered]);

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

    for (const e of filtered) {
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
  }, [filtered, byId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }} edges={["top"]}>
      <AppHeader
        leading={
          <View
            style={{
              height: 40,
              backgroundColor: light.hearth,
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          columnGap: 8,
        }}
      >
        <Chip
          label="People"
          variant={filter === "people" ? "solid" : "outline"}
          onPress={() => setFilter("people")}
          leftIcon={<Ionicons name="flame" size={11} color={filter === "people" ? light.hearth : light.coal} />}
        />
        <Chip
          label="Events"
          variant={filter === "events" ? "solid" : "outline"}
          onPress={() => setFilter("events")}
          leftIcon={<Ionicons name="calendar" size={11} color={filter === "events" ? light.hearth : light.coal} />}
        />
        <Chip
          label="Available now"
          variant={filter === "available" ? "solid" : "outline"}
          onPress={() => setFilter("available")}
          rightIcon={<Ionicons name="chevron-down" size={11} color={filter === "available" ? light.hearth : light.coal} />}
        />
      </ScrollView>

      <View style={{ flex: 1, marginTop: 12 }}>
        {/* Hold off mounting the map until we have a real location to open at.
            The hook resolves from AsyncStorage cache first (~20ms on returning
            launches), so this skips the visible fly-to-user animation. */}
        {userCenter ? (
        <MapStage
          ref={mapRef}
          center={userCenter}
          initialZoom={14}
          pins={pins}
          heatPoints={heatPoints}
        >
          {/* available-now floating badge — chunky, hearth-on-warm-shadow */}
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: 14, left: 14, paddingBottom: 3 }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 3,
                bottom: 0,
                backgroundColor: light.warmShadow,
                borderRadius: 999,
              }}
            />
            <View
              style={{
                backgroundColor: light.hearth,
                borderRadius: 999,
                paddingHorizontal: 13,
                paddingVertical: 7,
                flexDirection: "row",
                alignItems: "center",
                columnGap: 7,
                borderWidth: 1.5,
                borderColor: light.warmShadow,
                borderBottomWidth: 1.5,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: light.spark,
                }}
              />
              <T
                variant="bodySm"
                style={{
                  fontFamily: "Onest_600SemiBold",
                  color: light.coal,
                  letterSpacing: 0.3,
                  fontSize: 13,
                }}
              >
                Available now
              </T>
            </View>
          </View>

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
          with the recenter control above it. */}
      <View style={{ position: "absolute", right: 18, bottom: 68 }}>
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
