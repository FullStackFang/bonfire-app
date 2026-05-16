import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AvatarStack,
  BonfireScore,
  CTAButton,
  Card,
  T,
} from "../../components/ui";
import { light } from "@bonfire/ui-tokens";
import {
  findUserSync,
  findVenueSync,
  useGather,
  usePeople,
  useVisiblePresence,
} from "../../lib/data";
import { bonfireScoreForVenue } from "../../lib/bonfireScore";
import { relTime } from "../../lib/relTime";

export default function GatherDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const { gather, responses } = useGather(params.id ?? "");
  const { byId } = usePeople();
  const presence = useVisiblePresence();
  const [myResponse, setMyResponse] = useState<"in" | "maybe" | "out" | null>(null);

  const inResponses = responses.filter((r) => r.response === "in");
  const maybeResponses = responses.filter((r) => r.response === "maybe");

  const inUsers = inResponses
    .map((r) => byId.get(r.user_id))
    .filter(Boolean) as NonNullable<ReturnType<typeof byId.get>>[];

  const candidateScores = useMemo(() => {
    if (!gather) return new Map<string, number>();
    return new Map(
      gather.candidate_venue_ids.map((id) => [id, bonfireScoreForVenue(id, presence)]),
    );
  }, [gather, presence]);

  if (!gather) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
        <T variant="body" align="center" style={{ marginTop: 40 }} color={light.smoke}>
          Gather not found.
        </T>
      </SafeAreaView>
    );
  }

  const host = findUserSync(gather.host_id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }} edges={["top", "left", "right"]}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 4,
          flexDirection: "row",
          alignItems: "center",
          columnGap: 12,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={20} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={26} color={light.coal} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T variant="title">{gather.title}</T>
          <T variant="bodySm" color={light.smoke}>
            {gather.starts_at ? `${formatStart(gather.starts_at)} · forming now` : "Forming now"}
          </T>
        </View>
        <Pressable hitSlop={20} style={{ padding: 4 }}>
          <Ionicons name="ellipsis-horizontal" size={22} color={light.coal} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, rowGap: 12, paddingBottom: 140 }}>
        <Card padding={14}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <T variant="overline" color={light.smoke} style={{ letterSpacing: 1.1 }}>
              WHO&apos;S IN
            </T>
            <View
              style={{
                backgroundColor: light.spark + "22",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <T variant="bodySm" color={light.spark} style={{ fontFamily: "Onest_600SemiBold" }}>
                {inResponses.length} confirmed
              </T>
            </View>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 12,
              columnGap: 8,
            }}
          >
            <AvatarStack
              size="md"
              max={5}
              avatars={inUsers.map((u) => ({ label: u.letter_pair, color: u.avatar_color }))}
            />
            <T variant="bodySm" color={light.smoke}>
              + {maybeResponses.length} maybe
            </T>
          </View>
        </Card>

        <Card padding={14}>
          <T variant="overline" color={light.smoke} style={{ letterSpacing: 1.1, marginBottom: 10 }}>
            WHERE
          </T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", columnGap: 8 }}>
              {gather.candidate_venue_ids.map((vId) => {
                const v = findVenueSync(vId);
                if (!v) return null;
                const isPrimary = vId === gather.primary_venue_id;
                return (
                  <Pressable
                    key={vId}
                    onPress={() => router.push(`/venue/${vId}`)}
                    style={{
                      backgroundColor: isPrimary ? light.ember + "10" : light.cream,
                      borderRadius: 12,
                      padding: 12,
                      minWidth: 110,
                      borderWidth: isPrimary ? 1.5 : 0,
                      borderColor: isPrimary ? light.ember : "transparent",
                    }}
                  >
                    <T variant="body" style={{ fontFamily: "Onest_600SemiBold" }}>
                      {v.name}
                    </T>
                    <View style={{ flexDirection: "row", marginTop: 6, alignItems: "center", columnGap: 4 }}>
                      <T variant="bodySm" color={light.ember} style={{ fontFamily: "Onest_600SemiBold" }}>
                        {candidateScores.get(vId) ?? "—"}
                      </T>
                      <T variant="bodySm" color={light.smoke}>
                        · 0.3 mi
                      </T>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Card>

        {gather.reservation_provider ? (
          <Card padding={12}>
            <View style={{ flexDirection: "row", alignItems: "center", columnGap: 10 }}>
              <Ionicons name="calendar" size={20} color={light.spark} />
              <View style={{ flex: 1 }}>
                <T variant="body" style={{ fontFamily: "Onest_600SemiBold" }}>
                  Table for {gather.party_size_target ?? 6} · 8:00 PM
                </T>
                <T variant="bodySm" color={light.smoke}>
                  Available on {gather.reservation_provider === "opentable" ? "OpenTable" : "Resy"}
                </T>
              </View>
              <Pressable
                onPress={() => {}}
                style={{
                  backgroundColor: light.spark,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 999,
                }}
              >
                <T variant="bodySm" color={light.hearth} style={{ fontFamily: "Onest_600SemiBold" }}>
                  Book
                </T>
              </Pressable>
            </View>
          </Card>
        ) : null}

        <T variant="overline" color={light.smoke} style={{ letterSpacing: 1.1, marginTop: 8 }}>
          ACTIVITY
        </T>
        <Card padding={14}>
          <T variant="body">
            <T variant="body" style={{ fontFamily: "Onest_600SemiBold" }}>
              {host?.display_name.split(" ")[0] ?? "Someone"}
            </T>{" "}
            started a gather
          </T>
          <T variant="bodySm" color={light.smoke} style={{ marginTop: 2 }}>
            {relTime(gather.created_at)}
          </T>
        </Card>
      </ScrollView>

      <View style={{ position: "absolute", left: 16, right: 16, bottom: 32, rowGap: 8 }}>
        {myResponse === "in" ? (
          <>
            <CTAButton label="You're in" variant="outline" onPress={() => setMyResponse(null)} />
            <View style={{ flexDirection: "row", columnGap: 8 }}>
              <View style={{ flex: 1 }}>
                <CTAButton label="I might be" variant="ghost" onPress={() => setMyResponse("maybe")} />
              </View>
              <View style={{ flex: 1 }}>
                <CTAButton label="I'm out" variant="ghost" onPress={() => setMyResponse("out")} />
              </View>
            </View>
          </>
        ) : (
          <CTAButton label="I'm in" onPress={() => setMyResponse("in")} haptic="success" />
        )}
      </View>
    </SafeAreaView>
  );
}

function formatStart(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Tonight, ${time}`;
  if (isTomorrow) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short" })}, ${time}`;
}
