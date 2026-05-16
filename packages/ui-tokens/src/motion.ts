export const houseSpring = {
  mass: 1,
  damping: 22,
  stiffness: 220,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 2,
} as const;

export const tightSpring = {
  mass: 1,
  damping: 28,
  stiffness: 320,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 2,
} as const;

export const heatmapPulseMs = 3200;
export const reducedTimingMs = 200;
