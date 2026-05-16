import { useMemo } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AvatarStack,
  BonfireScore,
  CTAButton,
  Card,
  LiveDot,
  T,
} from "../../components/ui";
import { light } from "@bonfire/ui-tokens";
import {
  findVenueSync,
  usePeople,
  useVisiblePresence,
} from "../../lib/data";
import { bonfireScoreForVenue } from "../../lib/bonfireScore";
import { relTime } from "../../lib/relTime";
import type { PresenceEvent, User } from "@bonfire/shared";

export default function VenueDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const venue = findVenueSync(params.id ?? "");
  const presence = useVisiblePresence();
  const { byId } = usePeople();

  const friendsHere = useMemo(
    () => presence.filter((p) => p.venue_id === params.id && !p.ended_at),
    [presence, params.id],
  );

  const score = useMemo(
    () => bonfireScoreForVenue(params.id ?? "", presence),
    [params.id, presence],
  );

  if (!venue) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
        <T variant="body" align="center" style={{ marginTop: 40 }} color={light.smoke}>
          Venue not found.
        </T>
      </SafeAreaView>
    );
  }

  const users = friendsHere
    .map((e) => byId.get(e.user_id))
    .filter(Boolean) as User[];

  const activities = buildActivityFeed(friendsHere);

  return (
    <View style={{ flex: 1, backgroundColor: light.cream }}>
      <VenueHero venue={venue} />

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 140,
        }}
        style={{ marginTop: -20 }}
      >
        <View
          style={{
            backgroundColor: light.cream,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              columnGap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <T variant="title">{venue.name}</T>
              <T variant="bodySm" color={light.smoke} style={{ marginTop: 4 }}>
                {capitalize(venue.category)}
                {venue.neighborhood ? ` · ${venue.neighborhood}` : ""}
                {" · 0.3 mi"}
              </T>
            </View>
            <BonfireScore score={score} size="lg" />
          </View>

          <Card padding={14} style={{ marginTop: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", columnGap: 8 }}>
              <LiveDot pulse={users.length > 0} />
              <T variant="bodyLg" style={{ fontFamily: "Onest_600SemiBold" }}>
                {users.length} friend{users.length === 1 ? "" : "s"} here now
              </T>
            </View>
            {users.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <AvatarStack
                  size="md"
                  max={5}
                  avatars={users.map((u) => ({ label: u.letter_pair, color: u.avatar_color }))}
                />
              </View>
            ) : (
              <T variant="bodySm" color={light.smoke} style={{ marginTop: 8 }}>
                Be the first to drop a pin. The bonfire warms up when someone heads over.
              </T>
            )}
          </Card>

          <T variant="overline" color={light.smoke} style={{ marginTop: 20, letterSpacing: 1.1 }}>
            LIVE ACTIVITY
          </T>

          {activities.length > 0 ? (
            <Card padding={14} style={{ marginTop: 10 }}>
              {activities.map((a, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    columnGap: 10,
                    marginTop: i === 0 ? 0 : 8,
                    alignItems: "flex-start",
                  }}
                >
                  <T
                    variant="monoSm"
                    color={light.smoke}
                    style={{ minWidth: 42 }}
                  >
                    {a.timeLabel}
                  </T>
                  <T variant="body" style={{ flex: 1 }}>
                    {a.message}
                  </T>
                </View>
              ))}
            </Card>
          ) : (
            <T variant="bodySm" color={light.smoke} style={{ marginTop: 10 }}>
              No activity yet. Be the spark.
            </T>
          )}
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <View
          style={{
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: 14,
            flexDirection: "row",
            columnGap: 8,
            backgroundColor: light.cream,
            borderTopWidth: 0.5,
            borderTopColor: light.ash,
          }}
        >
          <View style={{ flex: 1 }}>
            <CTAButton label="Drop a pin" variant="outline" onPress={() => router.back()} />
          </View>
          <View style={{ flex: 1.3 }}>
            <CTAButton
              label="Walk over"
              onPress={() => {
                Linking.openURL(`maps://?daddr=${venue.name}&dirflg=w`).catch(() => {});
                router.back();
              }}
              haptic="success"
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function VenueHero({ venue }: { venue: ReturnType<typeof findVenueSync> }) {
  // Three illustrated archetypes; warmth varies by category.
  const tint =
    venue?.category === "bar" ? "#a3724a"
    : venue?.category === "restaurant" ? "#b88962"
    : venue?.category === "cafe" ? "#c89e6e"
    : "#a89481";

  return (
    <View style={{ height: 200, backgroundColor: tint, position: "relative" }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 100, backgroundColor: "rgba(0,0,0,0.12)" }} />
      <View style={{ position: "absolute", top: 35, left: 30, width: 60, height: 50, backgroundColor: "rgba(0,0,0,0.18)", borderRadius: 4 }} />
      <View style={{ position: "absolute", top: 45, right: 40, width: 70, height: 40, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 4 }} />
      <SafeAreaView edges={["top"]} style={{ position: "absolute", left: 0, right: 0, top: 0 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: 8,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={20}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: light.hearth,
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.95,
            }}
          >
            <Ionicons name="arrow-back" size={18} color={light.coal} />
          </Pressable>
          <View style={{ flexDirection: "row", columnGap: 8 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: light.hearth, alignItems: "center", justifyContent: "center", opacity: 0.95 }}>
              <Ionicons name="bookmark-outline" size={18} color={light.coal} />
            </View>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: light.hearth, alignItems: "center", justifyContent: "center", opacity: 0.95 }}>
              <Ionicons name="share-outline" size={18} color={light.coal} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function buildActivityFeed(events: PresenceEvent[]): { timeLabel: string; message: string }[] {
  const sorted = [...events].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );
  return sorted.slice(0, 5).map((e) => ({
    timeLabel: relTime(e.started_at),
    message:
      e.intent === "available_now" ? "Friend went live here" : "Friend marked here",
  }));
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
