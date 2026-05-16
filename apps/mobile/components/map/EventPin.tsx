import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { heatmapPulseMs, light } from "@bonfire/ui-tokens";
import { T } from "../ui";
import type { MapEvent } from "../../lib/mockEventStore";

// Map pin for user-placed events. Pill with title + countdown, anchored at
// its bottom-center (a small notch under the pill marks the geo point).
// `live_now` events pulse with the same ember halo as loose presence pins.

export interface EventPinProps {
  event: MapEvent;
  onPress?: () => void;
}

const NOTCH_SIZE = 8;

export function EventPin({ event, onPress }: EventPinProps) {
  const remainingMs = Math.max(
    0,
    new Date(event.expires_at).getTime() - Date.now(),
  );
  const remainingLabel = formatRemaining(remainingMs);
  const isExpiringSoon = remainingMs < 5 * 60_000; // <5 min — warn color

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!event.live_now) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: heatmapPulseMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [event.live_now, pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + pulse.value * 0.34,
    transform: [{ scale: 0.9 + pulse.value * 0.25 }],
  }));

  return (
    <View style={{ alignItems: "center" }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Event: ${event.title}, ${remainingLabel} left`}
        style={{ alignItems: "center" }}
      >
        <View>
          {event.live_now ? (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  left: -14,
                  right: -14,
                  top: -10,
                  bottom: -10,
                  borderRadius: 24,
                  backgroundColor: light.ember,
                },
                haloStyle,
              ]}
            />
          ) : null}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: light.hearth,
              paddingLeft: 8,
              paddingRight: 4,
              paddingVertical: 4,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: event.live_now ? light.ember : light.ash,
              columnGap: 6,
              maxWidth: 200,
            }}
          >
            <Ionicons
              name="flame"
              size={13}
              color={event.live_now ? light.ember : light.smoke}
            />
            <T
              variant="bodySm"
              style={{
                fontFamily: "Onest_600SemiBold",
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {event.title}
            </T>
            <View
              style={{
                backgroundColor: isExpiringSoon ? light.ember : light.cream,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 8,
              }}
            >
              <T
                variant="overline"
                color={isExpiringSoon ? light.hearth : light.smoke}
                style={{
                  fontFamily: "GeistMono_400Regular",
                  letterSpacing: 0,
                }}
              >
                {remainingLabel}
              </T>
            </View>
          </View>
        </View>
        {/* Notch — small square rotated 45° pointing down. The bottom corner
            of the rotated square is the geo anchor. */}
        <View
          style={{
            width: NOTCH_SIZE,
            height: NOTCH_SIZE,
            backgroundColor: light.hearth,
            borderRightWidth: 1,
            borderBottomWidth: 1,
            borderColor: event.live_now ? light.ember : light.ash,
            transform: [{ rotate: "45deg" }],
            marginTop: -NOTCH_SIZE / 2,
          }}
        />
      </Pressable>
    </View>
  );
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "ended";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min >= 10) return `${min}m`;
  if (min >= 1) return `${min}:${sec.toString().padStart(2, "0")}`;
  return `${sec}s`;
}
