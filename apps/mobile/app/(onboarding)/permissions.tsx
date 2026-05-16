import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Contacts from "expo-contacts";
import * as Notifications from "expo-notifications";
import { CTAButton, T } from "../../components/ui";
import { light } from "@bonfire/ui-tokens";

type Step = {
  key: "location" | "contacts" | "notifications";
  headline: string;
  body: string;
  no: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const STEPS: Step[] = [
  {
    key: "location",
    headline: "So your circles can see you when you go live.",
    body: "We only track location while you're live. Never in the background.",
    no: "Location off · degraded experience",
    icon: "location",
  },
  {
    key: "contacts",
    headline: "Find the friends you already have.",
    body: "We hash your contacts on your device. Raw phone numbers never leave your phone.",
    no: "You can add friends one at a time later",
    icon: "people",
  },
  {
    key: "notifications",
    headline: "Hear about it the moment a circle lights up.",
    body: "Gather invites, friend-live signals, and heatmap heat. Toggle anything off in Settings.",
    no: "You'll see updates in the inbox tab",
    icon: "notifications",
  },
];

export default function Permissions() {
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];

  const ask = async () => {
    if (step.key === "location") {
      await Location.requestForegroundPermissionsAsync().catch(() => {});
      await Location.requestBackgroundPermissionsAsync().catch(() => {});
    } else if (step.key === "contacts") {
      await Contacts.requestPermissionsAsync().catch(() => {});
    } else if (step.key === "notifications") {
      await Notifications.requestPermissionsAsync().catch(() => {});
    }
    advance();
  };

  const advance = () => {
    if (stepIdx === STEPS.length - 1) {
      router.replace("/(onboarding)/contacts");
    } else {
      setStepIdx((i) => i + 1);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 28,
          paddingTop: 16,
          columnGap: 8,
        }}
      >
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: i <= stepIdx ? light.ember : light.ash,
            }}
          />
        ))}
      </View>

      <View
        style={{
          flex: 1,
          paddingHorizontal: 28,
          paddingTop: 32,
          justifyContent: "space-between",
        }}
      >
        <View>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: light.ember,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 28,
            }}
          >
            <Ionicons name={step.icon} size={36} color={light.hearth} />
          </View>
          <T variant="displayXl">{step.headline}</T>
          <T variant="bodyLg" color={light.smoke} style={{ marginTop: 16 }}>
            {step.body}
          </T>
        </View>

        <View style={{ rowGap: 14 }}>
          <CTAButton label="Allow" onPress={ask} />
          <CTAButton label={step.no} onPress={advance} variant="ghost" />
        </View>
      </View>
    </SafeAreaView>
  );
}
