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

export interface LiveDotProps {
  color?: string;
  size?: number;
  pulse?: boolean;
  ringColor?: string;
}

export function LiveDot({
  color = light.spark,
  size = 8,
  pulse = false,
  ringColor = light.hearth,
}: LiveDotProps) {
  const ring = size + 4;
  const p = useSharedValue(0);
  useEffect(() => {
    if (!pulse) {
      cancelAnimation(p);
      p.value = 0;
      return;
    }
    p.value = withRepeat(
      withTiming(1, { duration: heatmapPulseMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(p);
  }, [pulse, p]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.18 + p.value * 0.32,
    transform: [{ scale: 1 + p.value * 0.8 }],
  }));

  return (
    <View
      style={{
        width: ring,
        height: ring,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {pulse ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              width: ring,
              height: ring,
              borderRadius: ring / 2,
              backgroundColor: color,
            },
            halo,
          ]}
        />
      ) : null}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: 1.5,
          borderColor: ringColor,
        }}
      />
    </View>
  );
}
