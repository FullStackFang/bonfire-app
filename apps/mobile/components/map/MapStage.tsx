// View-based "map stage" for the MVP. No native dependency — just the
// editorial warm grid + a teal "water" rectangle + the heatmap layer.
// Swap to @maplibre/maplibre-react-native by replacing this component;
// the public interface (cells + pins + children + width/height) stays
// the same.

import { useMemo } from "react";
import { View } from "react-native";
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
    const v: { left: number; weight: number }[] = [];
    const h: { top: number; weight: number }[] = [];
    for (let x = 60; x < width; x += 80) v.push({ left: x, weight: (x / 80) % 2 === 0 ? 1.5 : 1 });
    for (let y = 50; y < height; y += 80) h.push({ top: y, weight: (y / 80) % 2 === 0 ? 1.5 : 1 });
    return { v, h };
  }, [width, height]);

  return (
    <View
      style={{
        width,
        height,
        position: "relative",
        backgroundColor: light.cream,
        overflow: "hidden",
      }}
    >
      {/* "Water" rectangle, bottom-right */}
      <View
        style={{
          position: "absolute",
          left: width * 0.65,
          top: height * 0.55,
          width: width * 0.4,
          height: height * 0.25,
          backgroundColor: "#cfdde0",
          opacity: 0.4,
        }}
      />

      {/* Vertical grid lines */}
      {grid.v.map((g, i) => (
        <View
          key={`v${i}`}
          style={{
            position: "absolute",
            left: g.left,
            top: 0,
            width: g.weight,
            height: "100%",
            backgroundColor: light.ash,
            opacity: 0.55,
          }}
        />
      ))}

      {/* Horizontal grid lines */}
      {grid.h.map((g, i) => (
        <View
          key={`h${i}`}
          style={{
            position: "absolute",
            left: 0,
            top: g.top,
            width: "100%",
            height: g.weight,
            backgroundColor: light.ash,
            opacity: 0.55,
          }}
        />
      ))}

      {/* Heatmap layer */}
      <HeatmapPulse width={width} height={height} cells={cells} />

      {/* Overlays (avatars, activity bubbles, etc.) */}
      {children}
    </View>
  );
}
