import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { light } from "@bonfire/ui-tokens";
import { T } from "./Text";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<SegmentedControlOption<T>>;
}

// Pill segmented control. Hearth-on-ash track, ember-on-hearth active segment.
// Used for short option sets (2-4 items) where all choices fit horizontally.

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: SegmentedControlProps<T>) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: light.hearth,
        borderRadius: 14,
        padding: 4,
        borderWidth: 1,
        borderColor: light.ash,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(opt.value);
            }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: active ? light.ember : "transparent",
              alignItems: "center",
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
          >
            <T
              variant="bodySm"
              color={active ? light.hearth : light.smoke}
              style={{ fontFamily: "Onest_600SemiBold" }}
            >
              {opt.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
