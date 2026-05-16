# Milestone 0 — Design System Foundation (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working `/components-preview` route on the Expo iOS app that renders every base component (Avatar, AvatarStack, Chip, Card, CTAButton, LiveDot, BonfireScore, IntentBadge, EmptyState) using the spec's warm OKLCH palette, Sentient/Switzer/Fragment Mono typography, and the house spring motion. No screens, no Supabase — just the design system every future milestone composes from.

**Architecture:**
- `packages/ui-tokens` holds the design tokens (colors, spacing, type, motion) as pure TS constants. Both `oklch` strings (for documentation and future Skia use) and pre-baked hex values (for React Native style props, which do not accept `oklch()`).
- `apps/mobile/components/ui/` holds the base components. Each component file is focused on one component, has its own test, and exports a typed prop interface.
- `apps/mobile/app/components-preview.tsx` is the visual verification route — it renders every component in every variant. Engineers and reviewers spot regressions visually.
- Jest + `@testing-library/react-native` for unit tests. Test files live next to source as `*.test.tsx`.

**Tech Stack:** Expo SDK 54, React Native 0.81, Expo Router 6, NativeWind 4, Reanimated 3, `expo-font`, `jest-expo`, `@testing-library/react-native`.

---

## Scope notes (what's NOT in this milestone)

- No Skia (deferred to Milestone 5 where the heatmap shader lives).
- No MapLibre, no Supabase, no auth.
- No `HeatmapPulse`, `MapAvatarPin`, `BottomSheet` components — they need their first consumer first.
- The existing `apps/mobile/app/index.tsx` (status-picker over a placeholder map) is replaced by a minimal splash that navigates to `/components-preview`. The full Home screen lands in Milestone 5.
- The old `packages/ui-tokens/src/index.ts` (status colors, surface tokens, motion) is replaced wholesale. No backwards-compat shims.

---

## File map

**Created:**
- `packages/ui-tokens/src/colors.ts`
- `packages/ui-tokens/src/spacing.ts`
- `packages/ui-tokens/src/type.ts`
- `packages/ui-tokens/src/motion.ts`
- `apps/mobile/assets/fonts/Sentient-Regular.otf` (and Italic, Medium)
- `apps/mobile/assets/fonts/Switzer-Regular.otf` (and Medium, Semibold)
- `apps/mobile/assets/fonts/FragmentMono-Regular.ttf`
- `apps/mobile/lib/useLoadFonts.ts`
- `apps/mobile/components/ui/Avatar.tsx` + `.test.tsx`
- `apps/mobile/components/ui/AvatarStack.tsx` + `.test.tsx`
- `apps/mobile/components/ui/Chip.tsx` + `.test.tsx`
- `apps/mobile/components/ui/Card.tsx`
- `apps/mobile/components/ui/CTAButton.tsx` + `.test.tsx`
- `apps/mobile/components/ui/LiveDot.tsx`
- `apps/mobile/components/ui/BonfireScore.tsx`
- `apps/mobile/components/ui/IntentBadge.tsx`
- `apps/mobile/components/ui/EmptyState.tsx`
- `apps/mobile/components/ui/index.ts` (barrel)
- `apps/mobile/app/components-preview.tsx`
- `apps/mobile/jest.config.js`
- `apps/mobile/jest.setup.ts`

**Modified:**
- `packages/ui-tokens/src/index.ts` — barrel re-export
- `packages/ui-tokens/package.json` — add exports for new submodules
- `apps/mobile/package.json` — add dev deps
- `apps/mobile/tailwind.config.js` — rewrite color/font/spacing extends
- `apps/mobile/global.css` — unchanged content, but kept
- `apps/mobile/app/_layout.tsx` — load fonts, register components-preview route
- `apps/mobile/app/index.tsx` — minimal splash linking to preview

**Deleted:**
- (none — `apps/mobile/components/map/` and `apps/mobile/lib/location.ts` stay; they're useful for Milestone 5.)

---

## Task 1: Install testing infrastructure

**Files:**
- Modify: `apps/mobile/package.json`
- Create: `apps/mobile/jest.config.js`
- Create: `apps/mobile/jest.setup.ts`

- [ ] **Step 1: Install dev dependencies**

Run from repo root (npm workspaces):

```bash
npm install --save-dev --workspace=apps/mobile jest@^29 jest-expo@~54.0.0 @testing-library/react-native@^12.7.0 @testing-library/jest-native@^5.4.3 @types/jest@^29 react-test-renderer@19.1.0
```

Expected: dependencies appear under `apps/mobile/package.json` devDependencies. Package-lock updates. No peer-dep errors (jest-expo 54 matches the Expo SDK).

- [ ] **Step 2: Create `apps/mobile/jest.config.js`**

```js
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEach: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop|@shopify/.*))",
  ],
  moduleNameMapper: {
    "^@bonfire/(.*)$": "<rootDir>/../../packages/$1/src",
  },
  roots: ["<rootDir>", "<rootDir>/../../packages"],
  testPathIgnorePatterns: ["/node_modules/", "/.expo/", "/dist/"],
};
```

- [ ] **Step 3: Create `apps/mobile/jest.setup.ts`**

```ts
import "@testing-library/jest-native/extend-expect";

// Silence reanimated's worklet warning during tests
jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});

// expo-font loadAsync is a noop in tests
jest.mock("expo-font", () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: jest.fn(() => true),
  useFonts: () => [true, null],
}));
```

- [ ] **Step 4: Add test script to `apps/mobile/package.json`**

In the `scripts` block, add:

```json
"test": "jest --passWithNoTests",
"test:watch": "jest --watch"
```

- [ ] **Step 5: Verify jest runs**

Run:

```bash
npm run test --workspace=apps/mobile
```

Expected: `No tests found, exiting with code 0` (or similar — the key is no jest configuration error).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/package.json apps/mobile/jest.config.js apps/mobile/jest.setup.ts package-lock.json
git commit -m "chore(mobile): set up jest + react-native testing library"
```

---

## Task 2: Add OKLCH→hex conversion script and pre-bake color tokens

**Files:**
- Create: `packages/ui-tokens/scripts/bake-colors.ts`
- Create: `packages/ui-tokens/src/colors.ts`
- Modify: `packages/ui-tokens/package.json`

Rationale: React Native style props do not accept `oklch()` strings. We compute hex values at build time using `culori` (a small color library), commit them, and keep the `oklch` definitions alongside in comments for future Skia use.

- [ ] **Step 1: Add `culori` as a workspace devDependency**

```bash
npm install --save-dev --workspace=packages/ui-tokens culori@^4 tsx@^4
```

- [ ] **Step 2: Update `packages/ui-tokens/package.json` scripts**

Add to the `scripts` block (create the block if absent):

```json
{
  "scripts": {
    "bake:colors": "tsx scripts/bake-colors.ts"
  }
}
```

- [ ] **Step 3: Create `packages/ui-tokens/scripts/bake-colors.ts`**

```ts
// Run with: npm run bake:colors --workspace=packages/ui-tokens
// Prints a TS file to stdout. Pipe to src/colors.ts.
import { formatHex, parse, converter } from "culori";

const toRgb = converter("rgb");

function hex(oklch: string): string {
  const parsed = parse(oklch);
  if (!parsed) throw new Error(`could not parse ${oklch}`);
  return formatHex(toRgb(parsed)) ?? "#000000";
}

const themes = {
  light: {
    ember:     "oklch(66% 0.19 30)",
    emberDeep: "oklch(48% 0.16 28)",
    emberGlow: "oklch(78% 0.12 35)",
    spark:     "oklch(68% 0.15 145)",
    dusk:      "oklch(70% 0.14 55)",
    night:     "oklch(28% 0.04 260)",
    coal:      "oklch(22% 0.02 30)",
    smoke:     "oklch(52% 0.015 30)",
    ash:       "oklch(88% 0.008 30)",
    hearth:    "oklch(100% 0 0)",
    cream:     "oklch(98% 0.012 60)",
  },
  night: {
    ember:     "oklch(72% 0.19 32)",
    emberDeep: "oklch(58% 0.18 30)",
    emberGlow: "oklch(60% 0.14 35)",
    spark:     "oklch(74% 0.16 145)",
    dusk:      "oklch(76% 0.14 55)",
    night:     "oklch(16% 0.03 260)",
    coal:      "oklch(96% 0.01 60)",
    smoke:     "oklch(68% 0.02 30)",
    ash:       "oklch(28% 0.02 30)",
    hearth:    "oklch(22% 0.025 260)",
    cream:     "oklch(14% 0.02 260)",
  },
} as const;

const out = [
  "// AUTO-GENERATED by scripts/bake-colors.ts — do not edit by hand.",
  "// Source OKLCH strings preserved for future Skia/CSS use.",
  "// To regenerate: `npm run bake:colors --workspace=packages/ui-tokens`",
  "",
];

for (const [theme, tokens] of Object.entries(themes)) {
  out.push(`export const ${theme} = {`);
  for (const [name, value] of Object.entries(tokens)) {
    out.push(`  ${name}: "${hex(value)}", // ${value}`);
  }
  out.push(`} as const;`);
  out.push("");
}

out.push(`export const oklchSource = ${JSON.stringify(themes, null, 2)} as const;`);
out.push("");
out.push("export type ColorName = keyof typeof light;");
out.push("export type Theme = \"light\" | \"night\";");

console.log(out.join("\n"));
```

- [ ] **Step 4: Generate `packages/ui-tokens/src/colors.ts`**

Run from repo root:

```bash
npm run bake:colors --workspace=packages/ui-tokens > packages/ui-tokens/src/colors.ts
```

Open the file. It should look approximately like:

```ts
// AUTO-GENERATED by scripts/bake-colors.ts — do not edit by hand.
// Source OKLCH strings preserved for future Skia/CSS use.
// To regenerate: `npm run bake:colors --workspace=packages/ui-tokens`

export const light = {
  ember: "#eb6648",        // oklch(66% 0.19 30)
  emberDeep: "#b94a31",    // oklch(48% 0.16 28)
  emberGlow: "#f3a283",    // oklch(78% 0.12 35)
  spark: "#7bb968",        // oklch(68% 0.15 145)
  dusk: "#d09056",         // oklch(70% 0.14 55)
  night: "#252a3d",        // oklch(28% 0.04 260)
  coal: "#2b211c",         // oklch(22% 0.02 30)
  smoke: "#80766f",        // oklch(52% 0.015 30)
  ash: "#dad3cd",          // oklch(88% 0.008 30)
  hearth: "#ffffff",       // oklch(100% 0 0)
  cream: "#fbf7ee",        // oklch(98% 0.012 60)
} as const;

export const night = { /* ... */ } as const;
export const oklchSource = { /* ... */ } as const;
export type ColorName = keyof typeof light;
export type Theme = "light" | "night";
```

(Exact hex values may vary by a digit or two depending on culori version — that's fine, they're committed as the source of truth.)

- [ ] **Step 5: Commit**

```bash
git add packages/ui-tokens/scripts/bake-colors.ts packages/ui-tokens/src/colors.ts packages/ui-tokens/package.json package-lock.json
git commit -m "feat(ui-tokens): add oklch->hex baked color palette"
```

---

## Task 3: Spacing, type, and motion tokens

**Files:**
- Create: `packages/ui-tokens/src/spacing.ts`
- Create: `packages/ui-tokens/src/type.ts`
- Create: `packages/ui-tokens/src/motion.ts`
- Modify: `packages/ui-tokens/src/index.ts`
- Modify: `packages/ui-tokens/package.json`

- [ ] **Step 1: Create `packages/ui-tokens/src/spacing.ts`**

```ts
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
  9: 96,
} as const;

