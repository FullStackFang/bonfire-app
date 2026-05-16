import { Text, View, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { light } from "@bonfire/ui-tokens";
import { ChunkyPressable } from "./ChunkyPressable";

export type CTAVariant = "primary" | "outline" | "ghost";

export interface CTAButtonProps {
  label: string;
  onPress: () => void;
  variant?: CTAVariant;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  haptic?: Haptics.ImpactFeedbackStyle | "selection" | "success" | "warning";
  testID?: string;
}


export function CTAButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  leftIcon,
  rightIcon,
  haptic = Haptics.ImpactFeedbackStyle.Light,
  testID,
}: CTAButtonProps) {
  const isPrimary = variant === "primary";
  const isOutline = variant === "outline";
  const isGhost = variant === "ghost";

  const bg = isPrimary ? light.ember : isOutline ? light.hearth : "transparent";
  const fg = isPrimary ? light.hearth : isOutline ? light.ember : light.coal;
  const shadowColor = isPrimary ? light.emberDeep : light.warmShadow;

  const chunkyHaptic =
    haptic === "selection" || haptic === "success" || haptic === "warning"
      ? "selection"
      : (haptic as Haptics.ImpactFeedbackStyle);

  // Ghost has no 3D treatment — it's a flat text button.
  if (isGhost) {
    return (
      <ChunkyPressable
        onPress={onPress}
        disabled={disabled}
        shadowColor="transparent"
        depth={0}
        radius={999}
        haptic={chunkyHaptic}
        accessibilityLabel={label}
        testID={testID}
      >
        <View
          style={{
            height: 56,
            paddingHorizontal: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}
          <Text style={{ color: fg, fontFamily: "Onest_600SemiBold", fontSize: 17 }}>
            {label}
          </Text>
          {rightIcon ? <View style={{ marginLeft: 8 }}>{rightIcon}</View> : null}
        </View>
      </ChunkyPressable>
    );
  }

  const faceStyle: ViewStyle = {
    height: 56,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: bg,
    borderWidth: isOutline ? 1.5 : 0,
    borderColor: isOutline ? light.warmShadow : "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <ChunkyPressable
      onPress={onPress}
      disabled={disabled}
      shadowColor={shadowColor}
      depth={5}
      radius={999}
      haptic={chunkyHaptic}
      accessibilityLabel={label}
      testID={testID}
    >
      <View style={faceStyle}>
        {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}
        <Text
          style={{
            color: fg,
            fontFamily: "Onest_600SemiBold",
            fontSize: 17,
            letterSpacing: 0.2,
          }}
        >
          {label}
        </Text>
        {rightIcon ? <View style={{ marginLeft: 8 }}>{rightIcon}</View> : null}
      </View>
    </ChunkyPressable>
  );
}
