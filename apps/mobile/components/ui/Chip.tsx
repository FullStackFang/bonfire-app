import { Pressable, Text, View, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { light } from "@bonfire/ui-tokens";

export type ChipVariant = "solid" | "outline" | "ghost" | "tinted";
export type ChipSize = "sm" | "md";

export interface ChipProps {
  label: string;
  variant?: ChipVariant;
  size?: ChipSize;
  onPress?: () => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  tint?: string;
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
  rightIcon,
  tint,
  disabled,
  testID,
}: ChipProps) {
  const sz = sizes[size];

  let bg = light.hearth;
  let fg = light.coal;
  let borderColor = light.ash;
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
      accessibilityLabel={label}
    >
      {leftIcon ? <View style={{ marginRight: 4 }}>{leftIcon}</View> : null}
      <Text style={{ color: fg, fontFamily: "Onest_500Medium", fontSize: sz.font }}>
        {label}
      </Text>
      {rightIcon ? <View style={{ marginLeft: 4 }}>{rightIcon}</View> : null}
    </Pressable>
  );
}
