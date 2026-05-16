import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { light, heatmapPulseMs } from "@bonfire/ui-tokens";

export interface HeatCell {
  x: number;
  y: number;
  weight: number;
}

export interface HeatmapPulseProps {
  width: number;
  height: number;
  cells: HeatCell[];
  radius?: number;
}

/**
 * Renders an ember-tinted heatmap using stacked Views. Each cell is a soft
 * radial bloom built from three concentric colored circles plus a Reanimated
 * opacity pulse on the heatmapPulseMs cycle. Skia produced a sharper falloff
 * but turned out to be flaky in Expo Go — this version matches the brand
 * temperature without the native dependency.
 */
export function HeatmapPulse({
  width,
  height,
  cells,
  radius = 90,
}: HeatmapPulseProps) {
  return (
    <View
      style={{ position: "absolute", width, height, overflow: "hidden" }}
      pointerEvents="none"
    >
      {cells.map((cell, i) => (
        <HeatCellView key={i} cell={cell} radius={radius} />
      ))}
    </View>
  );
}

function HeatCellView({ cell, radius }: { cell: HeatCell; radius: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: heatmapPulseMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(t);
  }, [t]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + t.value * 0.45,
    transform: [{ scale: 0.92 + t.value * 0.16 }],
  }));

  const r = radius;
  const baseOpacity = Math.min(1, 0.45 + cell.weight * 0.5);

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: cell.x - r,
          top: cell.y - r,
          width: r * 2,
          height: r * 2,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          backgroundColor: light.emberGlow,
          opacity: 0.22 * baseOpacity,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: r * 0.25,
          top: r * 0.25,
          width: r * 1.5,
          height: r * 1.5,
          borderRadius: r * 0.75,
          backgroundColor: light.ember,
          opacity: 0.16 * baseOpacity,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: r * 0.55,
          top: r * 0.55,
          width: r * 0.9,
          height: r * 0.9,
          borderRadius: r * 0.45,
          backgroundColor: light.ember,
          opacity: 0.22 * baseOpacity,
        }}
      />
    </Animated.View>
  );
}
