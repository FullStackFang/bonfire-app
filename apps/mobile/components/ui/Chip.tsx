import { Pressable, Text, View, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { light } from "@bonfire/ui-tokens";

export type ChipVariant = "solid" | "outline" | "ghost" | "tinted";
export type ChipSize = "sm" | "md";

export interface ChipProps {
  // Optional — when omitted, the chip is icon-only. An accessibilityLabel is
  // then required so screen readers still have something to announce.
  label?: string;
  variant?: ChipVariant;
  size?: ChipSize;
  onPress?: () => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  tint?: string;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
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
  rightIcon,
  tint,
  disabled,
  testID,
  accessibilityLabel,
}: ChipProps) {
  const sz = sizes[size];

  let bg: string = light.hearth;
  let fg: string = light.coal;
  let borderColor: string = light.ash;
  let borderWidth = 1;

  if (variant === "solid") { bg = light.ember; fg = light.hearth; borderWidth = 0; borderColor = "transparent"; }
  else if (variant === "ghost") { bg = "transparent"; fg = light.smoke; borderWidth = 0; borderColor = "transparent"; }
  else if (variant === "tinted" && tint) { bg = tint + "1f"; fg = tint; borderWidth = 0; borderColor = "transparent"; }

  const style: ViewStyle = {
    backgroundColor: bg,
    paddingVertical: sz.paddingV,
    paddingHorizontal: sz.paddingH,
    borderRadius: 999,
    borderWidth,
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
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {leftIcon ? (
        <View style={label || rightIcon ? { marginRight: 4 } : undefined}>{leftIcon}</View>
      ) : null}
      {label ? (
        <Text style={{ color: fg, fontFamily: "Onest_500Medium", fontSize: sz.font }}>
          {label}
        </Text>
      ) : null}
      {rightIcon ? (
        <View style={label ? { marginLeft: 4 } : undefined}>{rightIcon}</View>
      ) : null}
    </Pressable>
  );
}
