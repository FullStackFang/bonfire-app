// Home = The Fire. (spec §Screens 1)
// The flame owns the front door; the anchor card is the heartbeat beneath it.
// Plain-but-correct fire visual — the Rive state machine replaces the disc in
// week 7; the states and copy here are the contract it must honor.

import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { light, heatmapPulseMs } from "@bonfire/ui-tokens";
import { T, Card, CTAButton, AvatarStack, Chip, LiveDot } from "../../components/ui";
import {
  group,
  anchor,
  pulses,
  memberById,
  type FireState,
} from "../../lib/mockV2";

const fireMeta: Record<FireState, { headline: string; disc: number; glow: number }> = {
  roaring: { headline: "The fire is roaring.", disc: 120, glow: 1.5 },
  burning: { headline: "The fire is burning.", disc: 100, glow: 1.35 },
  dimming: { headline: "The fire is dimming.", disc: 80, glow: 1.2 },
  embers: { headline: "Only embers remain.", disc: 56, glow: 1.12 },
  out: { headline: "The fire is out.", disc: 40, glow: 1 },
};

function FireDisc({ state }: { state: FireState }) {
  const { disc, glow } = fireMeta[state];
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: heatmapPulseMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breath]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.18 + breath.value * 0.26,
    transform: [{ scale: glow + breath.value * 0.12 }],
  }));

  const dead = state === "out";
  return (
    <View style={{ alignItems: "center", justifyContent: "center", height: 180 }}>
      {!dead && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              width: disc,
              height: disc,
              borderRadius: disc / 2,
              backgroundColor: light.emberGlow,
            },
            halo,
          ]}
        />
      )}
      <View
        style={{
          width: disc,
          height: disc,
          borderRadius: disc / 2,
          backgroundColor: dead ? light.ash : light.ember,
        }}
      />
    </View>
  );
}

export default function FireHome() {
  const insets = useSafeAreaInsets();
  const [rsvp, setRsvp] = useState<"in" | "out" | null>(null);
  const [coming, setComing] = useState(false);

  const torch = memberById(anchor.torchHolderId);
  const inMembers = useMemo(() => anchor.inIds.map(memberById), []);
  const inCount = anchor.inIds.length + (rsvp === "in" ? 1 : 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: light.cream }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: 32,
        paddingHorizontal: 20,
      }}
    >
      {/* The fire */}
      <T variant="overline" color={light.smoke} align="center" style={{ letterSpacing: 1.1, textTransform: "uppercase" }}>
        {group.name}
      </T>
      <FireDisc state={group.fireState} />
      <T variant="displayXl" align="center">
        {fireMeta[group.fireState].headline}
      </T>
      <T variant="body" color={light.smoke} align="center" style={{ marginTop: 6 }}>
        {group.recap}
      </T>

      {/* The anchor */}
      <View style={{ marginTop: 28 }}>
        <Card padding={20}>
          <T variant="overline" color={light.smoke} style={{ letterSpacing: 1.1, textTransform: "uppercase" }}>
            The anchor · {anchor.dayLabel} {anchor.timeLabel}
          </T>
          <T variant="title" style={{ marginTop: 8 }}>
            {anchor.venueName}
          </T>
          <T variant="body" color={light.smoke} style={{ marginTop: 4 }}>
            {torch.name} holds the torch — “{anchor.note}”
          </T>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16 }}>
            <AvatarStack
              avatars={inMembers.map((p) => ({ label: p.name, color: p.color, name: p.name }))}
              max={5}
              size="sm"
            />
            <T variant="bodySm" color={light.smoke} style={{ marginLeft: 10 }}>
              {inCount} in
            </T>
          </View>

          <View style={{ flexDirection: "row", columnGap: 12, marginTop: 18 }}>
            <View style={{ flex: 1 }}>
              <CTAButton
                label={rsvp === "in" ? "You’re in" : "In"}
                variant={rsvp === "in" ? "primary" : "outline"}
                haptic={Haptics.ImpactFeedbackStyle.Medium}
                onPress={() => setRsvp("in")}
              />
            </View>
            <View style={{ flex: 1 }}>
              <CTAButton
                label="Out"
                variant={rsvp === "out" ? "primary" : "outline"}
                onPress={() => setRsvp("out")}
              />
            </View>
          </View>
        </Card>
      </View>

      {/* Pulses */}
      <View style={{ marginTop: 28 }}>
        <T variant="overline" color={light.smoke} style={{ letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 10 }}>
          Happening now
        </T>
        {pulses.map((pulse) => {
          const who = memberById(pulse.memberId);
          const comingCount = pulse.comingIds.length + (coming ? 1 : 0);
          return (
            <Card key={pulse.id} padding={16}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <LiveDot pulse />
                <T variant="bodyLg" style={{ marginLeft: 8, flex: 1 }}>
                  {who.name} is at {pulse.venueName}
                </T>
                <T variant="monoSm" color={light.smoke}>
                  {pulse.minutesLeft} min left
                </T>
              </View>
              <T variant="body" color={light.smoke} style={{ marginTop: 6 }}>
                “{pulse.note}”
              </T>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12, columnGap: 10 }}>
                <Chip
                  label={coming ? "You’re coming" : "I’m coming"}
                  variant={coming ? "solid" : "outline"}
                  onPress={() => setComing(true)}
                />
                <T variant="bodySm" color={light.smoke}>
                  {comingCount} coming
                </T>
              </View>
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}
