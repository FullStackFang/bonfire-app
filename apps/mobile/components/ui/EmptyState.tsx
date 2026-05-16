import { Text, View } from "react-native";
import { CTAButton } from "./CTAButton";
import { light } from "@bonfire/ui-tokens";

export interface EmptyStateProps {
  /** Documents which gesture this empty state teaches. Required to force authors to think about cold-start. */
  nextGesture: string;
  headline: string;
  body: string;
  illustration?: React.ReactNode;
  cta?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}

export function EmptyState({
  headline,
  body,
  illustration,
  cta,
  secondary,
}: EmptyStateProps) {
  return (
    <View
      style={{
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 40,
        rowGap: 16,
      }}
    >
      {illustration ? <View style={{ marginBottom: 8 }}>{illustration}</View> : null}
      <Text
        style={{
          fontFamily: "SourceSerif4_400Regular_Italic",
          fontSize: 24,
          lineHeight: 30,
          color: light.coal,
          textAlign: "center",
        }}
      >
        {headline}
      </Text>
      <Text
        style={{
          fontFamily: "Onest_400Regular",
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
        <View style={{ width: "100%", marginTop: 4 }}>
          <CTAButton label={cta.label} onPress={cta.onPress} />
        </View>
      ) : null}
      {secondary ? (
        <Text
          onPress={secondary.onPress}
          style={{
            fontFamily: "Onest_500Medium",
            fontSize: 14,
            color: light.smoke,
            textDecorationLine: "underline",
            marginTop: 4,
          }}
        >
          {secondary.label}
        </Text>
      ) : null}
    </View>
  );
}
