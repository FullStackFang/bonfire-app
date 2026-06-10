// Map = the memory. (spec §Screens 2, §Fog of war)
// v1 of this screen is deliberately a list on the night surface: the doctrine
// requires every map fact to have a non-map equivalent, and the MapLibre
// platform fork (native maplibre-react-native / web maplibre-gl) is a later
// task. Darkness is the correct starting state — this screen renders the dark.

import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { night } from "@bonfire/ui-tokens";
import { T } from "../../components/ui";
import { litTerritory, embers, memberById } from "../../lib/mockV2";

export default function GroupMap() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: night.cream }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: 32,
        paddingHorizontal: 20,
      }}
    >
      <T variant="displayXl" color={night.coal}>
        The map is dark until you light it.
      </T>
      <T variant="body" color={night.smoke} style={{ marginTop: 8 }}>
        A venue lights only when you’re there together — three or more of you.
      </T>

      <T
        variant="overline"
        color={night.smoke}
        style={{ letterSpacing: 1.1, textTransform: "uppercase", marginTop: 32, marginBottom: 4 }}
      >
        Lit territory
      </T>
      {litTerritory.map((v) => (
        <View
          key={v.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: night.ash,
          }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: night.ember,
              marginRight: 12,
            }}
          />
          <View style={{ flex: 1 }}>
            <T variant="bodyLg" color={night.coal}>
              {v.name}
            </T>
            <T variant="bodySm" color={night.smoke} style={{ marginTop: 2 }}>
              {v.litLabel} · found by {memberById(v.foundById).name}
            </T>
          </View>
        </View>
      ))}

      <T
        variant="overline"
        color={night.smoke}
        style={{ letterSpacing: 1.1, textTransform: "uppercase", marginTop: 32, marginBottom: 4 }}
      >
        Embers
      </T>
      {embers.map((e) => (
        <View
          key={e.id}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: night.ash,
          }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: night.dusk,
              marginRight: 12,
              marginTop: 5,
            }}
          />
          <View style={{ flex: 1 }}>
            <T variant="bodyLg" color={night.coal}>
              {e.venueName}
            </T>
            <T variant="body" color={night.smoke} style={{ marginTop: 2 }}>
              “{e.note}” — {memberById(e.droppedById).name}
            </T>
            <T variant="monoSm" color={night.dusk} style={{ marginTop: 4 }}>
              {e.fadesLabel}
            </T>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
