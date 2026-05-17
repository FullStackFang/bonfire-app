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
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { flameAccentFor, heatmapPulseMs, light } from "@bonfire/ui-tokens";

// Friend pin on the map. Same Turrell-style three-layer flame as
// SelfIndicator (outer emberDeep → mid ember → inner identity-tint), same
// sum-of-sines flicker, but no base dot — the geo anchor lives at the
// bottom-center of the flame itself. A two-letter monogram sits inside the
// flame body, static, so it stays readable while the flames lick around it.
//
// Differentiator from self: self has a white-ringed ember dot at its base;
// friends have nothing — they are the flame.

export const FRIEND_FLAME_W = 26;
export const FRIEND_FLAME_H = 36;
// Glow ellipse extends a touch below the flame's bottom edge.
export const FRIEND_FLAME_PAD = 6;

const TAU = Math.PI * 2;

// Same silhouette as SelfIndicator (FLAME_PATH). Sharing the path keeps the
// visual language identical — only the base and the inner-fill color change.
const FLAME_PATH =
  "M 13 2 C 18 2, 25 10, 25 22 C 25 30, 20 36, 13 36 C 6 36, 1 30, 1 22 C 1 10, 8 2, 13 2 Z";

export interface FriendFlamePinProps {
  // Two-letter monogram drawn inside the flame body.
  label: string;
  // Seed for the warm identity tint of the inner flame.
  seed: string;
  // Stagger the flicker cadence so neighbouring pins don't pulse in lockstep.
  // Caller passes a deterministic offset (e.g. hash(id) % heatmapPulseMs).
  phaseOffsetMs?: number;
  // Multiplier on the whole pin. 1.0 = single loose pin; ~0.7 = venue clusters.
  scale?: number;
}

export function FriendFlamePin({
  label,
  seed,
  phaseOffsetMs = 0,
  scale = 1,
}: FriendFlamePinProps) {
  const tint = flameAccentFor(seed);
  const text = label.slice(0, 2).toUpperCase();

  const pOuter = useSharedValue(0);
  const pMid = useSharedValue(0);
  const pInner = useSharedValue(0);
  const tGlow = useSharedValue(0);
  // Multiplied into every amplitude so Reduce Motion freezes the flame.
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
    // Seed each timer at the requested phase offset so neighbouring flames
    // don't strobe in unison. withRepeat continues from the current value,
    // so this gives every pin its own starting point inside the cycle.
    const seedPhase = (period: number) =>
      ((phaseOffsetMs % period) + period) % period / period;
    tGlow.value = seedPhase(heatmapPulseMs);
    pOuter.value = seedPhase(4100);
    pMid.value = seedPhase(2900);
    pInner.value = seedPhase(1700);
    tGlow.value = withRepeat(
      withTiming(1, { duration: heatmapPulseMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
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
  }, [reduceMotion, phaseOffsetMs, tGlow, pOuter, pMid, pInner, motion]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tGlow.value, [0, 1], [0.16, 0.34]),
    transform: [{ scale: interpolate(tGlow.value, [0, 1], [0.85, 1.05]) }],
  }));

  // Outer envelope: ±5° sway, ±6% scale. Calmest.
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
      m * (Math.sin(p * 1.1 + 0.8) * 0.035 + Math.sin(p * 3.3 + 2.1) * 0.022);
    const sy =
      1 +
      m * (Math.sin(p * 1.3 + 2.4) * 0.035 + Math.sin(p * 3.7 + 0.9) * 0.022);
    return {
      transform: [
        { rotateZ: `${rot}deg` },
        { scaleX: sx },
        { scaleY: sy },
      ],
    };
  });

  // Mid: moderate sway, ±9% scale, mild opacity flicker. Sits inside outer.
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
          (Math.sin(p * 1.3 + 1.7) * 0.06 + Math.sin(p * 3.7 + 0.3) * 0.035));
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

  // Inner core: most agitated. Tinted by identity. Strong opacity flicker.
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

  // Container is sized so the geo anchor (bottom-center) lines up with the
  // bottom of the flame box. The glow ellipse pads below.
  const W = FRIEND_FLAME_W * scale;
  const H = FRIEND_FLAME_H * scale;
  // Tighter glow than SelfIndicator's — these pins are often clustered and
  // the breathing halo needs to stay contained or neighbours bleed together.
  const GLOW_W = W * 1.5;
  const GLOW_H = H * 0.3;

  // Each flame layer wraps the same SVG path. transformOrigin "50% 100%"
  // pivots the sway from the flame base so it dances upward from the anchor.
  const flameWrapperBase = {
    position: "absolute" as const,
    left: 0,
    top: 0,
    width: W,
    height: H,
    transformOrigin: "50% 100%" as const,
  };

  return (
    <View style={{ width: W, height: H + FRIEND_FLAME_PAD }}>
      {/* Soft warm glow on the ground beneath the flame. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: (W - GLOW_W) / 2,
            top: H - GLOW_H / 2,
            width: GLOW_W,
            height: GLOW_H,
            borderRadius: GLOW_W / 2,
            backgroundColor: light.emberGlow,
          },
          glowStyle,
        ]}
      />

      <Animated.View pointerEvents="none" style={[flameWrapperBase, outerStyle]}>
        <Svg width={W} height={H} viewBox="0 0 26 36">
          <Path d={FLAME_PATH} fill={light.emberDeep} fillOpacity={0.85} />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[flameWrapperBase, midStyle]}>
        <Svg width={W} height={H} viewBox="0 0 26 36">
          <Path d={FLAME_PATH} fill={light.ember} />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[flameWrapperBase, innerStyle]}>
        <Svg width={W} height={H} viewBox="0 0 26 36">
          <Path d={FLAME_PATH} fill={tint} />
        </Svg>
      </Animated.View>

      {/* Monogram. Static (no sway) so it stays legible against the moving
          flames behind it. Drawn at the brightest part of the inner flame's
          natural rest position. Stroke gives contrast over the warm fill. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: H,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={W} height={H} viewBox="0 0 26 36">
          <SvgText
            x={13}
            y={26}
            textAnchor="middle"
            fontSize={10}
            fontWeight="700"
            fontFamily="Onest_600SemiBold"
            fill={light.cream}
            stroke={light.emberDeep}
            strokeWidth={0.6}
          >
            {text}
          </SvgText>
        </Svg>
      </View>
    </View>
  );
}
