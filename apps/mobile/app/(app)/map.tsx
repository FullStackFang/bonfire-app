// Map = the memory. (spec §Screens 2, §Fog of war)
// Full-bleed fog-of-war map (FogMap.web on web, ledger fallback on native)
// with the My Map / Group Map toggle floating above it, a tap card for
// whatever light you touch, and the anchor-night demo trigger.

import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { light, night } from "@bonfire/ui-tokens";
import { T, Card, Chip, SegmentedControl } from "../../components/ui";
import { FogMap, type FogMapSelection } from "../../components/map/FogMap";
import { useLiveSim, startAnchorNight } from "../../lib/liveSim";

type Mode = "group" | "self";

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("group");
  const [sel, setSel] = useState<FogMapSelection | null>(null);
  const sim = useLiveSim();

  // Switching layers clears the tap card; so does the sim ending.
  useEffect(() => setSel(null), [mode]);

  const demoLabel = sim.running
    ? `Anchor night underway — ${sim.arrivals.length} there`
    : sim.done
      ? "Replay anchor night"
      : "Play anchor night";

  return (
    <View style={{ flex: 1, backgroundColor: night.cream }}>
      <FogMap mode={mode} onSelect={setSel} />

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
