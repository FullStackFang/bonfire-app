import { useMemo } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { houseSpring } from "@bonfire/ui-tokens";

// 3D-press button: a coloured shadow sits behind the face, offset by `depth`.
// On press the face translates down to meet the shadow. See DESIGN.md §5.

export interface ChunkyPressableProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  shadowColor: string;
  depth?: number;
  radius?: number;
  style?: ViewStyle;
  haptic?: Haptics.ImpactFeedbackStyle | "selection" | "none";
  accessibilityLabel?: string;
  testID?: string;
}

export function ChunkyPressable({
  children,
  onPress,
  onLongPress,
  disabled = false,
  shadowColor,
  depth = 4,
  radius = 999,
  style,
  haptic = "selection",
  accessibilityLabel,
  testID,
}: ChunkyPressableProps) {
  const offset = useSharedValue(0);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  const shadowStyle = useMemo<ViewStyle>(
    () => ({
      position: "absolute",
      left: 0,
      right: 0,
      top: depth,
      bottom: 0,
      backgroundColor: shadowColor,
      borderRadius: radius,
    }),
    [depth, shadowColor, radius],
  );

  const fireHaptic = () => {
    if (haptic === "none") return;
    if (haptic === "selection") {
      Haptics.selectionAsync().catch(() => {});
      return;
    }
    Haptics.impactAsync(haptic as Haptics.ImpactFeedbackStyle).catch(() => {});
  };

  return (
    <View style={[{ paddingBottom: depth }, style]}>
      <View style={shadowStyle} pointerEvents="none" />
      <Animated.View style={faceStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          disabled={disabled}
          onPressIn={() => {
            if (disabled) return;
            offset.value = withSpring(depth, houseSpring);
          }}
          onPressOut={() => {
            offset.value = withSpring(0, houseSpring);
          }}
          onPress={() => {
            if (disabled) return;
            fireHaptic();
            onPress?.();
          }}
          onLongPress={() => {
            if (disabled) return;
            fireHaptic();
            onLongPress?.();
          }}
          testID={testID}
          style={{ opacity: disabled ? 0.5 : 1 }}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}
