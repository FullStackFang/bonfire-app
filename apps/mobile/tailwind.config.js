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
        "night-ember": tokens.night.ember,
        "night-bg": tokens.night.cream,
        "night-card": tokens.night.hearth,
        "night-coal": tokens.night.coal,
        "night-smoke": tokens.night.smoke,
      },
      fontFamily: {
        "display-regular": ["SourceSerif4_400Regular"],
        "display-italic": ["SourceSerif4_400Regular_Italic"],
        "display-medium": ["SourceSerif4_500Medium"],
        "display-semi": ["SourceSerif4_600SemiBold"],
        "body-regular": ["Onest_400Regular"],
        "body-medium": ["Onest_500Medium"],
        "body-semi": ["Onest_600SemiBold"],
        "mono-regular": ["GeistMono_400Regular"],
      },
      borderRadius: {
        sm: `${tokens.radius.sm}px`,
        md: `${tokens.radius.md}px`,
        lg: `${tokens.radius.lg}px`,
        xl: `${tokens.radius.xl}px`,
        "2xl": `${tokens.radius["2xl"]}px`,
        pill: `${tokens.radius.pill}px`,
      },
    },
  },
  plugins: [],
};
