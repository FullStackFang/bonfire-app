import { Text, View } from "react-native";
import { light } from "@bonfire/ui-tokens";

export interface BonfireScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
  testID?: string;
}

const sizes = {
  sm: { padH: 8, padV: 4, number: 18, label: 8, gap: 1 },
  md: { padH: 10, padV: 6, number: 22, label: 9, gap: 2 },
  lg: { padH: 14, padV: 10, number: 30, label: 10, gap: 3 },
} as const;

export function BonfireScore({ score, size = "md", testID }: BonfireScoreProps) {
  const clamped = Math.max(0, Math.min(99, Math.round(score)));
  const s = sizes[size];

  return (
    <View
      testID={testID}
      accessibilityLabel={`Bonfire score ${clamped} of 99`}
      style={{
        paddingHorizontal: s.padH,
        paddingVertical: s.padV,
        backgroundColor: light.ember,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: light.hearth,
          fontFamily: "SourceSerif4_500Medium",
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
          fontFamily: "Onest_500Medium",
          fontSize: s.label,
          lineHeight: s.label + 2,
          letterSpacing: 1.1,
          opacity: 0.92,
          marginTop: s.gap,
          includeFontPadding: false,
        }}
      >
        BONFIRE
      </Text>
    </View>
  );
}
