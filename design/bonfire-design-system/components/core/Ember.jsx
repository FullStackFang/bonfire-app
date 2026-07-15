import React from "react";

/**
 * Ember — the Bonfire brand mark. A CSS teardrop flame, no SVG.
 * The one piece of pure brand iconography; use it wherever the fire should appear.
 */
export function Ember({ size = 16, glow = false, style = {} }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "inline-block",
        borderRadius: "52% 52% 52% 8% / 60% 60% 40% 40%",
        background:
          "radial-gradient(120% 110% at 50% 78%, #FFD37A 0%, #FF8A3D 38%, #f05846 70%, #E0431F 100%)",
        boxShadow: glow ? "0 0 10px rgba(240,88,70,0.55)" : "none",
        ...style,
      }}
    />
  );
}
