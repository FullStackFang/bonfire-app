import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
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
import { supabase, supabaseConfigured } from "../../lib/supabase";

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
    <View style={{ alignItems: "center", justifyContent: "center", height: 200 }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: light.emberGlow,
          },
          style,
        ]}
      />
      <View
        style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: light.ember,
        }}
      />
    </View>
  );
}

export default function Welcome() {
  const [name, setName] = useState("");
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  const enter = async () => {
    setError(null);

    if (!supabaseConfigured) {
      router.replace("/(onboarding)/permissions");
      return;
    }

    setSigning(true);
    const { data, error: signErr } = await supabase.auth.signInAnonymously({
      options: { data: { display_name: trimmed || undefined } },
    });
    if (signErr || !data.user) {
      setSigning(false);
      setError(signErr?.message ?? "Couldn't sign in.");
      return;
    }

    // If the user provided a name, ensure their profile row has it.
    // The trigger uses the raw_user_meta_data.display_name, but on some Supabase
    // versions the trigger fires before the metadata is committed. Update to be safe.
    if (trimmed) {
      const initials = trimmed.slice(0, 2).toUpperCase();
      await supabase
        .from("users")
        .update({ display_name: trimmed, letter_pair: initials })
        .eq("id", data.user.id);
    }

    setSigning(false);
    router.replace("/(onboarding)/permissions");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 28,
          paddingVertical: 32,
          justifyContent: "space-between",
        }}
      >
        <View style={{ paddingTop: 16 }}>
          <T variant="displayXl" style={{ fontSize: 48, lineHeight: 52 }}>
            bonfire
          </T>
          <T variant="bodyLg" color={light.smoke} style={{ marginTop: 12, maxWidth: 280 }}>
            See the friends you already have, the moment they&apos;re out.
          </T>
        </View>

        <Ember />

        <View style={{ rowGap: 16 }}>
          <View>
            <T variant="overline" color={light.smoke} style={{ letterSpacing: 1.1, marginBottom: 8 }}>
              YOUR NAME
            </T>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Sarah Park"
              placeholderTextColor={light.ash}
              autoCapitalize="words"
              autoCorrect={false}
              style={{
                fontFamily: "SourceSerif4_500Medium",
                fontSize: 24,
                color: light.coal,
                paddingVertical: 6,
                borderBottomWidth: 1,
                borderBottomColor: light.ash,
              }}
            />
          </View>

          <CTAButton
            label={signing ? "Lighting the fire..." : "Continue"}
            onPress={enter}
            disabled={signing}
          />
          {error ? (
            <T variant="bodySm" color={light.emberDeep} align="center">
              {error}
            </T>
          ) : (
            <T variant="bodySm" color={light.smoke} align="center">
              No phone number for now — we&apos;ll add it when you&apos;re ready.
            </T>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
