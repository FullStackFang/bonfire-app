import { useEffect } from "react";
import {
  Canvas,
  Circle,
  RadialGradient,
  Group,
  vec,
} from "@shopify/react-native-skia";
import {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useDerivedValue,
  cancelAnimation,
} from "react-native-reanimated";
import { light, heatmapPulseMs } from "@bonfire/ui-tokens";

export interface HeatCell {
  x: number;
  y: number;
  weight: number; // 0..1
}

export interface HeatmapPulseProps {
  width: number;
  height: number;
  cells: HeatCell[];
  radius?: number;
}

/**
 * A Skia overlay that renders an ember-tinted radial-gradient heatmap.
 * Each cell breathes on the heatmapPulseMs cycle, with weight controlling the alpha ceiling.
 */
export function HeatmapPulse({
  width,
  height,
  cells,
  radius = 90,
}: HeatmapPulseProps) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: heatmapPulseMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(t);
  }, [t]);

  return (
    <Canvas style={{ width, height, position: "absolute" }} pointerEvents="none">
      <Group>
        {cells.map((cell, i) => (
          <HeatCellView key={i} cell={cell} t={t} radius={radius} />
        ))}
      </Group>
    </Canvas>
  );
}

function HeatCellView({
  cell,
  t,
  radius,
}: {
  cell: HeatCell;
  t: { value: number };
  radius: number;
}) {
  const alpha = useDerivedValue(() => 0.14 + cell.weight * (0.16 + t.value * 0.16));
  const r = useDerivedValue(() => radius * (0.92 + t.value * 0.18));

  return (
    <Circle cx={cell.x} cy={cell.y} r={r} opacity={alpha}>
      <RadialGradient
        c={vec(cell.x, cell.y)}
        r={radius}
        colors={[light.ember, light.emberGlow, "transparent"]}
        positions={[0, 0.55, 1]}
      />
    </Circle>
  );
}
