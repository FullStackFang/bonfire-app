import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { T } from "../../components/ui";
import { light } from "@bonfire/ui-tokens";

const LEN = 6;

export default function Verify() {
  const params = useLocalSearchParams<{ phone?: string }>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const shake = useSharedValue(0);
  useEffect(() => {
    if (!error) return;
    shake.value = withSequence(
      withTiming(-10, { duration: 60 }),
      withTiming(10, { duration: 60 }),
      withTiming(-6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
    const t = setTimeout(() => setError(null), 1500);
    return () => clearTimeout(t);
  }, [error, shake]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  useEffect(() => {
    if (code.length === LEN) {
      // mock verification: any code "000000" fails, anything else "succeeds" and goes to onboarding.
      if (code === "000000") {
        setError("That code didn't work.");
        setCode("");
      } else {
        router.replace("/(onboarding)/permissions");
      }
    }
  }, [code]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={20} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={28} color={light.coal} />
        </Pressable>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 16 }}>
        <T variant="displayXl">Enter code</T>
        <T variant="body" color={light.smoke} style={{ marginTop: 8 }}>
          Sent to +1 {params.phone ?? ""}
        </T>

        <Pressable
          onPress={() => inputRef.current?.focus()}
          style={{ marginTop: 40 }}
        >
          <Animated.View style={[{ flexDirection: "row", columnGap: 8 }, animated]}>
            {Array.from({ length: LEN }).map((_, i) => {
              const char = code[i];
              const focused = i === code.length;
              return (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    borderRadius: 12,
                    backgroundColor: light.hearth,
                    borderWidth: focused ? 2 : 1,
                    borderColor: focused ? light.ember : (error ? light.emberDeep : light.ash),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <T
                    variant="displayLg"
                    style={{ fontFamily: "GeistMono_400Regular" }}
                  >
                    {char ?? ""}
                  </T>
                </View>
              );
            })}
          </Animated.View>
        </Pressable>

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, LEN))}
          keyboardType="number-pad"
          autoFocus
          style={{
            position: "absolute",
            opacity: 0,
            height: 1,
            width: 1,
          }}
        />

        {error ? (
          <T variant="bodySm" color={light.emberDeep} align="center" style={{ marginTop: 16 }}>
            {error}
          </T>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
