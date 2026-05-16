import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AppHeader,
  Avatar,
  AvatarStack,
  Card,
  IconButton,
  LiveDot,
  T,
} from "../../components/ui";
import { light } from "@bonfire/ui-tokens";
import { useMyCircles, usePeople, useVisiblePresence } from "../../lib/data";
import type { CircleWithMembers, User } from "@bonfire/shared";

type Tab = "circles" | "friends" | "suggested";

export default function Network() {
  const [tab, setTab] = useState<Tab>("circles");
  const circles = useMyCircles();
  const { users, byId } = usePeople();
  const presence = useVisiblePresence();

  const liveByUser = useMemo(() => {
    const s = new Set<string>();
    for (const e of presence) if (!e.ended_at) s.add(e.user_id);
    return s;
  }, [presence]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }} edges={[]}>
      <AppHeader
        title="Your network"
        rightAction={
          <IconButton
            icon="person-add"
            iconColor={light.ember}
            onPress={() => router.push("/(app)/network/add")}
            accessibilityLabel="Add friend"
          />
        }
      />

      <View style={{ flexDirection: "row", paddingHorizontal: 20, marginTop: 16, columnGap: 24, borderBottomWidth: 0.5, borderBottomColor: light.ash }}>
        {(["circles", "friends", "suggested"] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <Pressable key={t} onPress={() => setTab(t)} style={{ paddingVertical: 10 }}>
              <T
                variant="bodyLg"
                color={active ? light.coal : light.smoke}
                style={{
                  fontFamily: active ? "Onest_600SemiBold" : "Onest_500Medium",
                  textTransform: "capitalize",
                }}
              >
                {t}
              </T>
              {active ? (
                <View
                  style={{
                    position: "absolute",
                    bottom: -1,
                    left: 0,
                    right: 0,
                    height: 2,
                    backgroundColor: light.ember,
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {tab === "circles" && (
          <View style={{ rowGap: 12 }}>
            {circles.map((c) => (
              <CircleCard key={c.id} circle={c} byId={byId} liveByUser={liveByUser} />
            ))}
            <Pressable
              onPress={() => router.push("/(app)/network/circle/new")}
            >
              <Card style={{ borderStyle: "dashed", borderColor: light.ash }}>
                <View style={{ flexDirection: "row", alignItems: "center", columnGap: 12 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: light.cream,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="add" size={20} color={light.ember} />
                  </View>
                  <T variant="bodyLg" color={light.smoke}>
                    Create a new circle
                  </T>
                </View>
              </Card>
            </Pressable>
          </View>
        )}

        {tab === "friends" && (
          <View style={{ rowGap: 8 }}>
            {users
              .filter((u) => u.id !== "u-self")
              .sort((a, b) => a.display_name.localeCompare(b.display_name))
              .map((u) => (
                <FriendRow key={u.id} user={u} live={liveByUser.has(u.id)} />
              ))}
          </View>
        )}

        {tab === "suggested" && (
          <View style={{ rowGap: 8 }}>
            <Card>
              <T variant="bodyLg">No suggestions right now.</T>
              <T variant="body" color={light.smoke} style={{ marginTop: 4 }}>
                We&apos;ll surface people once you add a few more contacts.
              </T>
            </Card>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CircleCard({
  circle,
  byId,
  liveByUser,
}: {
  circle: CircleWithMembers;
  byId: Map<string, User>;
  liveByUser: Set<string>;
}) {
  const members = circle.member_ids.map((id) => byId.get(id)).filter(Boolean) as User[];
  const liveCount = members.filter((m) => liveByUser.has(m.id)).length;

  return (
    <Pressable onPress={() => router.push(`/(app)/network/circle/${circle.id}`)}>
      <Card interactive padding={14}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <T variant="bodyLg" style={{ fontFamily: "Onest_600SemiBold" }}>
              {circle.name}
            </T>
            <T variant="bodySm" color={light.smoke} style={{ marginTop: 2 }}>
              {members.length} people
            </T>
          </View>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: circle.accent_color,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T
              variant="bodySm"
              color={light.hearth}
              style={{ fontFamily: "Onest_600SemiBold" }}
            >
              {circle.name.charAt(0)}
            </T>
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <AvatarStack
            size="sm"
            max={4}
            avatars={members.map((m) => ({
              label: m.letter_pair,
              color: m.avatar_color,
              live: liveByUser.has(m.id),
            }))}
          />
          {members.length > 4 ? (
            <T variant="bodySm" color={light.smoke} style={{ marginLeft: 8 }}>
              +{members.length - 4}
            </T>
          ) : null}
          <View style={{ flex: 1 }} />
          {liveCount > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", columnGap: 6 }}>
              <LiveDot pulse />
              <T variant="bodySm" color={light.spark} style={{ fontFamily: "Onest_600SemiBold" }}>
                {liveCount} live
              </T>
            </View>
          ) : (
            <T variant="bodySm" color={light.smoke}>
              no one out
            </T>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

function FriendRow({ user, live }: { user: User; live: boolean }) {
  return (
    <Pressable onPress={() => router.push(`/(app)/profile/${user.id}`)}>
      <Card padding={12}>
        <View style={{ flexDirection: "row", alignItems: "center", columnGap: 12 }}>
          <Avatar
            label={user.letter_pair}
            color={user.avatar_color}
            size="md"
            live={live}
          />
          <View style={{ flex: 1 }}>
            <T variant="bodyLg">{user.display_name}</T>
          </View>
          {live ? <LiveDot pulse /> : null}
        </View>
      </Card>
    </Pressable>
  );
}
