import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AppHeader,
  Avatar,
  CTAButton,
  Card,
  Chip,
  EmptyState,
  T,
} from "../../components/ui";
import { light } from "@bonfire/ui-tokens";
import { findUserSync, useInbox } from "../../lib/data";
import { relTime } from "../../lib/relTime";
import type { InboxItem } from "@bonfire/shared";

type Filter = "all" | "gathers" | "live";

export default function Inbox() {
  const items = useInbox();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "gathers") return items.filter((i) => i.kind === "gather_invite");
    if (filter === "live") return items.filter((i) => i.kind === "friend_live" || i.kind === "friend_arrived" || i.kind === "heatmap_hot");
    return items;
  }, [items, filter]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }} edges={["top"]}>
      <AppHeader
        title="Inbox"
        rightAction={
          <Pressable
            onPress={() => {}}
            hitSlop={8}
            accessibilityLabel="Mark all read"
            accessibilityRole="button"
            style={{ paddingHorizontal: 8, paddingVertical: 8 }}
          >
            <T variant="bodySm" color={light.ember} style={{ fontFamily: "Onest_600SemiBold" }}>
              Mark all read
            </T>
          </Pressable>
        }
      />

      <View style={{ flexDirection: "row", paddingHorizontal: 20, marginTop: 12, columnGap: 8 }}>
        <Chip label="All" variant={filter === "all" ? "solid" : "outline"} onPress={() => setFilter("all")} />
        <Chip label="Gathers" variant={filter === "gathers" ? "solid" : "outline"} onPress={() => setFilter("gathers")} />
        <Chip label="Live" variant={filter === "live" ? "solid" : "outline"} onPress={() => setFilter("live")} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, rowGap: 10, paddingBottom: 40 }}>
        {filtered.length === 0 ? (
          <EmptyState
            nextGesture="passive-wait"
            headline="Nothing yet."
            body="When friends go out, this is where you'll hear about it."
          />
        ) : (
          grouped.map((g) => (
            <View key={g.label}>
              <T variant="overline" color={light.smoke} style={{ letterSpacing: 1.1, marginBottom: 8, marginTop: 8 }}>
                {g.label}
              </T>
              <View style={{ rowGap: 8 }}>
                {g.items.map((it) => (
                  <InboxRow key={it.id} item={it} />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  const unread = !item.read_at;
  const handlePress = () => {
    if (item.kind === "gather_invite") router.push(`/gather/${item.payload.gather_id}`);
    else if (item.kind === "friend_arrived" || item.kind === "friend_live") {
      const venueId = item.payload.venue_id as string | undefined;
      if (venueId) router.push(`/venue/${venueId}`);
    } else if (item.kind === "heatmap_hot") router.push("/(app)");
    else router.push("/(app)/profile");
  };

  return (
    <Pressable onPress={handlePress}>
      <Card padding={12}>
        <View style={{ flexDirection: "row", columnGap: 12 }}>
          <RowIcon item={item} />
          <View style={{ flex: 1 }}>
            <RowBody item={item} />
            <T variant="bodySm" color={light.smoke} style={{ marginTop: 2 }}>
              {relTime(item.created_at)}
              {item.kind === "gather_invite" && item.payload.in_count
                ? ` · ${item.payload.in_count} in`
                : null}
              {item.kind === "heatmap_hot" && item.payload.nearby_count
                ? ` · ${item.payload.nearby_count} friends nearby`
                : null}
            </T>
            {item.kind === "gather_invite" ? (
              <View style={{ marginTop: 8 }}>
                <Chip
                  label="I'm in"
                  variant="solid"
                  size="sm"
                  onPress={() => router.push(`/gather/${item.payload.gather_id}`)}
                />
              </View>
            ) : null}
          </View>
          {unread ? (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: light.ember,
                marginTop: 6,
              }}
            />
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

function RowIcon({ item }: { item: InboxItem }) {
  if (item.kind === "friend_live" || item.kind === "friend_arrived") {
    const u = findUserSync(item.payload.user_id as string);
    if (u) return <Avatar label={u.letter_pair} color={u.avatar_color} size="md" />;
  }
  const colorMap: Record<string, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
    gather_invite: { bg: light.ember + "1f", fg: light.ember, icon: "flame" },
    heatmap_hot:   { bg: light.ember + "1f", fg: light.ember, icon: "pin" },
    milestone:     { bg: light.dusk + "1f",  fg: light.dusk,  icon: "trophy" },
    friend_live:   { bg: light.spark + "1f", fg: light.spark, icon: "radio" },
    friend_arrived:{ bg: light.spark + "1f", fg: light.spark, icon: "location" },
  };
  const c = colorMap[item.kind];
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: c.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={c.icon} size={18} color={c.fg} />
    </View>
  );
}

function RowBody({ item }: { item: InboxItem }) {
  switch (item.kind) {
    case "gather_invite":
      return (
        <T variant="body">
          <T variant="body" style={{ fontFamily: "Onest_600SemiBold" }}>
            {item.payload.host_name as string}
          </T>{" "}
          started a gather:{" "}
          <T variant="body">{item.payload.title as string}</T>
        </T>
      );
    case "friend_live":
      return (
        <T variant="body">
          <T variant="body" style={{ fontFamily: "Onest_600SemiBold" }}>
            {item.payload.user_name as string}
          </T>{" "}
          went live at {item.payload.venue_name as string}
        </T>
      );
    case "friend_arrived":
      return (
        <T variant="body">
          <T variant="body" style={{ fontFamily: "Onest_600SemiBold" }}>
            {item.payload.user_name as string}
          </T>{" "}
          arrived at {item.payload.venue_name as string}
        </T>
      );
    case "heatmap_hot":
      return (
        <T variant="body">
          Heatmap turned hot near you:{" "}
          <T variant="body" style={{ fontFamily: "Onest_600SemiBold" }}>
            {item.payload.neighborhood as string}
          </T>
        </T>
      );
    case "milestone":
      return (
        <T variant="body">
          You earned the{" "}
          <T variant="body" style={{ fontFamily: "Onest_600SemiBold" }}>
            {item.payload.name as string}
          </T>{" "}
          avatar
        </T>
      );
  }
}

function groupByDay(items: InboxItem[]): { label: string; items: InboxItem[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;

  const groups: Record<string, InboxItem[]> = { TODAY: [], YESTERDAY: [], EARLIER: [] };
  for (const it of items) {
    const t = new Date(it.created_at).getTime();
    if (t >= today) groups.TODAY.push(it);
    else if (t >= yesterday) groups.YESTERDAY.push(it);
    else groups.EARLIER.push(it);
  }

  const out: { label: string; items: InboxItem[] }[] = [];
  for (const label of ["TODAY", "YESTERDAY", "EARLIER"]) {
    if (groups[label].length > 0) out.push({ label, items: groups[label] });
  }
  return out;
}
