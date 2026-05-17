import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { heatmapPulseMs, light } from "@bonfire/ui-tokens";
import type { EventStatus } from "../../lib/mockEventStore";

// Translucent "gathering area" circle drawn beneath the event pin. Live
// events pulse on the heatmap cadence; upcoming events render flat. The
// component is purely presentational — diameter and anchor offset are
// computed by the caller from the live zoom + event latitude.

export interface EventRadiusProps {
  status: EventStatus;
  diameterPx: number;
}

export function EventRadius({ status, diameterPx }: EventRadiusProps) {
  const isLive = status === "live";
  const tint = isLive ? light.ember : light.dusk;

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!isLive) {
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
  }, [isLive, pulse]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: 0.10 + pulse.value * 0.10,
    transform: [{ scale: 0.94 + pulse.value * 0.08 }],
  }));

  return (
    <View
      pointerEvents="none"
      style={{
        width: diameterPx,
        height: diameterPx,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Outer ring stays put; inner fill breathes. Two layers so the edge
          reads as a steady boundary while the gathering area glows. */}
      <View
        style={{
          position: "absolute",
          width: diameterPx,
          height: diameterPx,
          borderRadius: diameterPx / 2,
          borderWidth: 1,
          borderColor: tint,
          opacity: 0.4,
        }}
      />
      <Animated.View
        style={[
          {
            position: "absolute",
            width: diameterPx,
            height: diameterPx,
            borderRadius: diameterPx / 2,
            backgroundColor: tint,
          },
          isLive ? fillStyle : { opacity: 0.10 },
        ]}
      />
    </View>
  );
}

// Web Mercator metres-per-pixel at the given zoom and latitude. The standard
// 156543.03 constant is the equatorial m/px at zoom 0; latitude scales it by
// cos(lat) because pixels narrow as you move toward the poles.
export function metersPerPixel(zoom: number, latitudeDeg: number): number {
  const lat = (latitudeDeg * Math.PI) / 180;
  return (156543.03392 * Math.cos(lat)) / Math.pow(2, zoom);
}
