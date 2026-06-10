// Map = the memory. (spec §Screens 2–3, §Fog of war)
// Full-bleed fog-of-war map (FogMap.web on web, ledger fallback on native)
// with the My Map / Group Map toggle floating above it, chunky map controls
// on the right edge (locate me, back to the neighborhood — DESIGN.md §5),
// the venue card for whatever light you touch — with the real verbs (Pulse
// here, Drop ember, I'm coming) — and the anchor-night demo trigger.

import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
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
import { mapCenter, embers, litTerritory, group } from "../../lib/mockV2";
import { useLiveSim, startAnchorNight } from "../../lib/liveSim";
import {
  useMapActions,
  startPulse,
  dropEmber,
  joinPulse,
  EMBER_WEEKLY_CAP,
} from "../../lib/mapActions";

type Mode = "group" | "self";

function NoteInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={light.smoke}
      maxLength={50}
      autoFocus
      style={{
        marginTop: 12,
        borderWidth: 1,
        borderColor: light.warmShadow,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontFamily: "Onest_400Regular",
        fontSize: 15,
        color: light.coal,
        backgroundColor: light.cream,
      }}
    />
  );
}

// The venue card (spec §Screens 3) — what tapping any light opens.
// Lit territory carries its credit and "the move"; embers carry their stake;
// pulses can be joined; personal spots can be staked as embers (cap 2/week).
function SelectionCard({
  sel,
  onClose,
  onViewGroupMap,
}: {
  sel: FogMapSelection;
  onClose: () => void;
  onViewGroupMap: () => void;
}) {
  const act = useMapActions();
  const [composing, setComposing] = useState<"pulse" | "ember" | null>(null);
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState<"pulse" | "ember" | null>(null);

  const isOwnPulse = sel.kind === "pulse" && sel.id === act.myPulse?.id;
  const joined = sel.kind === "pulse" && !!sel.id && act.joinedPulseIds.includes(sel.id);

  // Personal spots already glowing on the group map can't be staked twice.
  const alreadyOnGroupMap =
    sel.kind === "personal" &&
    !!sel.venue &&
    ([...embers, ...act.droppedEmbers].some((e) => e.venueName === sel.venue!.name) ||
      litTerritory.some((v) => v.name === sel.venue!.name));
  const emberCapLeft = EMBER_WEEKLY_CAP - act.droppedEmbers.length;

  const canPulseHere = (sel.kind === "lit" || sel.kind === "ember") && !!sel.venue;
  const canDropEmber =
    sel.kind === "personal" && !!sel.venue && !alreadyOnGroupMap;

  return (
    <Card padding={16}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <T variant="title">{sel.title}</T>
          <T variant="bodySm" color={light.smoke} style={{ marginTop: 4 }}>
            {sel.subtitle}
          </T>
          {sel.detail ? (
            <T variant="body" style={{ marginTop: 6 }}>
              {sel.detail}
            </T>
          ) : null}
        </View>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
          <Ionicons name="close" size={18} color={light.smoke} />
        </Pressable>
      </View>

      {/* Confirmations */}
      {confirmed === "pulse" && (
        <T variant="bodySm" color={light.ember} style={{ marginTop: 12 }}>
          Pulse is live — {group.name} can see you for 90 minutes.
        </T>
      )}
      {confirmed === "ember" && (
        <View style={{ marginTop: 12 }}>
          <T variant="bodySm" color={light.ember}>
            Ember staked — glowing on the group map until someone bites.
          </T>
          <View style={{ flexDirection: "row", marginTop: 10 }}>
            <Chip label="See the group map" variant="solid" onPress={onViewGroupMap} />
          </View>
        </View>
      )}

      {/* Compose: pulse note / ember note */}
      {composing && !confirmed && (
        <View>
          <NoteInput
            value={note}
            onChange={setNote}
            placeholder={
              composing === "pulse"
                ? "optional — “big table in the back”"
                : "why this place? one line"
            }
          />
          <View style={{ flexDirection: "row", columnGap: 10, marginTop: 10 }}>
            <Chip
              label={composing === "pulse" ? "I'm here — light it" : "Stake it"}
              variant="solid"
              onPress={() => {
                if (!sel.venue) return;
                if (composing === "pulse") {
                  startPulse(sel.venue, note);
                  setConfirmed("pulse");
                } else if (dropEmber(sel.venue, note)) {
                  setConfirmed("ember");
                }
                setComposing(null);
              }}
            />
            <Chip label="Cancel" variant="outline" onPress={() => setComposing(null)} />
          </View>
        </View>
      )}

      {/* Actions */}
      {!composing && !confirmed && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            columnGap: 10,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          {sel.kind === "pulse" && !isOwnPulse && (
            <Chip
              label={joined ? "You're coming" : "I'm coming"}
              variant={joined ? "solid" : "outline"}
              onPress={() => sel.id && joinPulse(sel.id)}
            />
          )}
          {isOwnPulse && (
            <T variant="bodySm" color={light.smoke}>
              Your pulse — it expires on its own.
            </T>
          )}
          {canPulseHere &&
            (act.myPulse ? (
              <T variant="bodySm" color={light.smoke}>
                Your pulse is live at {act.myPulse.venueName}.
              </T>
            ) : (
              <Chip
                label="Pulse here"
                variant="outline"
                onPress={() => {
                  setNote("");
                  setComposing("pulse");
                }}
              />
            ))}
          {canDropEmber &&
            (emberCapLeft > 0 ? (
              <>
                <Chip
                  label="Drop ember"
                  variant="outline"
                  onPress={() => {
                    setNote("");
                    setComposing("ember");
                  }}
                />
                <T variant="bodySm" color={light.smoke}>
                  {emberCapLeft} of {EMBER_WEEKLY_CAP} this week
                </T>
              </>
            ) : (
              <T variant="bodySm" color={light.smoke}>
                Both embers staked this week — make them count.
              </T>
            ))}
          {sel.kind === "personal" && alreadyOnGroupMap && (
            <T variant="bodySm" color={light.smoke}>
              Already glowing on the group map.
            </T>
          )}
        </View>
      )}
    </Card>
  );
}

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
          kind: "info",
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
        kind: "info",
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

      {/* Venue card (spec §Screens 3) — keyed by selection so compose state resets */}
      {sel ? (
        <View style={{ position: "absolute", left: 20, right: 20, bottom: 76 }}>
          <SelectionCard
            key={sel.id ?? sel.title}
            sel={sel}
            onClose={() => setSel(null)}
            onViewGroupMap={() => setMode("group")}
          />
        </View>
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
