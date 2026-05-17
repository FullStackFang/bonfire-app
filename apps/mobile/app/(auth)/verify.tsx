import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { IconButton, T } from "../../components/ui";
import { light } from "@bonfire/ui-tokens";
import { supabase, supabaseConfigured } from "../../lib/supabase";

const LEN = 6;

export default function Verify() {
  const params = useLocalSearchParams<{ phone?: string; e164?: string }>();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
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
    const t = setTimeout(() => setError(null), 2000);
    return () => clearTimeout(t);
  }, [error, shake]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  useEffect(() => {
    if (code.length !== LEN) return;

    const verify = async () => {
      setVerifying(true);

      if (!supabaseConfigured) {
        if (code === "000000") {
          setError("That code didn't work.");
          setCode("");
          setVerifying(false);
        } else {
          router.replace("/(onboarding)/permissions");
        }
        return;
      }

      const e164 = params.e164 || `+1${(params.phone ?? "").replace(/\D/g, "")}`;
      const { error: err } = await supabase.auth.verifyOtp({
        phone: e164,
        token: code,
        type: "sms",
      });
      setVerifying(false);

      if (err) {
        setError(err.message);
        setCode("");
        return;
      }

      // Check whether a profile already exists. The trigger creates one on first signup,
      // but a returning user already has one too — both paths land in (app).
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase.from("users").select("id").eq("id", user.id).maybeSingle()
        : { data: null };

      if (profile) {
        router.replace("/(app)");
      } else {
        router.replace("/(onboarding)/permissions");
      }
    };

    verify();
  }, [code, params.e164, params.phone]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <IconButton
          icon="chevron-back"
          variant="ghost"
          size={40}
          iconSize={22}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 16 }}>
        <T variant="displayXl">Enter code</T>
        <T variant="body" color={light.smoke} style={{ marginTop: 8 }}>
          Sent to +1 {params.phone ?? ""}
        </T>

        <Pressable
          onPress={() => inputRef.current?.focus()}
          style={{ marginTop: 40 }}
          disabled={verifying}
        >
          <Animated.View style={[{ flexDirection: "row", columnGap: 8 }, animated]}>
            {Array.from({ length: LEN }).map((_, i) => {
              const char = code[i];
              const focused = i === code.length && !verifying;
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
                  <T variant="displayLg" style={{ fontFamily: "GeistMono_400Regular" }}>
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
          editable={!verifying}
          style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
        />

        {error ? (
          <T variant="bodySm" color={light.emberDeep} align="center" style={{ marginTop: 16 }}>
            {error}
          </T>
        ) : null}
        {verifying ? (
          <T variant="bodySm" color={light.smoke} align="center" style={{ marginTop: 16 }}>
            Verifying...
          </T>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
