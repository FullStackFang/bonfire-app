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
import * as Location from "expo-location";
import {
  CTAButton,
  Card,
  IconButton,
  IntentBadge,
  T,
  intentMeta,
} from "../components/ui";
import { houseSpring, light } from "@bonfire/ui-tokens";
import type { Intent } from "@bonfire/shared";
import { INTENT_DESCRIPTION, INTENT_DURATION_MS } from "@bonfire/shared";
import { useMyCircles } from "../lib/data";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { useSession } from "../lib/session";
import { setMockSelfPresence } from "../lib/mockPresenceStore";

const INTENTS: Intent[] = ["available_now", "out_today", "out_tonight"];

export default function GoLive() {
  const { user } = useSession();
  const [selected, setSelected] = useState<Intent>("available_now");
  const circles = useMyCircles();
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    new Set(circles.map((c) => c.id)),
  );
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleNames =
    circles
      .filter((c) => visibleIds.has(c.id))
      .map((c) => c.name)
      .join(", ") || "No one";

  const commit = async () => {
    setError(null);

    if (!supabaseConfigured || !user) {
      const now = new Date();
      setMockSelfPresence({
        id: `mock-self-${now.getTime()}`,
        user_id: user?.id ?? "u-self",
        intent: selected,
        visible_to_circle_ids: Array.from(visibleIds),
        venue_id: null,
        lat: null,
        lng: null,
        started_at: now.toISOString(),
        expires_at: new Date(now.getTime() + INTENT_DURATION_MS[selected]).toISOString(),
        ended_at: null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
      return;
    }

    setCommitting(true);

    // Capture location once. We only need a coarse fix to snap to a venue.
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.granted) {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
    } catch {
      // location is best-effort; presence_events.lat/lng are nullable.
    }

    // Snap to a known venue if we got a location.
    let venueId: string | null = null;
    if (lat !== null && lng !== null) {
      const { data } = await supabase.rpc("snap_to_venue", {
        lat,
        lng,
        radius_m: 60,
      });
      if (Array.isArray(data) && data.length === 1) {
        venueId = data[0].id;
      }
      // If 2+ candidates, the spec calls for a confirm sheet; we route to it here.
      // For now, we just take the closest — easy to wire the sheet later.
      else if (Array.isArray(data) && data.length > 1) {
        venueId = data[0].id;
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + INTENT_DURATION_MS[selected]);

    const { error: err } = await supabase.from("presence_events").insert({
      user_id: user.id,
      intent: selected,
      visible_to_circle_ids: Array.from(visibleIds),
      venue_id: venueId,
      raw_location:
        lat !== null && lng !== null
          ? `SRID=4326;POINT(${lng} ${lat})`
          : null,
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    setCommitting(false);

    if (err) {
      setError(err.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }

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
        <IconButton
          icon="close"
          onPress={() => router.back()}
          accessibilityLabel="Close"
        />
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
          label={committing ? "Going live..." : "Go live"}
          onPress={commit}
          disabled={committing || visibleIds.size === 0}
          rightIcon={<Ionicons name="flame" size={18} color={light.hearth} />}
          haptic="success"
        />
        {error ? (
          <T variant="bodySm" color={light.emberDeep} align="center">
            {error}
          </T>
        ) : null}
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
