// The map's non-map equivalent (doctrine: every map fact has a list form).
// Also the native fallback until the maplibre-react-native build lands —
// Expo Go can't load native MapLibre, and v1's WebView approach is dead.

import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { night } from "@bonfire/ui-tokens";
import { T } from "../ui";
import { litTerritory, embers, personalSpots, memberById } from "../../lib/mockV2";

export function MapLedger({ mode }: { mode: "group" | "self" }) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: night.cream }}
      contentContainerStyle={{
        paddingTop: insets.top + 84,
        paddingBottom: 32,
        paddingHorizontal: 20,
      }}
    >
      {mode === "group" ? (
        <>
          <T variant="displayXl" color={night.coal}>
            The city is black-and-white until you light it.
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
        </>
      ) : (
        <>
          <T variant="displayXl" color={night.coal}>
            Your own lit city.
          </T>
          <T variant="body" color={night.smoke} style={{ marginTop: 8 }}>
            Private. Lights wherever you check in — solo or with the group.
          </T>
          <T
            variant="overline"
            color={night.smoke}
            style={{ letterSpacing: 1.1, textTransform: "uppercase", marginTop: 32, marginBottom: 4 }}
          >
            Your spots
          </T>
          {personalSpots.map((s) => (
            <View
              key={s.id}
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
                  backgroundColor: night.emberGlow,
                  marginRight: 12,
                }}
              />
              <T variant="bodyLg" color={night.coal}>
                {s.name}
              </T>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}
