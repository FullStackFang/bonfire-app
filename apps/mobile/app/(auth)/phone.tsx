import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CTAButton, IconButton, T } from "../../components/ui";
import { light } from "@bonfire/ui-tokens";
import { supabase, supabaseConfigured } from "../../lib/supabase";

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return d;
  if (d.length < 7) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export default function Phone() {
  const [digits, setDigits] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = digits.replace(/\D/g, "").length === 10;

  const send = async () => {
    setError(null);
    const e164 = `+1${digits.replace(/\D/g, "")}`;

    if (!supabaseConfigured) {
      router.push({ pathname: "/(auth)/verify", params: { phone: digits } });
      return;
    }

    setSending(true);
    const { error: err } = await supabase.auth.signInWithOtp({ phone: e164 });
    setSending(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push({ pathname: "/(auth)/verify", params: { phone: digits, e164 } });
  };

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

      <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 16, justifyContent: "space-between" }}>
        <View>
          <T variant="displayXl">Your number</T>
          <T variant="body" color={light.smoke} style={{ marginTop: 8 }}>
            We&apos;ll send a six-digit code.
          </T>

          <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 40, columnGap: 12 }}>
            <T
              variant="displayLg"
              color={light.smoke}
              style={{ fontFamily: "GeistMono_400Regular" }}
            >
              +1
            </T>
            <TextInput
              value={formatPhone(digits)}
              onChangeText={setDigits}
              keyboardType="number-pad"
              placeholder="555 123 4567"
              placeholderTextColor={light.ash}
              autoFocus
              style={{
                fontFamily: "GeistMono_400Regular",
                fontSize: 30,
                color: light.coal,
                flex: 1,
                paddingVertical: 4,
              }}
            />
          </View>
          <View style={{ height: 1, backgroundColor: light.ash, marginTop: 4 }} />
          {error ? (
            <T variant="bodySm" color={light.emberDeep} style={{ marginTop: 12 }}>
              {error}
            </T>
          ) : null}
        </View>

        <CTAButton
          label={sending ? "Sending..." : "Send code"}
          onPress={send}
          disabled={!valid || sending}
        />
      </View>
    </SafeAreaView>
  );
}
