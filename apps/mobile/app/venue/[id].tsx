import { useMemo } from "react";
import { Linking, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AvatarStack,
  BonfireScore,
  CTAButton,
  Card,
  IconButton,
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
  const categoryIcon = iconForCategory(venue.category);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }} edges={["top", "left", "right"]}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 4,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <IconButton
          icon="chevron-back"
          variant="ghost"
          iconSize={26}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        />
        <View style={{ flexDirection: "row", columnGap: 4 }}>
          <IconButton
            icon="bookmark-outline"
            variant="ghost"
            iconSize={22}
            onPress={() => {}}
            accessibilityLabel="Bookmark"
          />
          <IconButton
            icon="share-outline"
            variant="ghost"
            iconSize={22}
            onPress={() => {}}
            accessibilityLabel="Share"
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, rowGap: 12, paddingBottom: 140 }}>
        {/* Hero card — venue identity + bonfire score. Warm ember glow on the
            category badge supplies the "bonfire" character; no full-bleed
            tinted block, no rounded-sheet seam. */}
        <View
          style={{
            backgroundColor: light.hearth,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: light.ash,
            padding: 18,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", columnGap: 14 }}>
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  alignSelf: "flex-start",
                  columnGap: 6,
                  backgroundColor: light.ember + "14",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                }}
              >
                <Ionicons name={categoryIcon} size={12} color={light.ember} />
                <T
                  variant="bodySm"
                  color={light.ember}
                  style={{ fontFamily: "Onest_600SemiBold", letterSpacing: 0.3 }}
                >
                  {capitalize(venue.category)}
                </T>
              </View>
              <T variant="title" style={{ marginTop: 10 }}>
                {venue.name}
              </T>
              <T variant="bodySm" color={light.smoke} style={{ marginTop: 4 }}>
                {venue.neighborhood ? `${venue.neighborhood} · ` : ""}0.3 mi away
              </T>
            </View>
            <BonfireScore score={score} size="lg" />
          </View>
        </View>

        <Card padding={14}>
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

        <T variant="overline" color={light.smoke} style={{ letterSpacing: 1.1, marginTop: 4 }}>
          LIVE ACTIVITY
        </T>

        {activities.length > 0 ? (
          <Card padding={14}>
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
                <T variant="monoSm" color={light.smoke} style={{ minWidth: 42 }}>
                  {a.timeLabel}
                </T>
                <T variant="body" style={{ flex: 1 }}>
                  {a.message}
                </T>
              </View>
            ))}
          </Card>
        ) : (
          <T variant="bodySm" color={light.smoke}>
            No activity yet. Be the spark.
          </T>
        )}
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
    </SafeAreaView>
  );
}

function iconForCategory(category: string): React.ComponentProps<typeof Ionicons>["name"] {
  switch (category) {
    case "bar":
      return "wine";
    case "restaurant":
      return "restaurant";
    case "cafe":
      return "cafe";
    default:
      return "flame";
  }
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
