import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { light } from "@bonfire/ui-tokens";
import type { Intent } from "@bonfire/shared";

export interface IntentBadgeProps {
  intent: Intent;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export const intentMeta: Record<
  Intent,
  { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }
> = {
  available_now: { color: light.spark, icon: "ellipse", label: "Available now" },
  out_today:     { color: light.dusk,  icon: "sunny",   label: "Out today" },
  out_tonight:   { color: light.night, icon: "moon",    label: "Out tonight" },
};

const sizes = {
  sm: { box: 24, icon: 12, font: 11 },
  md: { box: 32, icon: 16, font: 13 },
  lg: { box: 40, icon: 20, font: 15 },
} as const;

export function IntentBadge({ intent, size = "md", showLabel = true }: IntentBadgeProps) {
  const meta = intentMeta[intent];
  const s = sizes[size];

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", columnGap: 8 }}
      accessibilityLabel={meta.label}
    >
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
      {showLabel ? (
        <Text
          style={{
            fontFamily: "Onest_600SemiBold",
            fontSize: s.font,
            color: light.coal,
          }}
        >
          {meta.label}
        </Text>
      ) : null}
    </View>
  );
}
