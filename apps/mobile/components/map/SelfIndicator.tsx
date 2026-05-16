import { useEffect, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { heatmapPulseMs, light } from "@bonfire/ui-tokens";

// "You are here" marker. Ember dot in a white ring with three nested,
// independently flickering flame layers rising from the dot.
//
// Outer envelope (emberDeep) is the calmest — small rotation, slow phase.
// Middle (ember) is moderate. Inner core (emberGlow) is the most agitated,
// with extra opacity flicker on top of geometry chaos. This mirrors real
// fire footage: the bright tongues dance, the outer shape stays composed.
//
// Each layer is built from sum-of-sines at non-integer frequency ratios
// (1.0 / 2.7 / 5.3 etc.) so motion is chaotic and never repeats. Each layer
// uses its own linear phase ticker at a different period — no two layers
// ever align. transformOrigin is "50% 100%" on each so every flicker
// emanates from the dot, not from inside the flame.

export const SELF_INDICATOR_SIZE = 16;

const GLOW_W = 38;
const GLOW_H = 50;
const FLAME_W = 26;
const FLAME_H = 36;

const CENTER = SELF_INDICATOR_SIZE / 2;

// Single shared silhouette — each layer scales it via transform.
// Bottom-heavy oval: widest at y=22, stays ~23px wide at y=28 (dot top edge)
// so all three nested layers visually surround the dot. Bottom tip at y=36
// stays pinned to the dot centre so transformOrigin "50% 100%" works correctly.
const FLAME_PATH =
  "M 13 2 C 18 2, 25 10, 25 22 C 25 30, 20 36, 13 36 C 6 36, 1 30, 1 22 C 1 10, 8 2, 13 2 Z";

const TAU = Math.PI * 2;

export function SelfIndicator({ zoom = 15 }: { zoom?: number }) {
  // Scale linearly with zoom so the indicator shrinks as you zoom out.
  // zoom=15 → scale=1.0 (reference), zoom=6 → 0.2 (min), zoom=24 → 1.4 (max).
  const scale = Math.max(0.2, Math.min(1.4, (zoom - 6) / 9));
  const pOuter = useSharedValue(0);
  const pMid = useSharedValue(0);
  const pInner = useSharedValue(0);
  const tGlow = useSharedValue(0);
  // 1 = animate, 0 = static. Multiplied into every amplitude so Reduce
  // Motion produces an exactly-static flame.
  const motion = useSharedValue(1);
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
      cancelAnimation(tGlow);
      cancelAnimation(pOuter);
      cancelAnimation(pMid);
      cancelAnimation(pInner);
      motion.value = 0;
      tGlow.value = 0.5;
      pOuter.value = 0;
      pMid.value = 0;
      pInner.value = 0;
      return;
    }
    motion.value = 1;
    tGlow.value = withRepeat(
      withTiming(1, { duration: heatmapPulseMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    // Different period per layer so the chaos signatures decorrelate
    // immediately. The visible flicker comes from the frequencies inside
    // each layer's sum-of-sines, not this outer period.
    pOuter.value = withRepeat(
      withTiming(1, { duration: 4100, easing: Easing.linear }),
      -1,
      false,
    );
    pMid.value = withRepeat(
      withTiming(1, { duration: 2900, easing: Easing.linear }),
      -1,
      false,
    );
    pInner.value = withRepeat(
      withTiming(1, { duration: 1700, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(tGlow);
      cancelAnimation(pOuter);
      cancelAnimation(pMid);
      cancelAnimation(pInner);
    };
  }, [reduceMotion, tGlow, pOuter, pMid, pInner, motion]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tGlow.value, [0, 1], [0.14, 0.30]),
    transform: [{ scale: interpolate(tGlow.value, [0, 1], [0.86, 1.04]) }],
  }));

  // Outer envelope: largest, darkest, calmest. ±5° sway, ±6% scale.
  const outerStyle = useAnimatedStyle(() => {
    const p = pOuter.value * TAU;
    const m = motion.value;
    const rot =
      m *
      (Math.sin(p * 1.0) * 2.4 +
        Math.sin(p * 2.7 + 1.3) * 1.7 +
        Math.sin(p * 5.3 + 0.4) * 1.0);
    const sx =
      1 +
      m *
        (Math.sin(p * 1.1 + 0.8) * 0.035 +
          Math.sin(p * 3.3 + 2.1) * 0.022);
    const sy =
      1 +
      m *
        (Math.sin(p * 1.3 + 2.4) * 0.035 +
          Math.sin(p * 3.7 + 0.9) * 0.022);
    return {
      transform: [
        { rotateZ: `${rot}deg` },
        { scaleX: sx },
        { scaleY: sy },
      ],
    };
  });

  // Middle: moderate everything. ±8° sway, ±9% scale, mild opacity flicker.
  const midStyle = useAnimatedStyle(() => {
    const p = pMid.value * TAU;
    const m = motion.value;
    const rot =
      m *
      (Math.sin(p * 1.0 + 0.6) * 3.6 +
        Math.sin(p * 2.7 + 0.2) * 2.6 +
        Math.sin(p * 5.3 + 1.8) * 1.6);
    const sx =
      0.72 *
      (1 +
        m *
          (Math.sin(p * 1.1) * 0.05 +
            Math.sin(p * 3.3 + 1.4) * 0.03 +
            Math.sin(p * 6.1 + 0.7) * 0.02));
    const sy =
      0.78 *
      (1 +
        m *
          (Math.sin(p * 1.3 + 1.7) * 0.06 +
            Math.sin(p * 3.7 + 0.3) * 0.035));
    const opacity =
      0.92 + m * (Math.sin(p * 2.0 + 1.1) * 0.06 + Math.sin(p * 4.7 + 0.5) * 0.03);
    return {
      opacity,
      transform: [
        { rotateZ: `${rot}deg` },
        { scaleX: sx },
        { scaleY: sy },
      ],
    };
  });

  // Inner core: smallest, brightest, most agitated. ±12° sway, ±14% scale,
  // strong opacity flicker (0.55 → 1.0).
  const innerStyle = useAnimatedStyle(() => {
    const p = pInner.value * TAU;
    const m = motion.value;
    const rot =
      m *
      (Math.sin(p * 1.0 + 1.2) * 5 +
        Math.sin(p * 2.7 + 0.7) * 4 +
        Math.sin(p * 5.3 + 2.3) * 2.6);
    const sx =
      0.44 *
      (1 +
        m *
          (Math.sin(p * 1.1 + 1.9) * 0.08 +
            Math.sin(p * 3.3 + 0.4) * 0.05 +
            Math.sin(p * 7.1 + 1.3) * 0.04));
    const sy =
      0.52 *
      (1 +
        m *
          (Math.sin(p * 1.3 + 0.5) * 0.10 +
            Math.sin(p * 3.7 + 1.9) * 0.06 +
            Math.sin(p * 6.1 + 0.2) * 0.04));
    const opacity =
      0.78 + m * (Math.sin(p * 2.0) * 0.18 + Math.sin(p * 5.3 + 0.9) * 0.08);
    return {
      opacity,
      transform: [
        { rotateZ: `${rot}deg` },
        { scaleX: sx },
        { scaleY: sy },
      ],
    };
  });

  // Each flame layer is the same SVG path; the wrapper Animated.View's
  // transform scales/rotates it from the dot's center. Solid fills (not
  // gradients) — the layering itself produces the depth, and matching the
  // Turrell-style "dark envelope → bright core" reference.
  const flameWrapperBase = {
    position: "absolute" as const,
    left: CENTER - FLAME_W / 2,
    // Bottom edge of the flame box (y = FLAME_H) lands at the dot's center,
    // so transformOrigin "50% 100%" pivots every layer from the dot itself.
    top: CENTER - FLAME_H,
    width: FLAME_W,
    height: FLAME_H,
    transformOrigin: "50% 100%" as const,
  };

  return (
    <View style={{ width: SELF_INDICATOR_SIZE, height: SELF_INDICATOR_SIZE, transform: [{ scale }] }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: CENTER - GLOW_W / 2,
            top: CENTER - GLOW_H + 10,
            width: GLOW_W,
            height: GLOW_H,
            borderRadius: GLOW_W / 2,
            backgroundColor: light.emberGlow,
          },
          glowStyle,
        ]}
      />

      <Animated.View pointerEvents="none" style={[flameWrapperBase, outerStyle]}>
        <Svg width={FLAME_W} height={FLAME_H} viewBox="0 0 26 36">
          <Path d={FLAME_PATH} fill={light.emberDeep} fillOpacity={0.85} />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[flameWrapperBase, midStyle]}>
        <Svg width={FLAME_W} height={FLAME_H} viewBox="0 0 26 36">
          <Path d={FLAME_PATH} fill={light.ember} />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[flameWrapperBase, innerStyle]}>
        <Svg width={FLAME_W} height={FLAME_H} viewBox="0 0 26 36">
          <Path d={FLAME_PATH} fill={light.emberGlow} />
        </Svg>
      </Animated.View>

      <View
        style={{
          width: SELF_INDICATOR_SIZE,
          height: SELF_INDICATOR_SIZE,
          borderRadius: SELF_INDICATOR_SIZE / 2,
          backgroundColor: light.hearth,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: light.ember,
          }}
        />
      </View>
    </View>
  );
}
