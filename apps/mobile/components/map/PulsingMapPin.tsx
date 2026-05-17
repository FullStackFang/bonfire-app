import { useEffect, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { heatmapPulseMs, light } from "@bonfire/ui-tokens";

// Ember halo around a map pin, breathing in sync with the heatmap (3.2s sine).
// Reduce Motion collapses it to a static half-phase glow.

export interface PulsingMapPinProps {
  pinSize: number;
  color?: string;
  scale?: number;
  // Stagger the breathing cadence so neighbouring pins don't strobe in unison.
  // Caller passes a deterministic offset (e.g. hash(id) % heatmapPulseMs).
  phaseOffsetMs?: number;
  children: React.ReactNode;
}

export function PulsingMapPin({
  pinSize,
  color = light.ember,
  scale = 2.2,
  phaseOffsetMs = 0,
  children,
}: PulsingMapPinProps) {
  const t = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) =>
      setReduceMotion(v),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(t);
      t.value = 0.5;
      return;
    }
    t.value = withDelay(
      phaseOffsetMs,
      withRepeat(
        withTiming(1, {
          duration: heatmapPulseMs,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, t, phaseOffsetMs]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + t.value * 0.22,
    transform: [{ scale: 0.85 + t.value * 0.4 }],
  }));

  const haloDiameter = pinSize * scale;
  const haloOffset = (haloDiameter - pinSize) / 2;

  return (
    <View style={{ width: pinSize, height: pinSize }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: -haloOffset,
            top: -haloOffset,
            width: haloDiameter,
            height: haloDiameter,
            borderRadius: haloDiameter / 2,
            backgroundColor: color,
          },
          haloStyle,
        ]}
      />
      {children}
    </View>
  );
}
