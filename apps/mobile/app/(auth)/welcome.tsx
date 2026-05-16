import { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { CTAButton, T } from "../../components/ui";
import { heatmapPulseMs, light } from "@bonfire/ui-tokens";

function Ember() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withTiming(1, { duration: heatmapPulseMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [p]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + p.value * 0.4,
    transform: [{ scale: 1 + p.value * 0.15 }],
  }));
  return (
    <View style={{ alignItems: "center", justifyContent: "center", height: 220 }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: light.emberGlow,
          },
          style,
        ]}
      />
      <View
        style={{
          width: 110,
          height: 110,
          borderRadius: 55,
          backgroundColor: light.ember,
        }}
      />
    </View>
  );
}

export default function Welcome() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
      <View style={{ flex: 1, paddingHorizontal: 28, paddingVertical: 32, justifyContent: "space-between" }}>
        <View style={{ paddingTop: 24 }}>
          <T variant="displayXl" style={{ fontSize: 48, lineHeight: 52 }}>
            bonfire
          </T>
          <T variant="bodyLg" color={light.smoke} style={{ marginTop: 12, maxWidth: 280 }}>
            See the friends you already have, the moment they&apos;re out.
          </T>
        </View>

        <Ember />

        <View style={{ rowGap: 12 }}>
          <CTAButton
            label="Continue with phone"
            onPress={() => router.push("/(auth)/phone")}
          />
          <T variant="bodySm" color={light.smoke} align="center">
            We use your number to find your real friends. We never post anything.
          </T>
        </View>
      </View>
    </SafeAreaView>
  );
}
