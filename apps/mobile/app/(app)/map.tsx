// Map = the memory. (spec §Screens 2, §Fog of war)
// Full-bleed fog-of-war map (FogMap.web on web, ledger fallback on native)
// with the My Map / Group Map toggle floating above it, chunky map controls
// on the right edge (locate me, back to the neighborhood — DESIGN.md §5),
// a tap card for whatever light you touch, and the anchor-night demo trigger.

import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { light } from "@bonfire/ui-tokens";
import { T, Card, Chip, ChunkyPressable, SegmentedControl } from "../../components/ui";
import {
  FogMap,
  type FogMapHandle,
  type FogMapSelection,
} from "../../components/map/FogMap";
import { mapCenter } from "../../lib/mockV2";
import { useLiveSim, startAnchorNight } from "../../lib/liveSim";

type Mode = "group" | "self";

function MapControl({
  icon,
  label,
  onPress,
  active = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <ChunkyPressable
      onPress={onPress}
      shadowColor={light.warmShadow}
      depth={4}
      radius={26}
      accessibilityLabel={label}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: light.hearth,
          borderWidth: 1,
          borderColor: active ? light.ember : light.warmShadow,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={22} color={active ? light.ember : light.coal} />
      </View>
    </ChunkyPressable>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("group");
  const [sel, setSel] = useState<FogMapSelection | null>(null);
  const [userPos, setUserPos] = useState<{ lng: number; lat: number } | null>(null);
  const locatingRef = useRef(false);
  const fogRef = useRef<FogMapHandle>(null);
  const sim = useLiveSim();

  // Switching layers clears the tap card.
  useEffect(() => setSel(null), [mode]);

  const locate = async () => {
    if (locatingRef.current) return;
    locatingRef.current = true;
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      if (!perm.granted) {
        setSel({
          title: "Location unavailable",
          subtitle: "Allow location access to find yourself on the map.",
        });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const p = { lng: pos.coords.longitude, lat: pos.coords.latitude };
      setUserPos(p);
      fogRef.current?.flyTo({ ...p, zoom: 15 });
    } catch {
      setSel({
        title: "Location unavailable",
        subtitle: "Couldn't read your position — try again.",
      });
    } finally {
      locatingRef.current = false;
    }
  };

  const goHome = () => {
    fogRef.current?.flyTo({
      lng: mapCenter.lng,
      lat: mapCenter.lat,
      zoom: mapCenter.zoom,
    });
  };

  const demoLabel = sim.running
    ? `Anchor night underway — ${sim.arrivals.length} there`
    : sim.done
      ? "Replay anchor night"
      : "Play anchor night";

  return (
    <View style={{ flex: 1, backgroundColor: light.cream }}>
      <FogMap ref={fogRef} mode={mode} userPos={userPos} onSelect={setSel} />

      {/* Floating layer toggle */}
      <View style={{ position: "absolute", top: insets.top + 12, left: 20, right: 20 }}>
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "group", label: "Group map" },
            { value: "self", label: "My map" },
          ]}
        />
      </View>

      {/* Map controls — right-edge stack (DESIGN.md §5) */}
      <View
        style={{
          position: "absolute",
          right: 18,
          bottom: 84,
          rowGap: 8,
          alignItems: "center",
        }}
      >
        <MapControl
          icon="navigate"
          label="Find my location"
          onPress={locate}
          active={!!userPos}
        />
        <MapControl icon="bonfire" label="Back to the neighborhood" onPress={goHome} />
      </View>

      {/* Tap card */}
      {sel ? (
        <Pressable
          onPress={() => setSel(null)}
          style={{ position: "absolute", left: 20, right: 20, bottom: 76 }}
        >
          <Card padding={16}>
            <T variant="title">{sel.title}</T>
            <T variant="body" color={light.smoke} style={{ marginTop: 4 }}>
              {sel.subtitle}
            </T>
          </Card>
        </Pressable>
      ) : null}

      {/* Demo: play a compressed anchor night through the real UI. */}
      <View style={{ position: "absolute", bottom: 24, alignSelf: "center" }}>
        <Chip
          label={demoLabel}
          variant={sim.running ? "solid" : "outline"}
          onPress={() => {
            if (!sim.running) startAnchorNight();
          }}
        />
      </View>
    </View>
  );
}
