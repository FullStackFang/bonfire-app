import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { light } from "@bonfire/ui-tokens";
import { T } from "../ui";
import type { CircleWithMembers } from "@bonfire/shared";

// Bottom-left filter chip, opposite the FAB. Single tap cycles through filters
// (All → circle 1 → circle 2 → ...). Long-press opens a compact popover above
// the chip so users can jump directly to a specific circle. Hidden when the
// user has no circles.

export interface CircleFilterChipProps {
  circles: CircleWithMembers[];
  activeCircleId: string | null; // null = All
  onSelect: (circleId: string | null) => void;
  // Vertical offset from the screen bottom. Mirrors the FAB's bottomOffset so
  // the two controls sit on the same horizontal line and lift together when
  // the Bonfires-Nearby footer is visible.
  bottomOffset: number;
}

const CHIP_HEIGHT = 36;
const POPOVER_GAP = 10;

export function CircleFilterChip({
  circles,
  activeCircleId,
  onSelect,
  bottomOffset,
}: CircleFilterChipProps) {
  const [open, setOpen] = useState(false);

  if (circles.length === 0) return null;

  const active = activeCircleId
    ? circles.find((c) => c.id === activeCircleId)
    : null;
  const label = active?.name ?? "All circles";

  const cycle = () => {
    Haptics.selectionAsync().catch(() => {});
    const sequence: (string | null)[] = [null, ...circles.map((c) => c.id)];
    const i = sequence.indexOf(activeCircleId);
    const next = sequence[(i + 1) % sequence.length];
    onSelect(next);
  };

  const openPicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setOpen(true);
  };

  return (
    <>
      <View
        style={{
          position: "absolute",
          left: 18,
          bottom: bottomOffset,
        }}
      >
        <Pressable
          onPress={cycle}
          onLongPress={openPicker}
          delayLongPress={280}
          accessibilityRole="button"
          accessibilityLabel={`Map filter: ${label}. Tap to cycle, hold to pick a circle.`}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            columnGap: 6,
            height: CHIP_HEIGHT,
            paddingHorizontal: 12,
            backgroundColor: light.hearth,
            borderWidth: 1,
            borderColor: light.ash,
            borderRadius: 999,
            shadowColor: light.warmShadow,
            shadowOpacity: pressed ? 0.2 : 0.35,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 6,
            elevation: 3,
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: activeCircleId ? light.ember : light.smoke,
            }}
          />
          <T
            variant="bodySm"
            style={{ fontFamily: "Onest_600SemiBold", color: light.coal }}
            numberOfLines={1}
          >
            {label}
          </T>
          <Ionicons name="chevron-down" size={12} color={light.smoke} />
        </Pressable>
      </View>

      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.04)" }}
          onPress={() => setOpen(false)}
        >
          <View
            // Block backdrop taps from bubbling out of the popover.
            onStartShouldSetResponder={() => true}
            style={{
              position: "absolute",
              left: 18,
              bottom: bottomOffset + CHIP_HEIGHT + POPOVER_GAP,
              width: 220,
              backgroundColor: light.hearth,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: light.ash,
              padding: 12,
              shadowColor: "#000",
              shadowOpacity: 0.14,
              shadowOffset: { width: 0, height: 8 },
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <T
              variant="overline"
              color={light.smoke}
              style={{ marginBottom: 8, letterSpacing: 1.2 }}
            >
              Show on map
            </T>
            <Option
              label="All circles"
              active={activeCircleId === null}
              onPress={() => {
                onSelect(null);
                setOpen(false);
              }}
            />
            {circles.map((c) => (
              <Option
                key={c.id}
                label={c.name}
                active={activeCircleId === c.id}
                onPress={() => {
                  onSelect(c.id);
                  setOpen(false);
                }}
              />
            ))}

            {/* Downward tail pointing at the chip below. */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: -6,
                left: 22,
                width: 12,
                height: 12,
                backgroundColor: light.hearth,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: light.ash,
                transform: [{ rotate: "45deg" }],
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function Option({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        columnGap: 10,
        paddingVertical: 8,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          borderWidth: 1.5,
          borderColor: active ? light.ember : light.smoke,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {active ? (
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: light.ember,
            }}
          />
        ) : null}
      </View>
      <T variant="bodySm" style={{ flex: 1, color: light.coal }}>
        {label}
      </T>
    </Pressable>
  );
}
