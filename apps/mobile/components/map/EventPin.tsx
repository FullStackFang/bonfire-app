import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { heatmapPulseMs, light } from "@bonfire/ui-tokens";
import { T } from "../ui";
import { getEventStatus, type MapEvent } from "../../lib/mockEventStore";

// Map pin for user-placed events. Duolingo-chunky bonfire (crossed logs +
// 3-layer flame) sitting inside a Turrell-style radial light halo with no
// edges. The geo anchor is the bottom-center of the SVG, which lines up with
// the base of the logs — there's no notch because the halo is the locator.
// Live: halo breathes with the heatmap pulse. Upcoming: no halo, dashed ring
// + unlit ember so the "starts later" affordance survives.

export interface EventPinProps {
  event: MapEvent;
  onPress?: () => void;
  // Tap-gated title label. Caller passes true for the currently selected
  // event; tapping again navigates. Lets the map stay clean by default while
  // still letting users surface titles on demand.
  showTitle?: boolean;
  // Stagger the breathing halo so neighbouring live events don't pulse in
  // unison. Caller passes a deterministic offset derived from the event id.
  phaseOffsetMs?: number;
}

const SIZE = 60;
const CX = SIZE / 2;
const LOG_Y = 44;
const FLAME_CENTER_Y = 30;

export function EventPin({
  event,
  onPress,
  showTitle = false,
  phaseOffsetMs = 0,
}: EventPinProps) {
  const status = getEventStatus(event);
  const isLive = status === "live";
  const isUpcoming = status === "upcoming";

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!isLive) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withDelay(
      phaseOffsetMs,
      withRepeat(
        withTiming(1, { duration: heatmapPulseMs, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(pulse);
  }, [isLive, pulse, phaseOffsetMs]);

  // We animate the halo's wrapping View (opacity + scale) rather than the SVG
  // gradient itself — Reanimated can't drive SVG paint props on native.
  const haloStyle = useAnimatedStyle(() => ({
    opacity: isLive ? 0.55 + pulse.value * 0.4 : 0.35,
    transform: [{ scale: isLive ? 0.92 + pulse.value * 0.2 : 1 }],
  }));

  const a11yLabel = isUpcoming
    ? `Upcoming bonfire: ${event.title}`
    : isLive
      ? `Live bonfire: ${event.title}`
      : `Bonfire: ${event.title}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      hitSlop={8}
      style={{ width: SIZE, height: SIZE }}
    >
      {/* Turrell halo — pure radial light field, no border, fades to fully
          transparent at the edge so the map shows through cleanly. Hidden for
          upcoming events; they haven't lit up yet. */}
      {!isUpcoming ? (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", left: 0, top: 0, width: SIZE, height: SIZE },
            haloStyle,
          ]}
        >
          <Svg width={SIZE} height={SIZE}>
            <Defs>
              <RadialGradient
                id="halo"
                cx={CX}
                cy={FLAME_CENTER_Y}
                r={SIZE / 2}
                fx={CX}
                fy={FLAME_CENTER_Y}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0%" stopColor={light.ember} stopOpacity="0.85" />
                <Stop offset="40%" stopColor={light.ember} stopOpacity="0.3" />
                <Stop offset="100%" stopColor={light.ember} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={SIZE} height={SIZE} fill="url(#halo)" />
          </Svg>
        </Animated.View>
      ) : null}

      {/* Bonfire illustration — sits on top of the halo. */}
      <Svg
        width={SIZE}
        height={SIZE}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        {/* Ground shadow — anchors the bonfire to the map. */}
        <Ellipse
          cx={CX}
          cy={LOG_Y + 5}
          rx={13}
          ry={2.5}
          fill={light.warmShadow}
          opacity={0.4}
        />

        {/* Crossed logs — chunky rounded bars in coal. */}
        <G transform={`rotate(-20 ${CX} ${LOG_Y})`}>
          <Rect
            x={CX - 12}
            y={LOG_Y - 2.5}
            width={24}
            height={5}
            rx={2.5}
            fill={light.coal}
          />
        </G>
        <G transform={`rotate(20 ${CX} ${LOG_Y})`}>
          <Rect
            x={CX - 12}
            y={LOG_Y - 2.5}
            width={24}
            height={5}
            rx={2.5}
            fill={light.coal}
          />
        </G>

        {isUpcoming ? (
          <>
            {/* Unlit ember — the spark that's about to catch. */}
            <Circle
              cx={CX}
              cy={LOG_Y - 5}
              r={2.8}
              fill={light.smoke}
            />
            {/* Dashed ring keeps the upcoming-pin affordance from the legend. */}
            <Circle
              cx={CX}
              cy={FLAME_CENTER_Y + 6}
              r={19}
              stroke={light.smoke}
              strokeWidth={1}
              strokeDasharray="3 3"
              fill="none"
              opacity={0.55}
            />
          </>
        ) : (
          // Three stacked teardrop flames: outer wash → body → bright tip.
          <G>
            <Flame
              cx={CX}
              cy={FLAME_CENTER_Y + 6}
              scale={1.0}
              fill={light.emberGlow}
              opacity={0.75}
            />
            <Flame
              cx={CX}
              cy={FLAME_CENTER_Y + 4}
              scale={0.72}
              fill={light.ember}
            />
            <Flame
              cx={CX}
              cy={FLAME_CENTER_Y + 1}
              scale={0.38}
              fill={light.cream}
              opacity={0.95}
            />
          </G>
        )}
      </Svg>

      {/* Zoom-gated title — sits below the geo anchor (no chip background,
          cream text-shadow halo for legibility over any map tile). */}
      {showTitle ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: SIZE,
            left: -40,
            right: -40,
            alignItems: "center",
          }}
        >
          <T
            variant="bodySm"
            numberOfLines={1}
            style={{
              fontFamily: "Onest_600SemiBold",
              color: light.coal,
              textShadowColor: light.hearth,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 4,
              maxWidth: 140,
            }}
          >
            {event.title}
          </T>
        </View>
      ) : null}
    </Pressable>
  );
}

// Stylized teardrop flame. Path is authored centered on (0,0) with the tip
// pointing up; G handles per-instance position + scale.
function Flame({
  cx,
  cy,
  scale,
  fill,
  opacity,
}: {
  cx: number;
  cy: number;
  scale: number;
  fill: string;
  opacity?: number;
}) {
  return (
    <G transform={`translate(${cx} ${cy}) scale(${scale})`}>
      <Path
        d="M0,-18 C5,-12 8,-5 7,2 C6,7 3,10 0,10 C-3,10 -6,7 -7,2 C-8,-5 -5,-12 0,-18 Z"
        fill={fill}
        opacity={opacity}
      />
    </G>
  );
}