export type SpaceKey = keyof typeof space;

export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  pill: 999,
} as const;

export type RadiusKey = keyof typeof radius;
```

- [ ] **Step 2: Create `packages/ui-tokens/src/type.ts`**

```ts
export const fontFamily = {
  displayRegular: "Sentient-Regular",
  displayItalic: "Sentient-RegularItalic",
  displayMedium: "Sentient-Medium",
  bodyRegular: "Switzer-Regular",
  bodyMedium: "Switzer-Medium",
  bodySemibold: "Switzer-Semibold",
  monoRegular: "FragmentMono-Regular",
} as const;

export type FontFamily = keyof typeof fontFamily;

// {fontSize, lineHeight} pairs in px. Spec §4.3.
export const typeScale = {
  displayXl: { fontSize: 34, lineHeight: 38, family: fontFamily.displayItalic },
  displayLg: { fontSize: 28, lineHeight: 32, family: fontFamily.displayRegular },
  title:     { fontSize: 22, lineHeight: 28, family: fontFamily.displayMedium },
  bodyLg:    { fontSize: 17, lineHeight: 24, family: fontFamily.bodyRegular },
  body:      { fontSize: 15, lineHeight: 22, family: fontFamily.bodyRegular },
  bodySm:    { fontSize: 13, lineHeight: 18, family: fontFamily.bodyMedium },
  monoSm:    { fontSize: 12, lineHeight: 16, family: fontFamily.monoRegular },
  overline:  { fontSize: 11, lineHeight: 14, family: fontFamily.bodyMedium },
} as const;

export type TypeScaleKey = keyof typeof typeScale;
```

- [ ] **Step 3: Create `packages/ui-tokens/src/motion.ts`**

```ts
// The house spring used everywhere. Spec §4.6.
export const houseSpring = {
  mass: 1,
  damping: 22,
  stiffness: 220,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 2,
} as const;

export const heatmapPulseMs = 3200;

// For Reduce Motion fallback: a simple 200ms ease-out timing.
export const reducedTimingMs = 200;
```

- [ ] **Step 4: Update `packages/ui-tokens/src/index.ts`**

Replace the existing file contents with:

```ts
export * from "./colors";
export * from "./spacing";
export * from "./type";
export * from "./motion";
```

- [ ] **Step 5: Update `packages/ui-tokens/package.json` exports**

Replace the `exports` block with:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./colors": "./src/colors.ts",
    "./spacing": "./src/spacing.ts",
    "./type": "./src/type.ts",
    "./motion": "./src/motion.ts"
  }
}
```

- [ ] **Step 6: Write a smoke test**

Create `packages/ui-tokens/src/tokens.test.ts`:

```ts
import { light, night, space, typeScale, houseSpring } from "./index";

describe("ui-tokens", () => {
  it("light palette has every required color", () => {
    const expected = ["ember","emberDeep","emberGlow","spark","dusk","night","coal","smoke","ash","hearth","cream"];
    for (const k of expected) {
      expect(light).toHaveProperty(k);
      expect((light as Record<string,string>)[k]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("night palette mirrors light keys", () => {
    expect(Object.keys(night).sort()).toEqual(Object.keys(light).sort());
  });

  it("space scale is 4-multiples or 0", () => {
    for (const v of Object.values(space)) {
      expect(v === 0 || v % 4 === 0).toBe(true);
    }
  });

  it("type scale entries have a family from the registry", () => {
    for (const v of Object.values(typeScale)) {
      expect(typeof v.family).toBe("string");
      expect(v.family.length).toBeGreaterThan(0);
    }
  });

  it("house spring uses spec values", () => {
    expect(houseSpring.mass).toBe(1);
    expect(houseSpring.damping).toBe(22);
    expect(houseSpring.stiffness).toBe(220);
  });
});
```

- [ ] **Step 7: Run the test**

Run:

```bash
npm run test --workspace=apps/mobile -- packages/ui-tokens/src/tokens.test.ts
```

Expected: 5 passing tests.

