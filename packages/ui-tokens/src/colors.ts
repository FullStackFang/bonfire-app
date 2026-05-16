// Source OKLCH strings preserved in comments for future Skia / CSS use.
// React Native style props don't accept oklch() so we ship pre-baked hex.
// To regenerate, run `node bake.mjs` in this directory with culori installed.

export const light = {
  ember:     "#f05846", // oklch(66% 0.19 30)
  emberDeep: "#a52a24", // oklch(48% 0.16 28)
  emberGlow: "#fa9b82", // oklch(78% 0.12 35)
  spark:     "#54b05a", // oklch(68% 0.15 145)
  dusk:      "#e0843e", // oklch(70% 0.14 55)
  night:     "#1d293d", // oklch(28% 0.04 260)
  coal:      "#231715", // oklch(22% 0.02 30)
  smoke:     "#716664", // oklch(52% 0.015 30)
  ash:       "#ddd6d4", // oklch(88% 0.008 30)
  hearth:    "#ffffff", // oklch(100% 0 0)
  cream:     "#fff7f1", // oklch(98% 0.012 60)
  warmShadow:"#c8b8b1", // oklch(78% 0.012 30) — the bottom layer under hearth-faced chunky buttons
} as const;

export const night = {
  ember:     "#ff6d53", // oklch(72% 0.19 32)
  emberDeep: "#cf4232", // oklch(58% 0.18 30)
  emberGlow: "#c55c43", // oklch(60% 0.14 35)
  spark:     "#61c568", // oklch(74% 0.16 145)
  dusk:      "#f49752", // oklch(76% 0.14 55)
  night:     "#060d1a", // oklch(16% 0.03 260)
  coal:      "#f7f0eb", // oklch(96% 0.01 60)
  smoke:     "#a49491", // oklch(68% 0.02 30)
  ash:       "#322523", // oklch(28% 0.02 30)
  hearth:    "#141b26", // oklch(22% 0.025 260)
  cream:     "#050911", // oklch(14% 0.02 260)
  warmShadow:"#0a1320", // bottom layer under hearth chunky controls in night mode
} as const;

export type ColorName = keyof typeof light;
export type Theme = "light" | "night";

export const themes = { light, night } as const;

// Avatar accent colors — six bands so the circles look intentional, not random.
export const avatarAccents = [
  "#5E7FE5", // blue
  "#1A9E75", // green
  "#9D5BC2", // purple
  "#E2843D", // orange
  "#E2B33D", // amber
  "#666f7d", // slate
] as const;

export function avatarColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return avatarAccents[Math.abs(hash) % avatarAccents.length];
}
