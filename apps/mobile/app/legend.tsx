import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AvatarStack, IconButton, T, type AvatarStackItem } from "../components/ui";
import { EventPin } from "../components/map/EventPin";
import { EventRadius } from "../components/map/EventRadius";
import { SelfIndicator } from "../components/map/SelfIndicator";
import { light } from "@bonfire/ui-tokens";
import type { MapEvent } from "../lib/mockEventStore";

// Each row composes the *real* swatch component (not a static illustration)
// so the legend stays in sync if the visual treatment of a pin/indicator
// changes — no two-place updates.

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const minsFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

const liveSample: MapEvent = {
  id: "legend-live",
  host_id: "u-sample",
  title: "Live bonfire",
  address: null,
  lat: 0,
  lng: 0,
  live_now: true,
  created_at: minsAgo(8),
  starts_at: minsAgo(8),
  expires_at: minsFromNow(35),
  description: null,
  what_to_bring: null,
  attendee_ids: [],
  invited_circle_ids: [],
};

const upcomingSample: MapEvent = {
  ...liveSample,
  id: "legend-upcoming",
  title: "Upcoming bonfire",
  live_now: false,
  starts_at: minsFromNow(25),
  expires_at: minsFromNow(90),
};

const samplePeople: AvatarStackItem[] = [
  { label: "SP", color: "#E0744B" },
  { label: "JP", color: "#8B6FB2" },
  { label: "M", color: "#5BA88C" },
  { label: "K", color: "#C8893E" },
  { label: "A", color: "#5BA88C" },
  { label: "T", color: "#E0744B" },
];

export default function MapLegend() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: light.cream }}>
      <Header />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 32,
          rowGap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Row
          title="Live bonfire"
          body="Happening now. Pulses in ember."
          swatch={<EventPin event={liveSample} />}
          swatchHeight={64}
        />
        <Row
          title="Upcoming bonfire"
          body="Starting later. Dashed border, clock icon."
          swatch={<EventPin event={upcomingSample} />}
          swatchHeight={64}
        />
        <Row
          title="You are here"
          body="Your live location, with a flame rising from the dot."
          swatch={
            <View style={{ transform: [{ scale: 1.6 }] }}>
              <SelfIndicator zoom={15} />
            </View>
          }
          swatchHeight={80}
        />
        <Row
          title="Bonfire radius"
          body="Translucent circle marks the gathering area around each pin."
          swatch={<EventRadius status="live" diameterPx={72} />}
          swatchHeight={84}
        />
        <Row
          title="More people"
          body="Avatar stack on a pin — the number shows how many are coming."
          swatch={<AvatarStack avatars={samplePeople} size="sm" max={3} />}
          swatchHeight={48}
        />
        <Row
          title="Layers toggle"
          body="Tap the layers button on the map to hide friends, bonfires, or the heatmap. Friends near a bonfire fold into its pin automatically."
          swatch={
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: light.hearth,
                borderWidth: 1,
                borderColor: light.warmShadow,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="layers" size={22} color={light.coal} />
            </View>
          }
          swatchHeight={56}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 14,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, rowGap: 4 }}>
          <T variant="title">Map legend</T>
          <T variant="bodySm" color={light.smoke}>
            What you'll see on the map.
          </T>
        </View>
        <IconButton
          icon="close"
          variant="ghost"
          size={40}
          iconSize={22}
          onPress={() => router.back()}
          accessibilityLabel="Close legend"
        />
      </View>
    </View>
  );
}

function Row({
  title,
  body,
  swatch,
  swatchHeight,
}: {
  title: string;
  body: string;
  swatch: React.ReactNode;
  swatchHeight: number;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        columnGap: 16,
        backgroundColor: light.hearth,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: light.ash,
        paddingHorizontal: 14,
        paddingVertical: 14,
      }}
    >
      <View
        style={{
          width: 100,
          height: swatchHeight,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {swatch}
      </View>
      <View style={{ flex: 1, rowGap: 4 }}>
        <T variant="bodyLg" style={{ fontFamily: "Onest_600SemiBold" }}>
          {title}
        </T>
        <T variant="bodySm" color={light.smoke}>
          {body}
        </T>
      </View>
    </View>
  );
}
