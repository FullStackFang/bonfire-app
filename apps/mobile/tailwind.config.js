const tokens = require("@bonfire/ui-tokens");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: tokens.colors.bg,
        "bg-raised": tokens.colors.bgRaised,
        surface: tokens.colors.surface,
        "surface-strong": tokens.colors.surfaceStrong,
        "surface-dark": tokens.colors.surfaceDark,
        border: tokens.colors.border,
        "border-strong": tokens.colors.borderStrong,
        "border-dark": tokens.colors.borderDark,
        text: tokens.colors.text,
        "text-muted": tokens.colors.textMuted,
        "text-faint": tokens.colors.textFaint,
        "text-inverse": tokens.colors.textInverse,
        "text-inverse-muted": tokens.colors.textInverseMuted,
        accent: tokens.colors.accent,
        "accent-warm": tokens.colors.accentWarm,
        "accent-glow": tokens.colors.accentGlow,
        "status-available": tokens.statusColor.available,
        "status-out": tokens.statusColor.out,
        "status-down": tokens.statusColor.down,
        "status-place": tokens.statusColor.place,
        "status-invisible": tokens.statusColor.invisible,
      },
    },
  },
  plugins: [],
};