(Note: tests live in `packages/ui-tokens/src/` but jest runs from `apps/mobile/`. The `moduleNameMapper` in Task 1 lets us import `@bonfire/ui-tokens` and the `testMatch` defaults to `**/*.test.ts(x)` across the workspace via jest-expo. If the test isn't picked up, add `roots: ["<rootDir>", "<rootDir>/../../packages"]` to jest.config.js.)

- [ ] **Step 8: Commit**

```bash
git add packages/ui-tokens/src/ packages/ui-tokens/package.json
git commit -m "feat(ui-tokens): add spacing, type, motion tokens"
```

---

## Task 4: Download fonts and register them with expo-font

**Files:**
- Create: `apps/mobile/assets/fonts/*.otf|ttf` (7 files)
- Create: `apps/mobile/lib/useLoadFonts.ts`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Download Sentient and Switzer from FontShare**

Open in a browser (or `curl` if you have CDN credentials):

- Sentient: https://www.fontshare.com/fonts/sentient/download
- Switzer: https://www.fontshare.com/fonts/switzer/download

Each downloads a ZIP. From the Sentient ZIP, copy the following files into `apps/mobile/assets/fonts/`:

```
Sentient-Regular.otf
Sentient-RegularItalic.otf
Sentient-Medium.otf
```

From the Switzer ZIP, copy:

```
Switzer-Regular.otf
Switzer-Medium.otf
Switzer-Semibold.otf
```

- [ ] **Step 2: Download Fragment Mono**

Fragment Mono is on Google Fonts. Fetch the TTF directly:

```bash
mkdir -p apps/mobile/assets/fonts
curl -L -o apps/mobile/assets/fonts/FragmentMono-Regular.ttf \
  "https://fonts.gstatic.com/s/fragmentmono/v4/4iCr6K5wfMRRjxp0DA6-2CLnN4VBu4_iDQ.ttf"
```

(If the URL drifts, get the latest from https://fonts.google.com/specimen/Fragment+Mono → Download family.)

- [ ] **Step 3: Verify files exist**

Run:

```bash
ls apps/mobile/assets/fonts/
```

Expected: seven files, exactly the names above.

- [ ] **Step 4: Create `apps/mobile/lib/useLoadFonts.ts`**

```ts
import { useFonts } from "expo-font";

export function useLoadFonts() {
  const [loaded, error] = useFonts({
    "Sentient-Regular": require("../assets/fonts/Sentient-Regular.otf"),
    "Sentient-RegularItalic": require("../assets/fonts/Sentient-RegularItalic.otf"),
    "Sentient-Medium": require("../assets/fonts/Sentient-Medium.otf"),
    "Switzer-Regular": require("../assets/fonts/Switzer-Regular.otf"),
    "Switzer-Medium": require("../assets/fonts/Switzer-Medium.otf"),
    "Switzer-Semibold": require("../assets/fonts/Switzer-Semibold.otf"),
    "FragmentMono-Regular": require("../assets/fonts/FragmentMono-Regular.ttf"),
  });
  return { loaded, error };
}
```

- [ ] **Step 5: Wire fonts into the root layout**

Replace `apps/mobile/app/_layout.tsx` with:

```tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import "../global.css";
import { useLoadFonts } from "../lib/useLoadFonts";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { loaded, error } = useLoadFonts();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="components-preview" options={{ presentation: "card" }} />
        </Stack>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 6: Build + run on iOS**

Run:

```bash
npm run start --workspace=apps/mobile
```

Open the Expo Go app or simulator. The current index screen still renders (we'll replace it in Task 5), but the fonts must load — there should be no "missing font" red-box warning.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/assets/fonts/ apps/mobile/lib/useLoadFonts.ts apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): load Sentient, Switzer, Fragment Mono via expo-font"
```

---

## Task 5: Rewrite tailwind config + minimal splash index

**Files:**
- Modify: `apps/mobile/tailwind.config.js`
- Modify: `apps/mobile/app/index.tsx`

- [ ] **Step 1: Replace `apps/mobile/tailwind.config.js`**

```js
const tokens = require("@bonfire/ui-tokens");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ember: tokens.light.ember,
        "ember-deep": tokens.light.emberDeep,
        "ember-glow": tokens.light.emberGlow,
        spark: tokens.light.spark,
        dusk: tokens.light.dusk,
        night: tokens.light.night,
        coal: tokens.light.coal,
        smoke: tokens.light.smoke,
        ash: tokens.light.ash,
        hearth: tokens.light.hearth,
        cream: tokens.light.cream,
      },
      fontFamily: {
        "display-regular": ["Sentient-Regular"],
        "display-italic": ["Sentient-RegularItalic"],
        "display-medium": ["Sentient-Medium"],
        "body-regular": ["Switzer-Regular"],
        "body-medium": ["Switzer-Medium"],
        "body-semibold": ["Switzer-Semibold"],
        "mono-regular": ["FragmentMono-Regular"],
      },
      borderRadius: {
        sm: tokens.radius.sm + "px",
        md: tokens.radius.md + "px",
        lg: tokens.radius.lg + "px",
        xl: tokens.radius.xl + "px",
        "2xl": tokens.radius["2xl"] + "px",
        pill: tokens.radius.pill + "px",
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Replace `apps/mobile/app/index.tsx` with the splash**

The existing file references `@bonfire/shared` symbols (`STATUS_LABEL`, `STATUS_ORDER`, `Status`) and tokens (`statusColor`) that no longer exist. Replace it with a minimal splash that links to the preview route.

```tsx
import { Link } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-1 items-stretch justify-between px-6 py-12">
        <View>
          <Text
            className="text-coal"
            style={{ fontFamily: "Sentient-RegularItalic", fontSize: 44, lineHeight: 48 }}
          >
            bonfire
          </Text>
          <Text
            className="text-smoke mt-3"
            style={{ fontFamily: "Switzer-Regular", fontSize: 17, lineHeight: 24 }}
          >
            Milestone 0 — design system preview.
          </Text>
        </View>

        <Link href="/components-preview" asChild>
          <Text
            className="bg-ember text-hearth rounded-pill text-center"
            style={{ fontFamily: "Switzer-Semibold", fontSize: 17, paddingVertical: 16 }}
          >
            Open components preview
          </Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Remove now-unused imports from shared**

The old index.tsx imported `STATUS_LABEL`, `STATUS_ORDER`, `Status`, `UserPosition` from `@bonfire/shared` and `statusColor` from `@bonfire/ui-tokens`. None of those exist in the new tokens, and the old shared exports likely conflict.

Read `packages/shared/src/index.ts` and decide:
- If the file only contains the status/position types that the old home consumed, leave it for now — Milestone 5 will rewrite it.
- If it contains nothing else we care about, leave the file alone. We are not deleting in this milestone.

The new `index.tsx` does not import from `@bonfire/shared`. The build should succeed.

- [ ] **Step 4: Verify the app boots**

Run:

```bash
npm run start --workspace=apps/mobile
```

In the simulator, expect: a cream screen with "bonfire" in big Sentient italic at the top, a smoke caption, and an ember "Open components preview" button at the bottom. Tapping the button errors (route not yet created) — that's fine, fixed in Task 6.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/tailwind.config.js apps/mobile/app/index.tsx
git commit -m "feat(mobile): tailwind tokens + bonfire splash"
```

---

## Task 6: Components preview route skeleton

**Files:**
- Create: `apps/mobile/app/components-preview.tsx`
- Create: `apps/mobile/components/ui/index.ts`

- [ ] **Step 1: Create the barrel `apps/mobile/components/ui/index.ts`**

```ts
// Filled in as components land in subsequent tasks.
export {};
```

- [ ] **Step 2: Create `apps/mobile/app/components-preview.tsx`**

```tsx
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="px-5 py-6">
      <Text
        className="text-smoke uppercase mb-4"
        style={{ fontFamily: "Switzer-Medium", fontSize: 11, lineHeight: 14, letterSpacing: 1 }}
      >
        {title}
      </Text>
      <View className="gap-4">{children}</View>
    </View>
  );
}

