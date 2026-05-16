import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CTAButton, T } from "../../components/ui";
import { light } from "@bonfire/ui-tokens";

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return d;
  if (d.length < 7) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export default function Phone() {
  const [digits, setDigits] = useState("");
  const valid = digits.replace(/\D/g, "").length === 10;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={20}
          style={{ alignSelf: "flex-start", padding: 4 }}
        >
          <Ionicons name="chevron-back" size={28} color={light.coal} />
        </Pressable>
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
          <View
            style={{
              height: 1,
              backgroundColor: light.ash,
              marginTop: 4,
            }}
          />
        </View>

        <CTAButton
          label="Send code"
          onPress={() => router.push({ pathname: "/(auth)/verify", params: { phone: digits } })}
          disabled={!valid}
        />
      </View>
    </SafeAreaView>
  );
}
