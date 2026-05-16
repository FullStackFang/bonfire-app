import { Pressable, Text, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { houseSpring, light } from "@bonfire/ui-tokens";

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
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bg =
    variant === "primary" ? light.ember
    : variant === "outline" ? light.hearth
    : "transparent";
  const fg =
    variant === "primary" ? light.hearth
    : variant === "outline" ? light.ember
    : light.coal;
  const borderColor =
    variant === "outline" ? light.ember : "transparent";

  const style: ViewStyle = {
    height: 56,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: bg,
    borderWidth: variant === "outline" ? 1.5 : 0,
    borderColor,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    opacity: disabled ? 0.5 : 1,
  };

  const fireHaptic = () => {
    if (haptic === "selection") return Haptics.selectionAsync().catch(() => {});
    if (haptic === "success") return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (haptic === "warning") return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    return Haptics.impactAsync(haptic as Haptics.ImpactFeedbackStyle).catch(() => {});
  };

  return (
    <Animated.View style={animated}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPressIn={() => { if (!disabled) scale.value = withSpring(0.97, houseSpring); }}
        onPressOut={() => { scale.value = withSpring(1, houseSpring); }}
        onPress={() => {
          if (disabled) return;
          fireHaptic();
          onPress();
        }}
        style={style}
        testID={testID}
      >
        {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}
        <Text style={{ color: fg, fontFamily: "Onest_600SemiBold", fontSize: 17 }}>
          {label}
        </Text>
        {rightIcon ? <View style={{ marginLeft: 8 }}>{rightIcon}</View> : null}
      </Pressable>
    </Animated.View>
  );
}
