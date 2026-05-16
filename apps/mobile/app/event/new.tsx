import { useEffect, useMemo, useRef, useState } from "react";
import {
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { nanoid } from "nanoid/non-secure";
import { CTAButton, Card, IconButton, T } from "../../components/ui";
import { light } from "@bonfire/ui-tokens";
import { addMockEvent } from "../../lib/mockEventStore";
import { useSession } from "../../lib/session";

const DEFAULT_LIFETIME_MS = 60 * 60 * 1000; // 1 hour
const TITLE_ACCESSORY_ID = "event-title-accessory";
const ADDRESS_ACCESSORY_ID = "event-address-accessory";
const TITLE_MAX = 60;
const ADDRESS_MAX = 80;

const TITLE_PLACEHOLDERS = [
  "Beer in the park",
  "Pickup basketball",
  "Sunset hang",
  "Coffee, come say hi",
];

export default function EventNew() {
  const { user } = useSession();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();

  // Read coords once at mount — the search params can flicker during nav.
  const coords = useMemo(() => {
    const lat = Number(params.lat);
    const lng = Number(params.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [params.lat, params.lng]);

  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [liveNow, setLiveNow] = useState(true);

  // Defer focus until after the modal slide-in settles. Without this, the
  // keyboard slide-up animation overlaps the modal animation — two slides
  // from the bottom at the same time reads as visual noise. Native apps
  // (iMessage, Twitter compose) all wait for the sheet to land first.
  const titleRef = useRef<TextInput>(null);
  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 320);
    return () => clearTimeout(t);
  }, []);

  const placeholder = useMemo(
    () => TITLE_PLACEHOLDERS[Math.floor(Date.now() / 5000) % TITLE_PLACEHOLDERS.length],
    [],
  );

  const canCreate = title.trim().length > 0 && coords != null;

  const create = () => {
    if (!canCreate || !coords) return;
    const now = Date.now();
    addMockEvent({
      id: `e-${nanoid(8)}`,
      host_id: user?.id ?? "u-self",
      title: title.trim(),
      address: address.trim() || null,
      lat: coords.lat,
      lng: coords.lng,
      live_now: liveNow,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + DEFAULT_LIFETIME_MS).toISOString(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

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
          icon="close"
          variant="ghost"
          iconSize={26}
          onPress={() => router.back()}
          accessibilityLabel="Close"
        />
        <T variant="bodySm" color={light.smoke}>
          Drop a pin
        </T>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
      >
        <T variant="displayXl">What&apos;s happening here?</T>
        <T variant="body" color={light.smoke} style={{ marginTop: 8 }}>
          Lasts 1 hr. Friends nearby will see it.
        </T>

        <TextInput
          ref={titleRef}
          value={title}
          onChangeText={setTitle}
          placeholder={placeholder}
          placeholderTextColor={light.ash}
          maxLength={TITLE_MAX}
          returnKeyType="done"
          keyboardAppearance="light"
          autoCapitalize="sentences"
          autoCorrect
          enablesReturnKeyAutomatically
          inputAccessoryViewID={TITLE_ACCESSORY_ID}
          style={{
            marginTop: 28,
            fontFamily: "SourceSerif4_500Medium",
            fontSize: 26,
            color: light.coal,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: light.ash,
          }}
        />

        <T
          variant="overline"
          color={light.smoke}
          style={{ marginTop: 28, letterSpacing: 1.1 }}
        >
          ADDRESS (OPTIONAL)
        </T>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Park entrance, corner, room #..."
          placeholderTextColor={light.ash}
          maxLength={ADDRESS_MAX}
          returnKeyType="done"
          keyboardAppearance="light"
          autoCapitalize="words"
          autoCorrect={false}
          inputAccessoryViewID={ADDRESS_ACCESSORY_ID}
          style={{
            marginTop: 8,
            fontFamily: "Onest_400Regular",
            fontSize: 17,
            color: light.coal,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: light.ash,
          }}
        />

        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setLiveNow((v) => !v);
          }}
          style={{ marginTop: 24 }}
        >
          <Card
            padding={14}
            style={{
              borderColor: liveNow ? light.ember : light.ash,
              borderWidth: liveNow ? 2 : 1,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                columnGap: 12,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: liveNow ? light.ember : light.ash,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="flame"
                  size={18}
                  color={liveNow ? light.hearth : light.smoke}
                />
              </View>
              <View style={{ flex: 1 }}>
                <T variant="bodyLg" style={{ fontFamily: "Onest_600SemiBold" }}>
                  Live now
                </T>
                <T variant="bodySm" color={light.smoke} style={{ marginTop: 2 }}>
                  Pulses on the map so friends spot it fast.
                </T>
              </View>
              <Ionicons
                name={liveNow ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={liveNow ? light.ember : light.ash}
              />
            </View>
          </Card>
        </Pressable>

        {coords ? (
          <View
            style={{
              marginTop: 16,
              flexDirection: "row",
              alignItems: "center",
              columnGap: 6,
            }}
          >
            <Ionicons name="location" size={14} color={light.smoke} />
            <T variant="bodySm" color={light.smoke}>
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </T>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
        <CTAButton
          label="Drop event"
          disabled={!canCreate}
          haptic="success"
          onPress={create}
        />
      </View>
      </KeyboardAvoidingView>

      {Platform.OS === "ios" ? (
        <>
          <InputAccessoryView nativeID={TITLE_ACCESSORY_ID} backgroundColor={light.hearth}>
            <KeyboardBar count={title.length} max={TITLE_MAX} />
          </InputAccessoryView>
          <InputAccessoryView nativeID={ADDRESS_ACCESSORY_ID} backgroundColor={light.hearth}>
            <KeyboardBar count={address.length} max={ADDRESS_MAX} />
          </InputAccessoryView>
        </>
      ) : null}
    </SafeAreaView>
  );
}

// Toolbar that iOS docks above the keyboard. Hearth fill with an ash hairline
// up top so it reads as a clean extension of the form, not the keyboard. Count
// shifts to ember-deep in the last 10 chars as a quiet "running out" cue.
function KeyboardBar({ count, max }: { count: number; max: number }) {
  const nearLimit = count > max - 10;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 0.5,
        borderTopColor: light.ash,
        backgroundColor: light.hearth,
      }}
    >
      <T
        variant="bodySm"
        color={nearLimit ? light.emberDeep : light.smoke}
        style={{ fontFamily: "GeistMono_400Regular" }}
      >
        {count}/{max}
      </T>
      <Pressable hitSlop={12} onPress={() => Keyboard.dismiss()}>
        <T
          variant="bodySm"
          color={light.ember}
          style={{ fontFamily: "Onest_600SemiBold" }}
        >
          Done
        </T>
      </Pressable>
    </View>
  );
}
