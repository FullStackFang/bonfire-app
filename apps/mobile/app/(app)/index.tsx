import { useMemo, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  Avatar,
  AvatarStack,
  Chip,
  EmptyState,
  T,
} from "../../components/ui";
import { MapStage } from "../../components/map/MapStage";
import { light } from "@bonfire/ui-tokens";
import {
  ITHACA_BOUNDS,
  buildHeatCells,
  projectPoint,
} from "../../lib/mapProjection";
import { useVisiblePresence, usePeople, findVenueSync } from "../../lib/data";
import { intentMeta } from "../../components/ui";

type Filter = "people" | "events" | "available";

export default function Home() {
  const { width, height } = useWindowDimensions();
  const mapHeight = height - 220; // crude estimate; SafeArea + search + chips + tab bar
  const presence = useVisiblePresence();
  const { byId } = usePeople();
  const [filter, setFilter] = useState<Filter>("people");

  const filtered = useMemo(() => {
    if (filter === "available") {
      return presence.filter((p) => p.intent === "available_now");
    }
    return presence;
  }, [presence, filter]);

  const cells = useMemo(
    () => buildHeatCells(filtered, ITHACA_BOUNDS, width, mapHeight),
    [filtered, width, mapHeight],
  );

  // Group pins by venue or by 60px proximity to render AvatarStacks.
  const groups = useMemo(() => {
    const byVenue = new Map<string, { x: number; y: number; users: typeof byId extends Map<string, infer V> ? V[] : never; intent: string; venueName: string | null }>();
    const loose: { x: number; y: number; user: ReturnType<typeof byId.get>; intent: string }[] = [];
    for (const e of filtered) {
      if (e.lat == null || e.lng == null) continue;
      const user = byId.get(e.user_id);
      if (!user) continue;
      const p = projectPoint(e.lat, e.lng, ITHACA_BOUNDS, width, mapHeight);
      if (e.venue_id) {
        const venue = findVenueSync(e.venue_id);
        const key = e.venue_id;
        const g = byVenue.get(key);
        if (g) {
          g.users.push(user as never);
        } else {
          byVenue.set(key, {
            x: p.x,
            y: p.y,
            users: [user as never],
            intent: e.intent,
            venueName: venue?.name ?? null,
          });
        }
      } else {
        loose.push({ x: p.x, y: p.y, user, intent: e.intent });
      }
    }
    return { byVenue: Array.from(byVenue.entries()), loose };
  }, [filtered, byId, width, mapHeight]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }} edges={["top"]}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 4,
          flexDirection: "row",
          columnGap: 12,
        }}
      >
        <Pressable
          onPress={() => router.push("/(app)/profile")}
        >
          <Avatar label="Y" color={light.ember} size="md" />
        </Pressable>
        <View
          style={{
            flex: 1,
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
          <Ionicons name="flame" size={16} color={light.ember} />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
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
        <MapStage width={width} height={mapHeight} cells={cells}>
          {/* available-now floating chip */}
          <View
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              backgroundColor: light.hearth,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 6,
              flexDirection: "row",
              alignItems: "center",
              columnGap: 6,
              borderWidth: 1,
              borderColor: light.ash,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: light.spark,
              }}
            />
            <T variant="bodySm" style={{ fontFamily: "Onest_600SemiBold" }}>
              Available now
            </T>
          </View>

          {/* Venue-grouped avatar stacks + activity bubbles */}
          {groups.byVenue.map(([venueId, g]) => (
            <View
              key={venueId}
              style={{
                position: "absolute",
                left: g.x - 32,
                top: g.y - 28,
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
          ))}

          {/* Loose pins (no venue) */}
          {groups.loose.map((p, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: p.x - 16,
                top: p.y - 16,
              }}
            >
              <Avatar
                label={(p.user as any)?.letter_pair ?? "?"}
                color={(p.user as any)?.avatar_color ?? light.smoke}
                size="sm"
                live
              />
            </View>
          ))}

          {presence.length === 0 ? (
            <View
              style={{
                position: "absolute",
                left: 24,
                right: 24,
                top: mapHeight / 2 - 140,
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
      </View>

      {/* FAB */}
      <Pressable
        onPress={() => router.push("/go-live")}
        style={{
          position: "absolute",
          right: 18,
          bottom: 96,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: light.ember,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 3,
          borderColor: light.hearth,
          shadowColor: light.ember,
          shadowOpacity: 0.4,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Ionicons name="flame" size={26} color={light.hearth} />
      </Pressable>
    </SafeAreaView>
  );
}
