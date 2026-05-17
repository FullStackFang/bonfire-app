import { Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  Avatar,
  CTAButton,
  Card,
  Chip,
  IconButton,
  T,
} from "../../../components/ui";
import { light } from "@bonfire/ui-tokens";
import {
  findUserSync,
  findVenueSync,
  useMyCircles,
  useVisiblePresence,
} from "../../../lib/data";
import { relTime } from "../../../lib/relTime";

export default function FriendProfile() {
  const params = useLocalSearchParams<{ id: string }>();
  const user = findUserSync(params.id ?? "");
  const presence = useVisiblePresence();
  const circles = useMyCircles();

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
        <T variant="body" align="center" color={light.smoke} style={{ marginTop: 40 }}>
          User not found.
        </T>
      </SafeAreaView>
    );
  }

  const mutualCircles = circles.filter((c) => c.member_ids.includes(user.id));
  const recent = presence.filter((p) => p.user_id === user.id).slice(0, 5);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        <IconButton
          icon="chevron-back"
          variant="ghost"
          size={40}
          iconSize={22}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={{ alignItems: "center", paddingTop: 8 }}>
          <Avatar label={user.letter_pair} color={user.avatar_color} size="hero" />
          <T variant="title" style={{ marginTop: 16 }}>
            {user.display_name}
          </T>
        </View>

        <T variant="overline" color={light.smoke} style={{ marginTop: 28, letterSpacing: 1.1 }}>
          MUTUAL CIRCLES
        </T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8, rowGap: 8, marginTop: 12 }}>
          {mutualCircles.length === 0 ? (
            <T variant="body" color={light.smoke}>
              No shared circles.
            </T>
          ) : (
            mutualCircles.map((c) => (
              <Chip key={c.id} label={c.name} variant="tinted" tint={c.accent_color} />
            ))
          )}
        </View>

        <T variant="overline" color={light.smoke} style={{ marginTop: 28, letterSpacing: 1.1 }}>
          RECENT LIVE
        </T>
        <View style={{ rowGap: 8, marginTop: 12 }}>
          {recent.length === 0 ? (
            <T variant="body" color={light.smoke}>
              Hasn&apos;t been out recently.
            </T>
          ) : (
            recent.map((p) => {
              const venue = findVenueSync(p.venue_id);
              return (
                <Card key={p.id} padding={12}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <T variant="body">
                      {venue ? `At ${venue.name}` : "Out and about"}
                    </T>
                    <T variant="bodySm" color={light.smoke}>
                      {relTime(p.started_at)}
                    </T>
                  </View>
                </Card>
              );
            })
          )}
        </View>

        <View style={{ marginTop: 32, rowGap: 12 }}>
          <CTAButton label="Add to circle" variant="outline" onPress={() => {}} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
