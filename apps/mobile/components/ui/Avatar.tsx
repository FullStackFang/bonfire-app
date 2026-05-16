import { useEffect } from "react";
import { Text, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { light, heatmapPulseMs } from "@bonfire/ui-tokens";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "hero";

export interface AvatarProps {
  label: string;
  color: string;
  size?: AvatarSize;
  live?: boolean;
  name?: string;
  ringColor?: string;
  testID?: string;
}

const sizeMap: Record<AvatarSize, { box: number; font: number; ring: number }> = {
  xs: { box: 24, font: 9, ring: 1.5 },
  sm: { box: 32, font: 11, ring: 2 },
  md: { box: 40, font: 13, ring: 2 },
  lg: { box: 48, font: 16, ring: 2.5 },
  xl: { box: 64, font: 22, ring: 3 },
  hero: { box: 96, font: 34, ring: 4 },
};

export function Avatar({
  label,
  color,
  size = "md",
  live = false,
  name,
  ringColor = light.hearth,
  testID,
}: AvatarProps) {
  const { box, font, ring } = sizeMap[size];
  const text = label.slice(0, 2).toUpperCase();

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!live) {
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
  }, [live, pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.22 + pulse.value * 0.32,
    transform: [{ scale: 1.12 + pulse.value * 0.18 }],
  }));

  const accessibilityLabel = name ?? `${text} avatar`;

  const containerStyle: ViewStyle = {
    width: box,
    height: box,
    borderRadius: box / 2,
    backgroundColor: color,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: ring,
    borderColor: ringColor,
  };

  return (
    <View accessibilityLabel={accessibilityLabel}>
      {live ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: -box * 0.12,
              top: -box * 0.12,
              width: box * 1.24,
              height: box * 1.24,
              borderRadius: box * 0.62,
              backgroundColor: light.emberGlow,
            },
            haloStyle,
          ]}
        />
      ) : null}
      <View style={containerStyle} testID={testID}>
        <Text
          style={{
            color: light.hearth,
            fontFamily: "Onest_600SemiBold",
            fontSize: font,
            includeFontPadding: false,
          }}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}
