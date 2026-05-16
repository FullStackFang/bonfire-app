import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AppHeader,
  AvatarStack,
  CTAButton,
  Card,
  Chip,
  EmptyState,
  IconButton,
  LiveDot,
  T,
} from "../../components/ui";
import { light } from "@bonfire/ui-tokens";
import {
  findVenueSync,
  useMyCircles,
  usePeople,
  useVisiblePresence,
} from "../../lib/data";
import { relTime } from "../../lib/relTime";
import type { PresenceEvent, User } from "@bonfire/shared";

type Filter = "now" | "today" | "tonight";

export default function Around() {
  const [filter, setFilter] = useState<Filter>("now");
  const presence = useVisiblePresence();
  const { byId } = usePeople();
  const circles = useMyCircles();

  const filtered = useMemo(() => {
    if (filter === "now") return presence.filter((p) => p.intent === "available_now");
    if (filter === "today") return presence.filter((p) => p.intent === "out_today" || p.intent === "available_now");
    return presence.filter((p) => p.intent === "out_tonight");
  }, [presence, filter]);

  // Group events by venue
  const grouped = useMemo(() => {
    const byVenue = new Map<string, { venueId: string; events: PresenceEvent[] }>();
    const solos: PresenceEvent[] = [];
    for (const e of filtered) {
      if (e.venue_id) {
        const g = byVenue.get(e.venue_id);
        if (g) g.events.push(e);
        else byVenue.set(e.venue_id, { venueId: e.venue_id, events: [e] });
      } else {
        solos.push(e);
      }
    }
    return { groups: Array.from(byVenue.values()), solos };
  }, [filtered]);

  const circleById = new Map(circles.map((c) => [c.id, c]));

  const isEmpty = grouped.groups.length === 0 && grouped.solos.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }} edges={[]}>
      <AppHeader
        title="Around you"
        rightAction={
          <IconButton
            icon="map"
            onPress={() => router.push("/(app)")}
            accessibilityLabel="Switch to map view"
          />
        }
      />

      <View style={{ flexDirection: "row", paddingHorizontal: 20, marginTop: 12, columnGap: 8 }}>
        <Chip label="Now" variant={filter === "now" ? "solid" : "outline"} onPress={() => setFilter("now")} />
        <Chip label="Today" variant={filter === "today" ? "solid" : "outline"} onPress={() => setFilter("today")} />
        <Chip label="Tonight" variant={filter === "tonight" ? "solid" : "outline"} onPress={() => setFilter("tonight")} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, rowGap: 12, paddingBottom: 40 }}>
        {isEmpty ? (
          <EmptyState
            nextGesture="go-live"
            headline="Quiet out there."
            body="Be the first. Your circles will see you on the map."
            cta={{ label: "Go live", onPress: () => router.push("/go-live") }}
          />
        ) : (
          <>
            {grouped.groups.map((g) => (
              <GroupCard key={g.venueId} venueId={g.venueId} events={g.events} byId={byId} circleById={circleById} />
            ))}
            {grouped.solos.map((e) => (
              <SoloCard key={e.id} event={e} byId={byId} circleById={circleById} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function GroupCard({
  venueId,
  events,
  byId,
  circleById,
}: {
  venueId: string;
  events: PresenceEvent[];
  byId: Map<string, User>;
  circleById: Map<string, { name: string; accent_color: string }>;
}) {
  const venue = findVenueSync(venueId);
  const users = events.map((e) => byId.get(e.user_id)).filter(Boolean) as User[];
  const first = events[0];
  const circle = first.visible_to_circle_ids[0] ? circleById.get(first.visible_to_circle_ids[0]) : null;
  const summary = users.length > 1
    ? `${users.slice(0, 2).map((u) => u.display_name.split(" ")[0]).join(", ")}${users.length > 2 ? ` +${users.length - 2}` : ""}`
    : users[0]?.display_name ?? "";
  const intent = first.intent;
  const intentLabel = intent === "available_now" ? "Out for drinks" : intent === "out_today" ? "Out today" : "Out tonight";

  return (
    <Pressable onPress={() => router.push(`/venue/${venueId}`)}>
      <Card padding={14}>
        <View style={{ flexDirection: "row", alignItems: "center", columnGap: 10 }}>
          <AvatarStack
            size="sm"
            max={3}
            avatars={users.map((u) => ({ label: u.letter_pair, color: u.avatar_color }))}
          />
          <View style={{ flex: 1 }}>
            <T variant="bodyLg" style={{ fontFamily: "Onest_600SemiBold" }}>
              {summary}
            </T>
            <T variant="bodySm" color={light.smoke} style={{ marginTop: 1 }}>
              at {venue?.name ?? "an unknown place"} · {relTime(first.started_at)}
            </T>
          </View>
          <LiveDot pulse />
        </View>

        <View
          style={{
            marginTop: 12,
            backgroundColor: light.ember + "12",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            columnGap: 6,
          }}
        >
          <Ionicons name="beer" size={13} color={light.dusk} />
          <T variant="bodySm" color={light.coal}>
            {intentLabel}
            {circle ? ` · ${circle.name}` : ""}
          </T>
        </View>

        <View style={{ marginTop: 12 }}>
          <CTAButton label="Join them" onPress={() => router.push(`/venue/${venueId}`)} />
        </View>
      </Card>
    </Pressable>
  );
}

function SoloCard({
  event,
  byId,
  circleById,
}: {
  event: PresenceEvent;
  byId: Map<string, User>;
  circleById: Map<string, { name: string; accent_color: string }>;
}) {
  const user = byId.get(event.user_id);
  if (!user) return null;
  const venue = event.venue_id ? findVenueSync(event.venue_id) : null;
  const circle = event.visible_to_circle_ids[0] ? circleById.get(event.visible_to_circle_ids[0]) : null;
  const intentLabel =
    event.intent === "available_now" ? "Available · open to company"
    : event.intent === "out_today" ? "Out today · floating"
    : "Out tonight";

  return (
    <Pressable onPress={() => router.push(venue ? `/venue/${event.venue_id}` : `/(app)/profile/${user.id}`)}>
      <Card padding={14}>
        <View style={{ flexDirection: "row", alignItems: "center", columnGap: 10 }}>
          <AvatarStack
            size="sm"
            max={1}
            avatars={[{ label: user.letter_pair, color: user.avatar_color }]}
          />
          <View style={{ flex: 1 }}>
            <T variant="bodyLg" style={{ fontFamily: "Onest_600SemiBold" }}>
              {user.display_name}
            </T>
            <T variant="bodySm" color={light.smoke} style={{ marginTop: 1 }}>
              {venue ? `at ${venue.name} · ` : ""}{relTime(event.started_at)}
            </T>
          </View>
          <LiveDot pulse={event.intent === "available_now"} />
        </View>

        <View
          style={{
            marginTop: 12,
            backgroundColor: light.spark + "1a",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            columnGap: 6,
          }}
        >
          <Ionicons name="cafe" size={13} color={light.spark} />
          <T variant="bodySm" color={light.coal}>
            {intentLabel}
            {circle ? ` · ${circle.name}` : ""}
          </T>
        </View>
      </Card>
    </Pressable>
  );
}
