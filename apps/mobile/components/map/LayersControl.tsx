import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ChunkyPressable, T } from "../ui";
import { light } from "@bonfire/ui-tokens";

// On-map layer toggle: a chunky round button that opens an inline popover
// with Friends / Bonfires / Heatmap switches. The host screen owns the
// boolean state and persistence — this is a pure controlled control.

export interface LayerState {
  friends: boolean;
  bonfires: boolean;
  heatmap: boolean;
}

export interface LayersControlProps {
  value: LayerState;
  onChange: (next: LayerState) => void;
}

export function LayersControl({ value, onChange }: LayersControlProps) {
  const [open, setOpen] = useState(false);

  const toggle = (key: keyof LayerState) => {
    onChange({ ...value, [key]: !value[key] });
  };

  return (
    <View style={{ alignItems: "flex-end" }}>
      {open ? (
        <View
          style={{
            position: "absolute",
            bottom: 60,
            right: 0,
            width: 200,
            backgroundColor: light.hearth,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: light.ash,
            paddingVertical: 6,
            paddingHorizontal: 4,
            shadowColor: light.warmShadow,
            shadowOpacity: 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <Row
            label="Friends"
            icon="people"
            on={value.friends}
            onPress={() => toggle("friends")}
          />
          <Row
            label="Bonfires"
            icon="flame"
            on={value.bonfires}
            onPress={() => toggle("bonfires")}
          />
          <Row
            label="Heatmap"
            icon="thermometer"
            on={value.heatmap}
            onPress={() => toggle("heatmap")}
          />
        </View>
      ) : null}

      <ChunkyPressable
        onPress={() => setOpen((v) => !v)}
        shadowColor={light.warmShadow}
        depth={4}
        radius={26}
        accessibilityLabel={open ? "Close map layers" : "Open map layers"}
        haptic="selection"
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: light.hearth,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: open ? light.ember : light.warmShadow,
          }}
        >
          <Ionicons
            name="layers"
            size={22}
            color={open ? light.ember : light.coal}
          />
        </View>
      </ChunkyPressable>
    </View>
  );
}

function Row({
  label,
  icon,
  on,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        columnGap: 10,
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: pressed ? light.ash : "transparent",
      })}
    >
      <Ionicons
        name={icon}
        size={16}
        color={on ? light.ember : light.smoke}
      />
      <T
        variant="body"
        style={{
          flex: 1,
          fontFamily: "Onest_600SemiBold",
          color: on ? light.coal : light.smoke,
        }}
      >
        {label}
      </T>
      <Toggle on={on} />
    </Pressable>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <View
      style={{
        width: 32,
        height: 18,
        borderRadius: 9,
        backgroundColor: on ? light.ember : light.ash,
        justifyContent: "center",
        paddingHorizontal: 2,
      }}
    >
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: light.hearth,
          transform: [{ translateX: on ? 14 : 0 }],
        }}
      />
    </View>
  );
}
