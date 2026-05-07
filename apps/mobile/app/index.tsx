import { View, Text } from "react-native";
import { STATUS_LABEL, STATUS_ORDER } from "@bonfire/shared";
import { colors, statusColor } from "@bonfire/ui-tokens";

export default function Home() {
  return (
    <View className="flex-1 items-center justify-center bg-bg px-6">
      <View
        className="absolute -inset-32 rounded-full opacity-30"
        style={{ backgroundColor: colors.accentGlow }}
      />
      <Text className="text-text-inverse text-4xl font-semibold tracking-tight">
        Bonfire
      </Text>
      <Text className="text-text-inverse-muted mt-3 text-base">
        Day 1 — workspace boots, NativeWind alive
      </Text>

      <View className="mt-10 gap-3">
        {STATUS_ORDER.map((s) => (
          <View key={s} className="flex-row items-center gap-3">
            <View
              className="h-3 w-3 rounded-full"
              style={{
                backgroundColor: statusColor[s],
                shadowColor: statusColor[s],
                shadowOpacity: 0.6,
                shadowRadius: 8,
              }}
            />
            <Text className="text-text-inverse-muted text-sm">
              {STATUS_LABEL[s]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