export default function ComponentsPreview() {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-5 pt-6 pb-2">
          <Text
            className="text-coal"
            style={{ fontFamily: "Sentient-RegularItalic", fontSize: 34, lineHeight: 38 }}
          >
            Components
          </Text>
          <Text
            className="text-smoke mt-1"
            style={{ fontFamily: "Switzer-Regular", fontSize: 15, lineHeight: 22 }}
          >
            Every base component, every variant.
          </Text>
        </View>

        <Section title="Typography">
          <Text className="text-coal" style={{ fontFamily: "Sentient-RegularItalic", fontSize: 34, lineHeight: 38 }}>
            Display XL — Build your bonfire
          </Text>
          <Text className="text-coal" style={{ fontFamily: "Sentient-Regular", fontSize: 28, lineHeight: 32 }}>
            Display LG — 87
          </Text>
          <Text className="text-coal" style={{ fontFamily: "Sentient-Medium", fontSize: 22, lineHeight: 28 }}>
            Title — Your network
          </Text>
          <Text className="text-coal" style={{ fontFamily: "Switzer-Regular", fontSize: 17, lineHeight: 24 }}>
            Body LG — five friends here now.
          </Text>
          <Text className="text-coal" style={{ fontFamily: "Switzer-Regular", fontSize: 15, lineHeight: 22 }}>
            Body — Out for drinks at Maxie's Supper Club.
          </Text>
          <Text className="text-smoke" style={{ fontFamily: "FragmentMono-Regular", fontSize: 12, lineHeight: 16 }}>
            Mono SM — 2 min ago · 0.3 mi
          </Text>
        </Section>

        {/* sections for each component appended in later tasks */}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verify the route works**

Restart Metro (`r` in terminal), tap "Open components preview" on the splash. Expect: cream screen, "Components" Sentient italic header, smoke caption, then a "TYPOGRAPHY" section showing six type samples in the correct fonts. If a sample renders in the system font, the font name in `useLoadFonts.ts` doesn't match — fix that first.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/components-preview.tsx apps/mobile/components/ui/index.ts
git commit -m "feat(mobile): components-preview route with typography section"
```

---

## Task 7: Avatar component

**Files:**
- Create: `apps/mobile/components/ui/Avatar.tsx`
- Create: `apps/mobile/components/ui/Avatar.test.tsx`
- Modify: `apps/mobile/components/ui/index.ts`
- Modify: `apps/mobile/app/components-preview.tsx`

Spec: letter-pair on a tinted oklch circle, sizes `xs/sm/md/lg`, optional `live` prop that adds a slow breathing ember halo via Reanimated.

- [ ] **Step 1: Write failing test `apps/mobile/components/ui/Avatar.test.tsx`**

```tsx
import { render } from "@testing-library/react-native";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("renders the letter pair", () => {
    const { getByText } = render(<Avatar label="SP" color="#5E7FE5" />);
    expect(getByText("SP")).toBeTruthy();
  });

  it("uppercases the label", () => {
    const { getByText } = render(<Avatar label="sp" color="#5E7FE5" />);
    expect(getByText("SP")).toBeTruthy();
  });

  it("trims labels longer than two characters", () => {
    const { getByText } = render(<Avatar label="Sarah" color="#5E7FE5" />);
    expect(getByText("SA")).toBeTruthy();
  });

  it("has an accessibility label", () => {
    const { getByLabelText } = render(<Avatar label="SP" color="#5E7FE5" name="Sarah Park" />);
    expect(getByLabelText("Sarah Park")).toBeTruthy();
  });

  it("renders at the requested size", () => {
    const { getByTestId } = render(<Avatar label="SP" color="#5E7FE5" size="lg" testID="av" />);
    const node = getByTestId("av");
    expect(node.props.style).toMatchObject({ width: 48, height: 48 });
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run:

```bash
npm run test --workspace=apps/mobile -- Avatar
```

Expected: FAIL — `Cannot find module './Avatar'`.

- [ ] **Step 3: Implement `apps/mobile/components/ui/Avatar.tsx`**

```tsx
import { useEffect } from "react";
import { Text, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { light, heatmapPulseMs } from "@bonfire/ui-tokens";

export type AvatarSize = "xs" | "sm" | "md" | "lg";

export interface AvatarProps {
  label: string;
  color: string;
  size?: AvatarSize;
  live?: boolean;
  name?: string;
  testID?: string;
}

const sizeMap: Record<AvatarSize, { box: number; font: number }> = {
  xs: { box: 24, font: 9 },
  sm: { box: 32, font: 11 },
  md: { box: 40, font: 13 },
  lg: { box: 48, font: 16 },
};

export function Avatar({
  label,
  color,
  size = "md",
  live = false,
  name,
  testID,
}: AvatarProps) {
  const { box, font } = sizeMap[size];
  const text = label.slice(0, 2).toUpperCase();

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!live) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: heatmapPulseMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [live, pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + pulse.value * 0.24,
    transform: [{ scale: 1.15 + pulse.value * 0.08 }],
  }));

  const accessibilityLabel = name ?? `${text} avatar`;

  const containerStyle: ViewStyle = {
    width: box,
    height: box,
    borderRadius: box / 2,
    backgroundColor: color,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: light.hearth,
  };

  return (
    <View accessibilityLabel={accessibilityLabel}>
      {live ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: -box * 0.1,
              top: -box * 0.1,
              width: box * 1.2,
              height: box * 1.2,
              borderRadius: box * 0.6,
              backgroundColor: light.emberGlow,
            },
            haloStyle,
          ]}
        />
      ) : null}
      <View style={containerStyle} testID={testID}>
        <Text
          style={{
            color: light.hearth,
            fontFamily: "Switzer-Semibold",
            fontSize: font,
            includeFontPadding: false,
          }}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run test, confirm pass**

Run:

```bash
npm run test --workspace=apps/mobile -- Avatar
```

Expected: 5 passing tests.

- [ ] **Step 5: Update barrel `apps/mobile/components/ui/index.ts`**

Replace contents with:

```ts
export { Avatar, type AvatarProps, type AvatarSize } from "./Avatar";
```

- [ ] **Step 6: Add a preview section**

In `apps/mobile/app/components-preview.tsx`, import the component at the top:

```tsx
import { Avatar } from "../components/ui";
```

And append a section inside the `<ScrollView>` body, after the Typography section:

```tsx
<Section title="Avatar">
  <View className="flex-row items-center gap-3">
    <Avatar label="SP" color="#5E7FE5" size="xs" />
    <Avatar label="JP" color="#1A9E75" size="sm" />
    <Avatar label="M" color="#9D5BC2" size="md" />
    <Avatar label="LK" color="#E2843D" size="lg" name="Lydia Kim" />
  </View>
  <View className="flex-row items-center gap-3">
    <Avatar label="SP" color="#5E7FE5" size="md" live />
    <Avatar label="K" color="#E2B33D" size="md" live />
    <Avatar label="Sarah" color="#9D5BC2" size="md" live />
  </View>
</Section>
```

- [ ] **Step 7: Visual verification**

Reload the app. Open `/components-preview`. Confirm:
- Four avatars in row 1, increasing in size, white ring, distinct background colors, two-letter labels in white.
- Three live avatars in row 2 with a slow, breathing ember-glow halo (~3 second cycle). The halo should look continuous, not stuttery.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/components/ui/Avatar.tsx apps/mobile/components/ui/Avatar.test.tsx apps/mobile/components/ui/index.ts apps/mobile/app/components-preview.tsx
git commit -m "feat(ui): Avatar with breathing live halo"
```

---

## Task 8: AvatarStack component

**Files:**
- Create: `apps/mobile/components/ui/AvatarStack.tsx`
- Create: `apps/mobile/components/ui/AvatarStack.test.tsx`
- Modify: `apps/mobile/components/ui/index.ts`
- Modify: `apps/mobile/app/components-preview.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/mobile/components/ui/AvatarStack.test.tsx`:

```tsx
import { render } from "@testing-library/react-native";
import { AvatarStack } from "./AvatarStack";

const items = [
  { label: "SP", color: "#5E7FE5" },
  { label: "JP", color: "#1A9E75" },
  { label: "M", color: "#9D5BC2" },
  { label: "LK", color: "#E2843D" },
  { label: "K", color: "#E2B33D" },
];

describe("AvatarStack", () => {
  it("renders the first N avatars and a +N overflow chip when over the cap", () => {
    const { getByText } = render(<AvatarStack avatars={items} max={3} />);
    expect(getByText("SP")).toBeTruthy();
    expect(getByText("JP")).toBeTruthy();
    expect(getByText("M")).toBeTruthy();
    expect(getByText("+2")).toBeTruthy();
  });

  it("renders all avatars without an overflow chip when under the cap", () => {
    const { queryByText } = render(<AvatarStack avatars={items.slice(0, 2)} max={4} />);
    expect(queryByText("SP")).toBeTruthy();
    expect(queryByText("JP")).toBeTruthy();
    expect(queryByText(/^\+/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run:

```bash
npm run test --workspace=apps/mobile -- AvatarStack
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/mobile/components/ui/AvatarStack.tsx`**

```tsx
import { Text, View } from "react-native";
import { Avatar, type AvatarSize } from "./Avatar";
import { light } from "@bonfire/ui-tokens";

export interface AvatarStackItem {
  label: string;
  color: string;
  name?: string;
  live?: boolean;
}

export interface AvatarStackProps {
  avatars: AvatarStackItem[];
  max?: number;
  size?: AvatarSize;
}

const overlapMap: Record<AvatarSize, number> = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 14,
};

const overflowSize: Record<AvatarSize, { box: number; font: number }> = {
  xs: { box: 24, font: 9 },
  sm: { box: 32, font: 10 },
  md: { box: 40, font: 12 },
  lg: { box: 48, font: 14 },
};

export function AvatarStack({ avatars, max = 4, size = "md" }: AvatarStackProps) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - visible.length;
  const overlap = overlapMap[size];
  const { box, font } = overflowSize[size];

  return (
    <View className="flex-row">
      {visible.map((a, i) => (
        <View
          key={`${a.label}-${i}`}
          style={{ marginLeft: i === 0 ? 0 : -overlap }}
        >
          <Avatar label={a.label} color={a.color} size={size} name={a.name} live={a.live} />
        </View>
      ))}
      {overflow > 0 ? (
        <View
          style={{
            marginLeft: -overlap,
            width: box,
            height: box,
            borderRadius: box / 2,
            backgroundColor: light.smoke,
            borderWidth: 2,
            borderColor: light.hearth,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: light.hearth,
              fontFamily: "Switzer-Semibold",
              fontSize: font,
              includeFontPadding: false,
            }}
          >
            +{overflow}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npm run test --workspace=apps/mobile -- AvatarStack
```

Expected: 2 passing tests.

- [ ] **Step 5: Update barrel**

Append to `apps/mobile/components/ui/index.ts`:

```ts
export { AvatarStack, type AvatarStackProps, type AvatarStackItem } from "./AvatarStack";
```

- [ ] **Step 6: Add preview section**

In `apps/mobile/app/components-preview.tsx`, update the imports:

```tsx
import { Avatar, AvatarStack } from "../components/ui";
```

Append after the Avatar section:

```tsx
<Section title="Avatar stack">
  <AvatarStack
    avatars={[
      { label: "SP", color: "#5E7FE5" },
      { label: "JP", color: "#1A9E75" },
      { label: "M", color: "#9D5BC2" },
      { label: "LK", color: "#E2843D" },
      { label: "K", color: "#E2B33D" },
      { label: "A", color: "#7BB968" },
    ]}
    max={4}
  />
</Section>
```

- [ ] **Step 7: Visual verification**

Reload. Expect four overlapping avatars and a "+2" smoke pill at the end with a white ring matching the avatars.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/components/ui/AvatarStack.tsx apps/mobile/components/ui/AvatarStack.test.tsx apps/mobile/components/ui/index.ts apps/mobile/app/components-preview.tsx
git commit -m "feat(ui): AvatarStack with overflow chip"
```

---

## Task 9: Chip component

**Files:**
- Create: `apps/mobile/components/ui/Chip.tsx`
- Create: `apps/mobile/components/ui/Chip.test.tsx`
- Modify: `apps/mobile/components/ui/index.ts`
- Modify: `apps/mobile/app/components-preview.tsx`

Spec: Pill button. Variants `solid` (ember), `outline`, `ghost`. Sizes `sm/md`. Optional left icon (React node).

- [ ] **Step 1: Write failing test**

```tsx
// apps/mobile/components/ui/Chip.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { Chip } from "./Chip";

describe("Chip", () => {
  it("renders its label", () => {
    const { getByText } = render(<Chip label="People" />);
    expect(getByText("People")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    const { getByText } = render(<Chip label="Tonight" onPress={onPress} />);
    fireEvent.press(getByText("Tonight"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses solid variant when selected", () => {
    const { getByTestId } = render(
      <Chip label="Now" variant="solid" testID="chip" />,
    );
    expect(getByTestId("chip").props.style).toEqual(
      expect.objectContaining({ backgroundColor: expect.any(String) }),
    );
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npm run test --workspace=apps/mobile -- Chip
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/mobile/components/ui/Chip.tsx`**

```tsx
import { Pressable, Text, View, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { light } from "@bonfire/ui-tokens";

export type ChipVariant = "solid" | "outline" | "ghost";
export type ChipSize = "sm" | "md";

export interface ChipProps {
  label: string;
  variant?: ChipVariant;
  size?: ChipSize;
  onPress?: () => void;
  leftIcon?: React.ReactNode;
  disabled?: boolean;
  testID?: string;
}

const sizes: Record<ChipSize, { paddingV: number; paddingH: number; font: number }> = {
  sm: { paddingV: 6, paddingH: 10, font: 11 },
  md: { paddingV: 8, paddingH: 14, font: 13 },
};

export function Chip({
  label,
  variant = "outline",
  size = "md",
  onPress,
  leftIcon,
  disabled,
  testID,
}: ChipProps) {
  const sz = sizes[size];

  const bg =
    variant === "solid" ? light.ember
    : variant === "outline" ? light.hearth
    : "transparent";
  const fg =
    variant === "solid" ? light.hearth
    : variant === "outline" ? light.coal
    : light.smoke;
  const borderColor =
    variant === "outline" ? light.ash : "transparent";

  const style: ViewStyle = {
    backgroundColor: bg,
    paddingVertical: sz.paddingV,
    paddingHorizontal: sz.paddingH,
    borderRadius: 999,
    borderWidth: variant === "outline" ? 1 : 0,
    borderColor,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    opacity: disabled ? 0.5 : 1,
  };

  const handlePress = () => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={style}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {leftIcon ? <View style={{ marginRight: 4 }}>{leftIcon}</View> : null}
      <Text style={{ color: fg, fontFamily: "Switzer-Medium", fontSize: sz.font }}>
        {label}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npm run test --workspace=apps/mobile -- Chip
```

Expected: 3 passing tests.

- [ ] **Step 5: Update barrel**

Append to `apps/mobile/components/ui/index.ts`:

```ts
export { Chip, type ChipProps, type ChipVariant, type ChipSize } from "./Chip";
```

- [ ] **Step 6: Add preview**

Update the import in `components-preview.tsx` and append:

```tsx
<Section title="Chip">
  <View className="flex-row gap-2 flex-wrap">
    <Chip label="People" variant="solid" />
    <Chip label="Events" />
    <Chip label="Available now" />
    <Chip label="Ghost" variant="ghost" />
    <Chip label="Disabled" disabled />
  </View>
</Section>
```

- [ ] **Step 7: Visual verification**

Reload. Confirm: ember solid chip, two outline chips with ash border, one ghost chip in smoke, one disabled at 50% opacity. Tapping any non-disabled chip on a real device triggers a soft haptic.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/components/ui/Chip.tsx apps/mobile/components/ui/Chip.test.tsx apps/mobile/components/ui/index.ts apps/mobile/app/components-preview.tsx
git commit -m "feat(ui): Chip in solid/outline/ghost variants"
```

---

## Task 10: Card component

**Files:**
- Create: `apps/mobile/components/ui/Card.tsx`
- Modify: `apps/mobile/components/ui/index.ts`
- Modify: `apps/mobile/app/components-preview.tsx`

Card is structural; one test asserting it renders children and the press-spring on `interactive` is enough.

- [ ] **Step 1: Write failing test `apps/mobile/components/ui/Card.test.tsx`**

```tsx
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children", () => {
    const { getByText } = render(
      <Card><Text>contents</Text></Card>,
    );
    expect(getByText("contents")).toBeTruthy();
  });

  it("calls onPress when interactive and pressed", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Card interactive onPress={onPress} testID="card">
        <Text>tap me</Text>
      </Card>,
    );
    fireEvent.press(getByTestId("card"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm run test --workspace=apps/mobile -- Card
```

- [ ] **Step 3: Implement `apps/mobile/components/ui/Card.tsx`**

```tsx
import { Pressable, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { houseSpring, light, radius } from "@bonfire/ui-tokens";

export interface CardProps {
  children: React.ReactNode;
  interactive?: boolean;
  onPress?: () => void;
  padding?: number;
  testID?: string;
}

const baseStyle: ViewStyle = {
  backgroundColor: light.hearth,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: light.ash,
};

export function Card({
  children,
  interactive = false,
  onPress,
  padding = 16,
  testID,
}: CardProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!interactive) {
    return (
      <View style={[baseStyle, { padding }]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <Animated.View style={animated}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.98, houseSpring); }}
        onPressOut={() => { scale.value = withSpring(1, houseSpring); }}
        onPress={onPress}
        style={[baseStyle, { padding }]}
        testID={testID}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm run test --workspace=apps/mobile -- Card
```

- [ ] **Step 5: Update barrel**

Append:

```ts
export { Card, type CardProps } from "./Card";
```

- [ ] **Step 6: Add preview**

Update imports and append:

```tsx
<Section title="Card">
  <Card>
    <Text style={{ fontFamily: "Switzer-Medium", fontSize: 15, color: light.coal }}>
      Static card. Hearth surface, ash border.
    </Text>
  </Card>
  <Card interactive onPress={() => {}}>
    <Text style={{ fontFamily: "Switzer-Medium", fontSize: 15, color: light.coal }}>
      Interactive card — taps spring-scale.
    </Text>
  </Card>
</Section>
```

You'll need to also `import { light } from "@bonfire/ui-tokens";` at the top of the preview file.

- [ ] **Step 7: Visual verification**

Reload. Confirm: two cards, the second one springs slightly inward when pressed and returns smoothly.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/components/ui/Card.tsx apps/mobile/components/ui/Card.test.tsx apps/mobile/components/ui/index.ts apps/mobile/app/components-preview.tsx
git commit -m "feat(ui): Card with press-spring on interactive"
```

---

## Task 11: CTAButton component

**Files:**
- Create: `apps/mobile/components/ui/CTAButton.tsx`
- Create: `apps/mobile/components/ui/CTAButton.test.tsx`
- Modify: `apps/mobile/components/ui/index.ts`
- Modify: `apps/mobile/app/components-preview.tsx`

Spec: full-width ember pill, 56px tall, optional flame icon, haptic on press.

- [ ] **Step 1: Write failing test**

```tsx
// apps/mobile/components/ui/CTAButton.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { CTAButton } from "./CTAButton";

describe("CTAButton", () => {
  it("renders its label", () => {
    const { getByText } = render(<CTAButton label="Go live" onPress={() => {}} />);
    expect(getByText("Go live")).toBeTruthy();
  });

  it("fires onPress", () => {
    const onPress = jest.fn();
    const { getByText } = render(<CTAButton label="Continue" onPress={onPress} />);
    fireEvent.press(getByText("Continue"));
    expect(onPress).toHaveBeenCalled();
  });

  it("does not fire onPress when disabled", () => {
    const onPress = jest.fn();
    const { getByText } = render(<CTAButton label="Off" onPress={onPress} disabled />);
    fireEvent.press(getByText("Off"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm run test --workspace=apps/mobile -- CTAButton
```

- [ ] **Step 3: Implement `apps/mobile/components/ui/CTAButton.tsx`**

```tsx
import { Pressable, Text, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { houseSpring, light } from "@bonfire/ui-tokens";

export type CTAVariant = "primary" | "outline";

export interface CTAButtonProps {
  label: string;
  onPress: () => void;
  variant?: CTAVariant;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  testID?: string;
}

export function CTAButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  leftIcon,
  rightIcon,
  testID,
}: CTAButtonProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bg = variant === "primary" ? light.ember : light.hearth;
  const fg = variant === "primary" ? light.hearth : light.ember;
  const borderColor = variant === "primary" ? "transparent" : light.ember;

  const style: ViewStyle = {
    height: 56,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: bg,
    borderWidth: variant === "outline" ? 1.5 : 0,
    borderColor,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <Animated.View style={animated}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPressIn={() => { if (!disabled) scale.value = withSpring(0.97, houseSpring); }}
        onPressOut={() => { scale.value = withSpring(1, houseSpring); }}
        onPress={() => {
          if (disabled) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress();
        }}
        style={style}
        testID={testID}
      >
        {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}
        <Text style={{ color: fg, fontFamily: "Switzer-Semibold", fontSize: 17 }}>
          {label}
        </Text>
        {rightIcon ? <View style={{ marginLeft: 8 }}>{rightIcon}</View> : null}
      </Pressable>
    </Animated.View>
  );
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm run test --workspace=apps/mobile -- CTAButton
```

- [ ] **Step 5: Update barrel**

Append:

```ts
export { CTAButton, type CTAButtonProps, type CTAVariant } from "./CTAButton";
```

- [ ] **Step 6: Add preview**

```tsx
<Section title="CTA button">
  <CTAButton label="Go live" onPress={() => {}} />
  <CTAButton label="Drop a pin" onPress={() => {}} variant="outline" />
  <CTAButton label="Disabled" onPress={() => {}} disabled />
</Section>
```

- [ ] **Step 7: Visual verification**

Reload. Confirm: full-width ember primary, ember-bordered outline, faded disabled. Pressing primary on device feels a light haptic.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/components/ui/CTAButton.tsx apps/mobile/components/ui/CTAButton.test.tsx apps/mobile/components/ui/index.ts apps/mobile/app/components-preview.tsx
git commit -m "feat(ui): CTAButton primary/outline with haptic"
```

---

## Task 12: LiveDot component

**Files:**
- Create: `apps/mobile/components/ui/LiveDot.tsx`
- Modify: `apps/mobile/components/ui/index.ts`
- Modify: `apps/mobile/app/components-preview.tsx`

Spec: 6px spark-colored circle with a 2px outer ring. Pulses if `pulse` prop set.

- [ ] **Step 1: Implement `apps/mobile/components/ui/LiveDot.tsx`**

(LiveDot is simple enough that we skip a test — visual verification is sufficient. The Avatar `live` halo logic is already tested via the Avatar tests.)

```tsx
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { light, heatmapPulseMs } from "@bonfire/ui-tokens";

export interface LiveDotProps {
  color?: string;
  size?: number;
  pulse?: boolean;
}

export function LiveDot({
  color = light.spark,
  size = 8,
  pulse = false,
}: LiveDotProps) {
  const ring = size + 4;
  const p = useSharedValue(0);
  useEffect(() => {
    if (!pulse) {
      cancelAnimation(p);
      p.value = 0;
      return;
    }
    p.value = withRepeat(
      withTiming(1, { duration: heatmapPulseMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(p);
  }, [pulse, p]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.15 + p.value * 0.25,
    transform: [{ scale: 1 + p.value * 0.6 }],
  }));

  return (
    <View style={{ width: ring, height: ring, alignItems: "center", justifyContent: "center" }}>
      {pulse ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              width: ring,
              height: ring,
              borderRadius: ring / 2,
              backgroundColor: color,
            },
            halo,
          ]}
        />
      ) : null}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: 2,
          borderColor: light.hearth,
        }}
      />
    </View>
  );
}
```

- [ ] **Step 2: Update barrel**

```ts
export { LiveDot, type LiveDotProps } from "./LiveDot";
```

- [ ] **Step 3: Add preview**

```tsx
<Section title="Live dot">
  <View className="flex-row items-center gap-4">
    <LiveDot />
    <LiveDot pulse />
    <LiveDot color={light.ember} pulse />
    <LiveDot size={12} pulse />
  </View>
</Section>
```

- [ ] **Step 4: Visual verification**

Reload. Confirm: four dots — first static spark green, second pulsing spark, third pulsing ember, fourth larger pulsing spark. Pulses look continuous.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/ui/LiveDot.tsx apps/mobile/components/ui/index.ts apps/mobile/app/components-preview.tsx
git commit -m "feat(ui): LiveDot with optional pulse halo"
```

---

## Task 13: BonfireScore component

**Files:**
- Create: `apps/mobile/components/ui/BonfireScore.tsx`
- Create: `apps/mobile/components/ui/BonfireScore.test.tsx`
- Modify: `apps/mobile/components/ui/index.ts`
- Modify: `apps/mobile/app/components-preview.tsx`

Spec: the number-in-pill from Venue Detail. Sentient display-lg, ember fill, animated digit count on change.

- [ ] **Step 1: Write failing test**

```tsx
// apps/mobile/components/ui/BonfireScore.test.tsx
import { render } from "@testing-library/react-native";
import { BonfireScore } from "./BonfireScore";

describe("BonfireScore", () => {
  it("renders the score and label", () => {
    const { getByText } = render(<BonfireScore score={87} />);
    expect(getByText("87")).toBeTruthy();
    expect(getByText("BONFIRE")).toBeTruthy();
  });

  it("clamps to 0..99", () => {
    const { getByText, rerender } = render(<BonfireScore score={150} />);
    expect(getByText("99")).toBeTruthy();
    rerender(<BonfireScore score={-5} />);
    expect(getByText("0")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm run test --workspace=apps/mobile -- BonfireScore
```

- [ ] **Step 3: Implement `apps/mobile/components/ui/BonfireScore.tsx`**

```tsx
import { Text, View } from "react-native";
import { light } from "@bonfire/ui-tokens";

export interface BonfireScoreProps {
  score: number;
  size?: "md" | "lg";
}

const sizes = {
  md: { box: 56, number: 22, label: 9 },
  lg: { box: 72, number: 28, label: 10 },
} as const;

export function BonfireScore({ score, size = "md" }: BonfireScoreProps) {
  const clamped = Math.max(0, Math.min(99, Math.round(score)));
  const s = sizes[size];

  return (
    <View
      accessibilityLabel={`Bonfire score ${clamped} of 99`}
      style={{
        minWidth: s.box,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: light.ember,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: light.hearth,
          fontFamily: "Sentient-Regular",
          fontSize: s.number,
          lineHeight: s.number + 2,
          includeFontPadding: false,
        }}
      >
        {clamped}
      </Text>
      <Text
        style={{
          color: light.hearth,
          fontFamily: "Switzer-Medium",
          fontSize: s.label,
          lineHeight: s.label + 2,
          letterSpacing: 1,
          opacity: 0.9,
          marginTop: 2,
          includeFontPadding: false,
        }}
      >
        BONFIRE
      </Text>
    </View>
  );
}
```

Note: animated digit count is deferred — it's a polish item for Milestone 11. The MVP shape is what matters here.

- [ ] **Step 4: Run, confirm pass**

```bash
npm run test --workspace=apps/mobile -- BonfireScore
```

- [ ] **Step 5: Update barrel**

```ts
export { BonfireScore, type BonfireScoreProps } from "./BonfireScore";
```

- [ ] **Step 6: Add preview**

```tsx
<Section title="Bonfire score">
  <View className="flex-row gap-3 items-center">
    <BonfireScore score={87} />
    <BonfireScore score={62} />
    <BonfireScore score={99} size="lg" />
    <BonfireScore score={0} />
  </View>
</Section>
```

- [ ] **Step 7: Visual verification**

Reload. Four ember pills, Sentient numerals stacked over an uppercase "BONFIRE" overline. The 99/lg pill is bigger; the 0 pill renders cleanly.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/components/ui/BonfireScore.tsx apps/mobile/components/ui/BonfireScore.test.tsx apps/mobile/components/ui/index.ts apps/mobile/app/components-preview.tsx
git commit -m "feat(ui): BonfireScore pill"
```

---

## Task 14: IntentBadge component

**Files:**
- Create: `apps/mobile/components/ui/IntentBadge.tsx`
- Modify: `apps/mobile/components/ui/index.ts`
- Modify: `apps/mobile/app/components-preview.tsx`

Spec: Pill carrying intent state with its icon and color (Available/Today/Tonight). This is the visual anchor inside Go Live intent cards (replacement for the banned left-border accent).

- [ ] **Step 1: Implement `apps/mobile/components/ui/IntentBadge.tsx`**

```tsx
import { Text, View } from "react-native";
import { light } from "@bonfire/ui-tokens";
import { Ionicons } from "@expo/vector-icons";

export type Intent = "available_now" | "out_today" | "out_tonight";

export interface IntentBadgeProps {
  intent: Intent;
  size?: "sm" | "md";
}

const intentMeta: Record<Intent, { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  available_now: { color: light.spark, icon: "ellipse", label: "Available now" },
  out_today:     { color: light.dusk,  icon: "sunny",   label: "Out today" },
  out_tonight:   { color: light.night, icon: "moon",    label: "Out tonight" },
};

const sizes = {
  sm: { box: 28, icon: 14, font: 11 },
  md: { box: 32, icon: 16, font: 13 },
} as const;

export function IntentBadge({ intent, size = "md" }: IntentBadgeProps) {
  const meta = intentMeta[intent];
  const s = sizes[size];

  return (
    <View className="flex-row items-center gap-2" accessibilityLabel={meta.label}>
      <View
        style={{
          width: s.box,
          height: s.box,
          borderRadius: s.box / 2,
          backgroundColor: meta.color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={meta.icon} size={s.icon} color={light.hearth} />
      </View>
      <Text style={{ fontFamily: "Switzer-Semibold", fontSize: s.font, color: light.coal }}>
        {meta.label}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Update barrel**

```ts
export { IntentBadge, type IntentBadgeProps, type Intent } from "./IntentBadge";
```

- [ ] **Step 3: Add preview**

```tsx
<Section title="Intent badge">
  <IntentBadge intent="available_now" />
  <IntentBadge intent="out_today" />
  <IntentBadge intent="out_tonight" />
</Section>
```

- [ ] **Step 4: Visual verification**

Reload. Three rows, each with a colored badge (spark/dusk/night) + label. Confirm icons render — if you see a missing-character box, `@expo/vector-icons` font isn't loaded; check that Expo Router 6 auto-loads it (it should — if not, add `Ionicons.font` to `useLoadFonts.ts`).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/ui/IntentBadge.tsx apps/mobile/components/ui/index.ts apps/mobile/app/components-preview.tsx
git commit -m "feat(ui): IntentBadge (replaces banned left-border accent)"
```

---

## Task 15: EmptyState component

**Files:**
- Create: `apps/mobile/components/ui/EmptyState.tsx`
- Create: `apps/mobile/components/ui/EmptyState.test.tsx`
- Modify: `apps/mobile/components/ui/index.ts`
- Modify: `apps/mobile/app/components-preview.tsx`

Spec: illustration + headline + one CTA. Required `nextGesture` prop documenting what gesture this empty state is teaching. Mostly typographic — the illustration slot is filled by a React node we pass in.

- [ ] **Step 1: Write failing test**

```tsx
// apps/mobile/components/ui/EmptyState.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders headline and body", () => {
    const { getByText } = render(
      <EmptyState
        headline="Quiet out there."
        body="Be the first."
        nextGesture="go-live"
      />,
    );
    expect(getByText("Quiet out there.")).toBeTruthy();
    expect(getByText("Be the first.")).toBeTruthy();
  });

  it("renders an optional CTA and fires its handler", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <EmptyState
        headline="No notifications yet."
        body="When friends go out, they show up here."
        nextGesture="passive-wait"
        cta={{ label: "Go live", onPress }}
      />,
    );
    fireEvent.press(getByText("Go live"));
    expect(onPress).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm run test --workspace=apps/mobile -- EmptyState
```

- [ ] **Step 3: Implement `apps/mobile/components/ui/EmptyState.tsx`**

```tsx
import { Text, View } from "react-native";
import { CTAButton } from "./CTAButton";
import { light } from "@bonfire/ui-tokens";

export interface EmptyStateProps {
  /** A short, human description of which gesture this empty state should teach. */
  nextGesture: string;
  headline: string;
  body: string;
  illustration?: React.ReactNode;
  cta?: { label: string; onPress: () => void };
}

export function EmptyState({ headline, body, illustration, cta }: EmptyStateProps) {
  return (
    <View className="items-center px-6 py-10 gap-4">
      {illustration ? <View>{illustration}</View> : null}
      <Text
        style={{
          fontFamily: "Sentient-RegularItalic",
          fontSize: 22,
          lineHeight: 28,
          color: light.coal,
          textAlign: "center",
        }}
      >
        {headline}
      </Text>
      <Text
        style={{
          fontFamily: "Switzer-Regular",
          fontSize: 15,
          lineHeight: 22,
          color: light.smoke,
          textAlign: "center",
          maxWidth: 320,
        }}
      >
        {body}
      </Text>
      {cta ? (
        <View style={{ width: "100%", marginTop: 8 }}>
          <CTAButton label={cta.label} onPress={cta.onPress} />
        </View>
      ) : null}
    </View>
  );
}
```

(The `nextGesture` prop is documentation — it's required at the type level so writers cannot ship an empty state without thinking about the gesture, but it does not need to render.)

- [ ] **Step 4: Run, confirm pass**

```bash
npm run test --workspace=apps/mobile -- EmptyState
```

- [ ] **Step 5: Update barrel**

```ts
export { EmptyState, type EmptyStateProps } from "./EmptyState";
```

- [ ] **Step 6: Add preview**

```tsx
<Section title="Empty state">
  <EmptyState
    nextGesture="go-live"
    headline="Quiet out there."
    body="Be the first to go live. Your circles will see you on the map."
    cta={{ label: "Go live", onPress: () => {} }}
  />
</Section>
```

- [ ] **Step 7: Visual verification**

Reload. Confirm: Sentient italic headline centered, Switzer body underneath, ember CTA below — all centered on the cream background.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/components/ui/EmptyState.tsx apps/mobile/components/ui/EmptyState.test.tsx apps/mobile/components/ui/index.ts apps/mobile/app/components-preview.tsx
git commit -m "feat(ui): EmptyState with required nextGesture annotation"
```

---

## Task 16: End-to-end visual pass and README

**Files:**
- Create: `apps/mobile/components/ui/README.md`
- Modify: `apps/mobile/app/components-preview.tsx` (final ordering pass)

- [ ] **Step 1: Reorder preview sections**

Open `apps/mobile/app/components-preview.tsx`. Reorder the sections inside the ScrollView in this order, so the document reads coherently top to bottom:

1. Typography
2. Live dot
3. Avatar
4. Avatar stack
5. Intent badge
6. Bonfire score
7. Chip
8. Card
9. CTA button
10. Empty state

If any section is missing from any prior task, add it now using the snippet from that task.

- [ ] **Step 2: Write `apps/mobile/components/ui/README.md`**

```markdown
# UI components

Base components for the Bonfire iOS app. Each is composed only from React Native primitives, Reanimated 3, and `@bonfire/ui-tokens`. No Skia, no MapLibre — those land in later milestones.

To preview every component visually, run the app and open `/components-preview`.

| Component | Spec |
|---|---|
| `Avatar` | Letter-pair on a tinted circle. Breathing halo when `live`. |
| `AvatarStack` | Overlapping avatars with `+N` overflow chip. |
| `Chip` | Pill button. `solid` / `outline` / `ghost`. |
| `Card` | Hearth surface, ash border, optional press-spring on `interactive`. |
| `CTAButton` | Full-width 56px pill, primary or outline, haptic on press. |
| `LiveDot` | 6px spark/ember dot with optional pulsing halo. |
| `BonfireScore` | Ember pill with Sentient numeral and `BONFIRE` overline. |
| `IntentBadge` | Circular intent icon + label. Replaces the banned left-border accent. |
| `EmptyState` | Centered headline + body + optional CTA. Requires a `nextGesture` annotation. |

## Design system rules

- Colors come from `@bonfire/ui-tokens` (`light`, `night`). Do not write hex values in component files.
- Typography uses the registered font names: `Sentient-Regular`, `Sentient-RegularItalic`, `Sentient-Medium`, `Switzer-Regular`, `Switzer-Medium`, `Switzer-Semibold`, `FragmentMono-Regular`.
- Motion uses the house spring from `@bonfire/ui-tokens` (`mass:1, damping:22, stiffness:220`). Long-running pulses use `heatmapPulseMs` and sine easing.
- No `border-left`/`border-right` accent stripes >1px anywhere. See `.impeccable.md`.
```

- [ ] **Step 3: Run all tests**

```bash
npm run test --workspace=apps/mobile
```

Expected: every test from Tasks 7, 8, 9, 10, 11, 13, 15 passes. Approximately 16-18 tests total.

- [ ] **Step 4: Run lint**

```bash
npm run lint --workspace=apps/mobile
```

Expected: clean (or only style warnings — no errors). Fix any errors before continuing.

- [ ] **Step 5: Build the app on iOS simulator end-to-end**

```bash
npm run start --workspace=apps/mobile
```

Walk through the preview route and visually confirm every component renders. Specifically:
- All custom fonts load (no system font fallback anywhere).
- The Avatar live halo and LiveDot pulse animate smoothly.
- Card press-spring on the interactive variant feels snappy, not stuttery.
- CTAButton primary press fires a haptic on a physical device.
- No red-box errors in the Metro console.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/ui/README.md apps/mobile/app/components-preview.tsx
git commit -m "docs(ui): README and final preview ordering"
```

- [ ] **Step 7: Final verification commit**

If everything looks right, the milestone is done. Tag the commit:

```bash
git tag milestone-0-design-system
```

(Do not push the tag; just mark the local commit. Pushing tags requires user approval — see global instructions.)

---

## Self-Review

Spec coverage check against `docs/superpowers/specs/2026-05-16-bonfire-mvp-design.md` §4 (Design System) and Milestone 0 in §8:

- **Fonts loaded**: ✓ Task 4.
- **Color tokens (OKLCH-derived)**: ✓ Task 2.
- **Spacing tokens**: ✓ Task 3.
- **Type scale**: ✓ Task 3 + the typography preview section in Task 6.
- **Motion tokens (house spring)**: ✓ Task 3. Used in Card and CTAButton presses.
- **Base components per spec §4.4**:
  - `Avatar` ✓ Task 7
  - `AvatarStack` ✓ Task 8
  - `Chip` ✓ Task 9
  - `Card` ✓ Task 10 (no left-border accent ✓)
  - `CTAButton` ✓ Task 11
  - `BonfireScore` ✓ Task 13
  - `LiveDot` ✓ Task 12
  - `IntentBadge` ✓ Task 14 (replaces banned left-border accent ✓)
  - `EmptyState` ✓ Task 15 (with required nextGesture ✓)
  - `HeatmapPulse` — deferred to Milestone 5 (needs Skia; called out in Scope notes)
  - `MapAvatarPin` — deferred to Milestone 5 (needs MapLibre; called out in Scope notes)
  - `BottomSheet` — deferred to Milestone 4 (first consumer is Go Live; called out in Scope notes)
- **`/components-preview` route**: ✓ Task 6 + appended in 7–15 + finalized in 16.
- **NativeWind config**: ✓ Task 5.

Type consistency check:
- `AvatarSize` defined in Avatar.tsx, re-used in AvatarStack.tsx. ✓
- `Intent` type defined in IntentBadge.tsx. The spec's Go Live screen also uses Intent — Milestone 4 will move it to `@bonfire/shared` or re-export from the IntentBadge module. Flagged here so Milestone 4 doesn't re-define it.
- All components import colors via `@bonfire/ui-tokens` — none hardcode hex. ✓

Placeholder scan:
- Animated digit count on `BonfireScore` is explicitly deferred to Milestone 11 (polish pass) — called out in-line in Task 13 step 3. Not a TODO; a documented decision.
- No "TBD"/"TODO"/"similar to" patterns elsewhere.

Scope check:
- One milestone, one demonstrable deliverable (the preview route). Independent of every other milestone — Milestones 1 and 2 can begin in parallel branches after this lands.

---
