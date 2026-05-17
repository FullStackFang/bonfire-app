import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { light } from "@bonfire/ui-tokens";
import { AvatarStack, type AvatarStackItem } from "../ui";
import type { MapEvent } from "../../lib/mockEventStore";

export type NearbyEvent = MapEvent & { distanceKm: number };

export interface BonfiresNearbyProps {
  count: number;
  // Pre-resolved attendees to render in the stack. Caller decides who appears
  // (typically: hosts of the nearby events). The "+N" overflow is auto-
  // computed by AvatarStack against `max`.
  attendees: AvatarStackItem[];
  onPress: () => void;
}

const MAX_AVATARS = 4;

// Falls back to a flame icon when no host avatars have resolved yet so the
// pill stays visible during the initial data race between useMapEvents and
// usePeople.
export function BonfiresNearby({ count, attendees, onPress }: BonfiresNearbyProps) {
  if (count <= 0) return null;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${count} bonfires near you`}
      style={({ pressed }) => ({
        alignSelf: "flex-start",
        backgroundColor: light.cream,
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        columnGap: 8,
        shadowColor: light.warmShadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 5,
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      {attendees.length > 0 ? (
        <AvatarStack avatars={attendees} max={MAX_AVATARS} size="md" />
      ) : (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: light.hearth,
            borderWidth: 2,
            borderColor: light.hearth,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="flame" size={20} color={light.ember} />
        </View>
      )}
    </Pressable>
  );
}
