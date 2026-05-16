import { useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import {
  Card,
  ChunkyPressable,
  IconButton,
  IntentBadge,
  T,
  intentMeta,
} from "../components/ui";
import { light } from "@bonfire/ui-tokens";
import type { Intent } from "@bonfire/shared";
import { INTENT_DESCRIPTION, INTENT_DURATION_MS } from "@bonfire/shared";
import { useMyCircles, useVisiblePresence } from "../lib/data";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { useSession } from "../lib/session";
import { setMockSelfPresence } from "../lib/mockPresenceStore";

const ALL_INTENTS: Intent[] = ["available_now", "out_today", "out_tonight"];

const INTENT_CARD_CFG: Record<Intent, { activeBg: string; activeShadow: string }> = {
  available_now: { activeBg: light.ember,  activeShadow: light.emberDeep },
  out_today:     { activeBg: light.dusk,   activeShadow: "#8b5520" },
  out_tonight:   { activeBg: light.night,  activeShadow: "#080f19" },
};

export default function GoLive() {
  const { user } = useSession();
  const presence = useVisiblePresence();
  const circles = useMyCircles();
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    new Set(circles.map((c) => c.id)),
  );
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myIntent = useMemo<Intent | null>(() => {
    if (!user) return null;
    const now = Date.now();
    const active = presence.find(
      (p) =>
        p.user_id === user.id &&
        p.ended_at == null &&
        new Date(p.expires_at).getTime() > now,
    );
    return (active?.intent as Intent) ?? null;
  }, [presence, user]);

  const visibleNames =
    circles
      .filter((c) => visibleIds.has(c.id))
      .map((c) => c.name)
      .join(", ") || "No one";

  // All intents toggle in-place — screen stays open.
  const toggleIntent = async (intent: Intent) => {
    setError(null);
    if (myIntent === intent) {
      if (!supabaseConfigured || !user) {
        setMockSelfPresence(null);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return;
    }
    if (!supabaseConfigured || !user) {
      const now = new Date();
      setMockSelfPresence({
        id: `mock-self-${now.getTime()}`,
        user_id: user?.id ?? "u-self",
        intent,
        visible_to_circle_ids: Array.from(visibleIds),
        venue_id: null,
        lat: null,
        lng: null,
        started_at: now.toISOString(),
        expires_at: new Date(now.getTime() + INTENT_DURATION_MS[intent]).toISOString(),
        ended_at: null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return;
    }
    setCommitting(true);
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
      // location is best-effort
    }
    let venueId: string | null = null;
    if (lat !== null && lng !== null) {
      const { data } = await supabase.rpc("snap_to_venue", { lat, lng, radius_m: 60 });
      if (Array.isArray(data) && data.length >= 1) venueId = data[0].id;
    }
    const now = new Date();
    const { error: err } = await supabase.from("presence_events").insert({
      user_id: user.id,
      intent,
      visible_to_circle_ids: Array.from(visibleIds),
      venue_id: venueId,
      raw_location:
        lat !== null && lng !== null ? `SRID=4326;POINT(${lng} ${lat})` : null,
      started_at: now.toISOString(),
      expires_at: new Date(now.getTime() + INTENT_DURATION_MS[intent]).toISOString(),
    });
    setCommitting(false);
    if (err) {
      setError(err.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
        {ALL_INTENTS.map((i) => (
          <IntentCard
            key={i}
            intent={i}
            active={myIntent === i}
            disabled={committing}
            onToggle={() => toggleIntent(i)}
          />
        ))}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 32,
          borderTopWidth: 0.5,
          borderTopColor: light.ash,
          paddingTop: 16,
          rowGap: 12,
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
  active,
  disabled = false,
  onToggle,
}: {
  intent: Intent;
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const meta = intentMeta[intent];
  const { activeBg, activeShadow } = INTENT_CARD_CFG[intent];

  return (
    <ChunkyPressable
      onPress={onToggle}
      disabled={disabled}
      shadowColor={active ? activeShadow : light.warmShadow}
      depth={5}
      radius={18}
      haptic={Haptics.ImpactFeedbackStyle.Medium}
      accessibilityLabel={meta.label}
    >
      <View
        style={{
          backgroundColor: active ? activeBg : light.hearth,
          borderRadius: 18,
          padding: 18,
          borderWidth: active ? 2 : 1,
          borderColor: active ? activeShadow : light.ash,
          flexDirection: "row",
          alignItems: "center",
          columnGap: 12,
          opacity: !active && !disabled ? 0.7 : 1,
        }}
      >
        <IntentBadge intent={intent} size="lg" showLabel={false} />
        <View style={{ flex: 1 }}>
          <T
            variant="bodyLg"
            style={{
              fontFamily: "Onest_600SemiBold",
              color: active ? light.hearth : light.coal,
            }}
          >
            {meta.label}
          </T>
          <T
            variant="bodySm"
            style={{
              color: active ? "rgba(255,255,255,0.7)" : light.smoke,
              marginTop: 2,
            }}
          >
            {INTENT_DESCRIPTION[intent]}
          </T>
        </View>
        {/* Switch is decorative — ChunkyPressable handles all touches */}
        <View pointerEvents="none">
          <Switch
            value={active}
            trackColor={{ false: light.ash, true: "rgba(255,255,255,0.35)" }}
            thumbColor={light.hearth}
            ios_backgroundColor={light.ash}
          />
        </View>
      </View>
    </ChunkyPressable>
  );
}
