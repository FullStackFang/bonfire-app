import { Text, View } from "react-native";
import { Avatar, type AvatarSize } from "./Avatar";
import { light } from "@bonfire/ui-tokens";

export interface AvatarStackItem {
  label: string;
  color: string;
  name?: string;
  live?: boolean;
}

export interface AvatarStackProps {
  avatars: AvatarStackItem[];
  max?: number;
  size?: AvatarSize;
  ringColor?: string;
}

const overlapMap: Record<AvatarSize, number> = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 18,
  hero: 24,
};

const overflowSize: Record<AvatarSize, { box: number; font: number; ring: number }> = {
  xs: { box: 24, font: 9, ring: 1.5 },
  sm: { box: 32, font: 10, ring: 2 },
  md: { box: 40, font: 12, ring: 2 },
  lg: { box: 48, font: 14, ring: 2.5 },
  xl: { box: 64, font: 18, ring: 3 },
  hero: { box: 96, font: 26, ring: 4 },
};

export function AvatarStack({
  avatars,
  max = 4,
  size = "md",
  ringColor = light.hearth,
}: AvatarStackProps) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - visible.length;
  const overlap = overlapMap[size];
  const { box, font, ring } = overflowSize[size];

  return (
    <View className="flex-row">
      {visible.map((a, i) => (
        <View
          key={`${a.label}-${i}`}
          style={{ marginLeft: i === 0 ? 0 : -overlap }}
        >
          <Avatar
            label={a.label}
            color={a.color}
            size={size}
            name={a.name}
            live={a.live}
            ringColor={ringColor}
          />
        </View>
      ))}
      {overflow > 0 ? (
        <View
          style={{
            marginLeft: -overlap,
            width: box,
            height: box,
            borderRadius: box / 2,
            backgroundColor: light.smoke,
            borderWidth: ring,
            borderColor: ringColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: light.hearth,
              fontFamily: "Onest_600SemiBold",
              fontSize: font,
              includeFontPadding: false,
            }}
          >
            +{overflow}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
