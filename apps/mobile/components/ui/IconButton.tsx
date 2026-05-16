import { Pressable, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { light } from "@bonfire/ui-tokens";

export type IconButtonVariant = "hearth" | "ghost" | "overlay";

export interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  size?: number;
  iconSize?: number;
  iconColor?: string;
  haptic?: Haptics.ImpactFeedbackStyle | "selection" | "none";
  disabled?: boolean;
  testID?: string;
}

// Secondary header / modal actions: back, close, bookmark, share, mode-switch.
// Three variants:
//   hearth  — hearth fill with ash hairline. Default for screen headers.
//   ghost   — transparent, bare chevron. Use for back buttons that float over
//             content where a chip would be visually heavy.
//   overlay — hearth at 95% opacity, no border. For use over photographic /
//             illustrated backdrops like the venue hero.
//
// IconButton is NOT for primary actions — those belong to CTAButton or a
// chunky map control.

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = "hearth",
  size = 36,
  iconSize,
  iconColor,
  haptic = "selection",
  disabled = false,
  testID,
}: IconButtonProps) {
  const fireHaptic = () => {
    if (haptic === "none") return;
    if (haptic === "selection") {
      Haptics.selectionAsync().catch(() => {});
      return;
    }
    Haptics.impactAsync(haptic as Haptics.ImpactFeedbackStyle).catch(() => {});
  };

  const resolvedIconSize = iconSize ?? Math.round(size / 2);
  const resolvedIconColor = iconColor ?? light.coal;

  const baseStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: "center",
    justifyContent: "center",
  };

  let variantStyle: ViewStyle;
  if (variant === "hearth") {
    variantStyle = {
      backgroundColor: light.hearth,
      borderWidth: 1,
      borderColor: light.ash,
    };
  } else if (variant === "overlay") {
    variantStyle = {
      backgroundColor: light.hearth,
      opacity: 0.95,
    };
  } else {
    variantStyle = {
      backgroundColor: "transparent",
    };
  }

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        fireHaptic();
        onPress();
      }}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        baseStyle,
        variantStyle,
        { opacity: disabled ? 0.5 : pressed ? 0.7 : variantStyle.opacity ?? 1 },
      ]}
      testID={testID}
    >
      <Ionicons name={icon} size={resolvedIconSize} color={resolvedIconColor} />
    </Pressable>
  );
}
