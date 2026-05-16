import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  Avatar,
  CTAButton,
  Card,
  Chip,
  T,
} from "../../../components/ui";
import { light } from "@bonfire/ui-tokens";
import { useMyCircles } from "../../../lib/data";
import { useSession } from "../../../lib/session";

const BADGES: { name: string; earned: boolean; icon: keyof typeof Ionicons.glyphMap; tint: string }[] = [
  { name: "Prometheus", earned: true, icon: "flame", tint: light.ember },
  { name: "Chef's hat", earned: false, icon: "restaurant", tint: light.dusk },
  { name: "Night owl", earned: false, icon: "moon", tint: light.night },
  { name: "Heat seeker", earned: true, icon: "pin", tint: light.ember },
];

export default function Profile() {
  const { user } = useSession();
  const circles = useMyCircles();

  if (!user) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={{ alignItems: "center", paddingTop: 16 }}>
          <Avatar
            label={user.letter_pair}
            color={user.avatar_color}
            size="hero"
          />
          <T variant="title" style={{ marginTop: 16 }}>
            {user.display_name}
          </T>
          <T variant="body" color={light.smoke} style={{ marginTop: 4 }}>
            Member since {new Date(user.created_at).toLocaleDateString([], { month: "short", year: "numeric" })}
          </T>
        </View>

        <T variant="overline" color={light.smoke} style={{ marginTop: 32, letterSpacing: 1.1 }}>
          BADGES
        </T>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            columnGap: 12,
            rowGap: 12,
            marginTop: 12,
          }}
        >
          {BADGES.map((b) => (
            <Card
              key={b.name}
              padding={12}
              style={{
                width: "47%",
                opacity: b.earned ? 1 : 0.4,
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: b.tint + "1f",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 8,
                }}
              >
                <Ionicons name={b.icon} size={24} color={b.tint} />
              </View>
              <T variant="bodySm" style={{ fontFamily: "Onest_600SemiBold" }} align="center">
                {b.name}
              </T>
            </Card>
          ))}
        </View>

        <T variant="overline" color={light.smoke} style={{ marginTop: 28, letterSpacing: 1.1 }}>
          YOUR CIRCLES
        </T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8, rowGap: 8, marginTop: 12 }}>
          {circles.map((c) => (
            <Chip
              key={c.id}
              label={`${c.name} · ${c.member_ids.length}`}
              variant="tinted"
              tint={c.accent_color}
              onPress={() => router.push(`/(app)/network/circle/${c.id}`)}
            />
          ))}
        </View>

        <View style={{ marginTop: 32, rowGap: 12 }}>
          <CTAButton
            label="Settings"
            variant="outline"
            onPress={() => router.push("/(app)/profile/settings")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
