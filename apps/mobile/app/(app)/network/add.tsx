import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CTAButton, Card, T } from "../../../components/ui";
import { light } from "@bonfire/ui-tokens";

type Mode = "phone" | "qr" | "contacts";

export default function AddFriend() {
  const [mode, setMode] = useState<Mode>("phone");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={20} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={28} color={light.coal} />
        </Pressable>
        <T variant="title">Add friend</T>
        <View style={{ width: 32 }} />
      </View>

      <View
        style={{
          flexDirection: "row",
          marginHorizontal: 20,
          marginTop: 20,
          backgroundColor: light.hearth,
          borderRadius: 14,
          padding: 4,
          borderWidth: 1,
          borderColor: light.ash,
        }}
      >
        {(["phone", "contacts", "qr"] as Mode[]).map((m) => {
          const active = mode === m;
          return (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: active ? light.ember : "transparent",
                alignItems: "center",
              }}
            >
              <T
                variant="bodySm"
                color={active ? light.hearth : light.smoke}
                style={{ fontFamily: "Onest_600SemiBold", textTransform: "capitalize" }}
              >
                {m}
              </T>
            </Pressable>
          );
        })}
      </View>

      <View style={{ padding: 20, rowGap: 16 }}>
        {mode === "phone" && (
          <Card>
            <T variant="bodyLg">Search by phone number</T>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16, columnGap: 8 }}>
              <T variant="displayLg" color={light.smoke} style={{ fontFamily: "GeistMono_400Regular" }}>
                +1
              </T>
              <TextInput
                placeholder="555 123 4567"
                placeholderTextColor={light.ash}
                keyboardType="number-pad"
                style={{
                  flex: 1,
                  fontFamily: "GeistMono_400Regular",
                  fontSize: 24,
                  color: light.coal,
                  paddingVertical: 4,
                }}
              />
            </View>
            <CTAButton label="Send invite" onPress={() => {}} variant="outline" />
          </Card>
        )}
        {mode === "contacts" && (
          <Card>
            <T variant="bodyLg">Re-scan contacts</T>
            <T variant="body" color={light.smoke} style={{ marginTop: 4 }}>
              We&apos;ll match any new contacts against Bonfire users. Hashed on device only.
            </T>
            <View style={{ marginTop: 16 }}>
              <CTAButton label="Scan contacts" onPress={() => {}} />
            </View>
          </Card>
        )}
        {mode === "qr" && (
          <Card>
            <T variant="bodyLg">Your QR code</T>
            <View
              style={{
                marginTop: 16,
                aspectRatio: 1,
                backgroundColor: light.cream,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="qr-code" size={120} color={light.coal} />
            </View>
            <View style={{ marginTop: 16 }}>
              <CTAButton label="Scan a code" onPress={() => {}} variant="outline" />
            </View>
          </Card>
        )}
      </View>
    </SafeAreaView>
  );
}
