// A Skia-rendered "map stage" used for the MVP map screen.
// This is intentionally NOT MapLibre — we ship a stylized grid that matches
// the editorial warm aesthetic without needing tile hosting in the MVP.
// Swap to @maplibre/maplibre-react-native by replacing this component;
// the public interface (cells + pins + tap callback) stays the same.

import { useMemo } from "react";
import { View } from "react-native";
import {
  Canvas,
  Group,
  Line,
  Rect,
  vec,
} from "@shopify/react-native-skia";
import { light } from "@bonfire/ui-tokens";
import { HeatmapPulse, type HeatCell } from "./HeatmapPulse";

export interface MapStageProps {
  width: number;
  height: number;
  cells: HeatCell[];
  children?: React.ReactNode;
}

export function MapStage({ width, height, cells, children }: MapStageProps) {
  const grid = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; weight: number }[] = [];
    // Vertical lines
    for (let x = 60; x < width; x += 80) {
      lines.push({ x1: x, y1: 0, x2: x, y2: height, weight: (x / 80) % 2 === 0 ? 1 : 0.5 });
    }
    // Horizontal lines
    for (let y = 50; y < height; y += 80) {
      lines.push({ x1: 0, y1: y, x2: width, y2: y, weight: (y / 80) % 2 === 0 ? 1 : 0.5 });
    }
    return lines;
  }, [width, height]);

  return (
    <View style={{ width, height, position: "relative" }}>
      <Canvas style={{ position: "absolute", width, height }}>
        <Rect x={0} y={0} width={width} height={height} color={light.cream} />
        <Group>
          {grid.map((l, i) => (
            <Line
              key={i}
              p1={vec(l.x1, l.y1)}
              p2={vec(l.x2, l.y2)}
              color={light.ash}
              style="stroke"
              strokeWidth={l.weight * 1.2}
              opacity={0.6}
            />
          ))}
        </Group>
        {/* a subtle teal "water" rectangle bottom-right to suggest place */}
        <Rect
          x={width * 0.65}
          y={height * 0.55}
          width={width * 0.4}
          height={height * 0.25}
          color="#cfdde0"
          opacity={0.4}
        />
      </Canvas>
      <HeatmapPulse width={width} height={height} cells={cells} />
      {children}
    </View>
  );
}
