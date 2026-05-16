// Fonts come from Google Fonts via the @expo-google-fonts/* packages.
// Source Serif 4 stands in for the spec's "Sentient" (warm modern serif).
// Onest stands in for "Switzer" (warm humanist sans).
// Geist Mono is the technical mono accent.
// Swap to FontShare's Sentient/Switzer once you have local .otf files.

export const fontFamily = {
  displayRegular: "SourceSerif4_400Regular",
  displayItalic: "SourceSerif4_400Regular_Italic",
  displayMedium: "SourceSerif4_500Medium",
  displaySemibold: "SourceSerif4_600SemiBold",
  bodyRegular: "Onest_400Regular",
  bodyMedium: "Onest_500Medium",
  bodySemibold: "Onest_600SemiBold",
  monoRegular: "GeistMono_400Regular",
} as const;

export type FontFamily = (typeof fontFamily)[keyof typeof fontFamily];

export const typeScale = {
  displayXl: { fontSize: 34, lineHeight: 40, family: fontFamily.displayItalic },
  displayLg: { fontSize: 28, lineHeight: 34, family: fontFamily.displayRegular },
  title:     { fontSize: 22, lineHeight: 28, family: fontFamily.displayMedium },
  bodyLg:    { fontSize: 17, lineHeight: 24, family: fontFamily.bodyRegular },
  body:      { fontSize: 15, lineHeight: 22, family: fontFamily.bodyRegular },
  bodySm:    { fontSize: 13, lineHeight: 18, family: fontFamily.bodyMedium },
  monoSm:    { fontSize: 12, lineHeight: 16, family: fontFamily.monoRegular },
  overline:  { fontSize: 11, lineHeight: 14, family: fontFamily.bodyMedium },
} as const;

export type TypeScaleKey = keyof typeof typeScale;
