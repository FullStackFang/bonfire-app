import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { typeScale, type TypeScaleKey, light } from "@bonfire/ui-tokens";

export interface TypedTextProps extends RNTextProps {
  variant?: TypeScaleKey;
  color?: string;
  align?: "left" | "center" | "right";
}

export function T({
  variant = "body",
  color = light.coal,
  align,
  style,
  children,
  ...rest
}: TypedTextProps) {
  const t = typeScale[variant];
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: t.family,
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          color,
          textAlign: align,
          includeFontPadding: false,
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
