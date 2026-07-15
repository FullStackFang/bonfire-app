import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { houseSpring, light } from "@bonfire/ui-tokens";

// The mobile bottom tab bar, restyled into the app's chunky-press vocabulary to match the web
// pulse navbar. Icon-only chips: the active tab is an ember face on a hard ember-deep offset; the
// rest are hearth faces on a warm-shadow offset with an ash border. Destinations are untouched —
// this only replaces the presentation of Expo Router's default flat bar.

const DEPTH = 4;
const CHIP_W = 54;
const CHIP_H = 44;
const RADIUS = 14;
const ICON = 22;

// One chunky-chip tab. Press translates the face down onto its shadow (skipped under reduced
// motion, which keeps the state colors). Haptics fire on every press, active or not.
function TabChip({
  active,
  label,
  onPress,
  renderIcon,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  renderIcon: (color: string) => React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const offset = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <View style={{ paddingBottom: DEPTH }}>
      <View
        pointerEvents="none"
        style={[styles.shadow, { backgroundColor: active ? light.emberDeep : light.warmShadow }]}
      />
      <Animated.View style={faceStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected: active }}
          onPressIn={() => {
            if (!reduced) offset.value = withSpring(DEPTH, houseSpring);
          }}
          onPressOut={() => {
            if (!reduced) offset.value = withSpring(0, houseSpring);
          }}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onPress();
          }}
          style={[
            styles.face,
            active
              ? { backgroundColor: light.ember, borderWidth: 0 }
              : { backgroundColor: light.hearth, borderWidth: 1.5, borderColor: light.ash },
          ]}
        >
          {renderIcon(active ? light.hearth : light.smoke)}
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function ChunkyTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeKey = state.routes[state.index]?.key;

  // Expo Router hides `href: null` routes by stamping tabBarItemStyle { display: 'none' } — honor
  // that here so profile/settings stay out of the bar (destinations unchanged from the default).
  const visible = state.routes.filter((route) => {
    const style = descriptors[route.key].options.tabBarItemStyle as
      | { display?: string }
      | undefined;
    return style?.display !== "none";
  });

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {visible.map((route) => {
        const { options } = descriptors[route.key];
        const active = route.key === activeKey;
        const label =
          options.tabBarAccessibilityLabel ??
          (typeof options.title === "string" ? options.title : route.name);

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!active && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <TabChip
            key={route.key}
            active={active}
            label={label}
            onPress={onPress}
            renderIcon={(color) =>
              options.tabBarIcon?.({ focused: active, color, size: ICON }) ?? null
            }
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 26,
    paddingTop: 10,
    backgroundColor: light.hearth,
    borderTopColor: light.ash,
    borderTopWidth: 0.5,
  },
  shadow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: DEPTH,
    bottom: 0,
    borderRadius: RADIUS,
  },
  face: {
    width: CHIP_W,
    height: CHIP_H,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
});
