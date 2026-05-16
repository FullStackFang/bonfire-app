import { Pressable, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { houseSpring, light, radius } from "@bonfire/ui-tokens";

export interface CardProps {
  children: React.ReactNode;
  interactive?: boolean;
  onPress?: () => void;
  padding?: number;
  style?: ViewStyle;
  testID?: string;
}

const baseStyle: ViewStyle = {
  backgroundColor: light.hearth,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: light.ash,
};

export function Card({
  children,
  interactive = false,
  onPress,
  padding = 16,
  style,
  testID,
}: CardProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!interactive) {
    return (
      <View style={[baseStyle, { padding }, style]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <Animated.View style={animated}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.98, houseSpring); }}
        onPressOut={() => { scale.value = withSpring(1, houseSpring); }}
        onPress={onPress}
        style={[baseStyle, { padding }, style]}
        testID={testID}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
