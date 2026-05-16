import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, CTAButton, Card, IconButton, T } from "../../../../components/ui";
import { light } from "@bonfire/ui-tokens";
import { findCircleSync, usePeople } from "../../../../lib/data";

const ACCENTS = [
  "#f05846", // ember
  "#5E7FE5",
  "#1A9E75",
  "#9D5BC2",
  "#E2843D",
  "#54b05a", // spark
];

export default function CircleDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const circle = findCircleSync(params.id ?? "");
  const { byId } = usePeople();
  const [name, setName] = useState(circle?.name ?? "");
  const [accent, setAccent] = useState(circle?.accent_color ?? ACCENTS[0]);

  if (!circle) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
        <T variant="body" align="center" style={{ marginTop: 40 }} color={light.smoke}>
          Circle not found.
        </T>
      </SafeAreaView>
    );
  }

  const members = circle.member_ids
    .map((id) => byId.get(id))
    .filter((u) => u && u.id !== "u-self") as NonNullable<ReturnType<typeof byId.get>>[];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <IconButton
          icon="chevron-back"
          variant="ghost"
          iconSize={28}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        />
        <T variant="bodySm" color={light.smoke}>
          {members.length} people
        </T>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <TextInput
          value={name}
          onChangeText={setName}
          style={{
            fontFamily: "SourceSerif4_500Medium",
            fontSize: 28,
            color: light.coal,
            paddingVertical: 8,
          }}
        />

        <T variant="overline" color={light.smoke} style={{ marginTop: 24, letterSpacing: 1.1 }}>
          ACCENT
        </T>
        <View style={{ flexDirection: "row", marginTop: 12, columnGap: 12 }}>
          {ACCENTS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setAccent(c)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: c,
                borderWidth: accent === c ? 3 : 0,
                borderColor: light.cream,
              }}
            />
          ))}
        </View>

        <T variant="overline" color={light.smoke} style={{ marginTop: 28, letterSpacing: 1.1 }}>
          MEMBERS
        </T>
        <View style={{ rowGap: 8, marginTop: 12 }}>
          {members.map((m) => (
            <Card key={m.id} padding={12}>
              <View style={{ flexDirection: "row", alignItems: "center", columnGap: 12 }}>
                <Avatar label={m.letter_pair} color={m.avatar_color} size="md" />
                <T variant="bodyLg" style={{ flex: 1 }}>
                  {m.display_name}
                </T>
                <Pressable hitSlop={12} onPress={() => {}}>
                  <Ionicons name="close-circle" size={22} color={light.smoke} />
                </Pressable>
              </View>
            </Card>
          ))}
        </View>

        <View style={{ marginTop: 28, rowGap: 12 }}>
          <CTAButton label="Invite by link" onPress={() => {}} variant="outline" />
          <CTAButton label="Leave circle" onPress={() => router.back()} variant="ghost" />
        </View>
      </ScrollView>

      <View style={{ position: "absolute", left: 20, right: 20, bottom: 32 }}>
        <CTAButton label="Save changes" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}
