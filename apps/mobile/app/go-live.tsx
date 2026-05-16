import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  CTAButton,
  Card,
  IntentBadge,
  T,
  intentMeta,
} from "../components/ui";
import { houseSpring, light } from "@bonfire/ui-tokens";
import type { Intent } from "@bonfire/shared";
import { INTENT_DESCRIPTION } from "@bonfire/shared";
import { useMyCircles } from "../lib/data";

const INTENTS: Intent[] = ["available_now", "out_today", "out_tonight"];

export default function GoLive() {
  const [selected, setSelected] = useState<Intent>("available_now");
  const circles = useMyCircles();
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    new Set(circles.map((c) => c.id)),
  );

  const visibleNames =
    circles
      .filter((c) => visibleIds.has(c.id))
      .map((c) => c.name)
      .join(", ") || "No one";

  const commit = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <T variant="displayLg">Go live</T>
        <Pressable
          onPress={() => router.back()}
          hitSlop={20}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: light.hearth,
            borderWidth: 1,
            borderColor: light.ash,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={20} color={light.coal} />
        </Pressable>
      </View>

      <T variant="body" color={light.smoke} style={{ paddingHorizontal: 20, marginTop: 8 }}>
        Broadcast availability to your circles. No event, no plan needed.
      </T>

      <ScrollView contentContainerStyle={{ padding: 20, rowGap: 12 }}>
        {INTENTS.map((i) => (
          <IntentCard
            key={i}
            intent={i}
            selected={selected === i}
            onSelect={() => {
              Haptics.selectionAsync().catch(() => {});
              setSelected(i);
            }}
          />
        ))}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 32,
          rowGap: 14,
          borderTopWidth: 0.5,
          borderTopColor: light.ash,
          paddingTop: 16,
        }}
      >
        <Pressable>
          <Card padding={12}>
            <View style={{ flexDirection: "row", alignItems: "center", columnGap: 12 }}>
              <Ionicons name="eye" size={18} color={light.smoke} />
              <View style={{ flex: 1 }}>
                <T variant="bodySm" color={light.smoke}>Visible to</T>
                <T variant="bodyLg" style={{ fontFamily: "Onest_600SemiBold" }} numberOfLines={1}>
                  {visibleNames}
                </T>
              </View>
              <Ionicons name="chevron-down" size={18} color={light.smoke} />
            </View>
          </Card>
        </Pressable>
        <CTAButton
          label="Go live"
          onPress={commit}
          rightIcon={<Ionicons name="flame" size={18} color={light.hearth} />}
          haptic="success"
        />
      </View>
    </SafeAreaView>
  );
}

function IntentCard({
  intent,
  selected,
  onSelect,
}: {
  intent: Intent;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = intentMeta[intent];
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animated}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.985, houseSpring); }}
        onPressOut={() => { scale.value = withSpring(1, houseSpring); }}
        onPress={onSelect}
        style={{
          backgroundColor: light.hearth,
          borderRadius: 18,
          padding: 18,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? meta.color : light.ash,
          opacity: selected ? 1 : 0.7,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", columnGap: 12 }}>
          <IntentBadge intent={intent} size="lg" showLabel={false} />
          <View style={{ flex: 1 }}>
            <T variant="bodyLg" style={{ fontFamily: "Onest_600SemiBold" }}>
              {meta.label}
            </T>
            <T variant="bodySm" color={light.smoke} style={{ marginTop: 2 }}>
              {INTENT_DESCRIPTION[intent]}
            </T>
          </View>
          {selected ? (
            <Ionicons name="checkmark-circle" size={22} color={meta.color} />
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
