import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Avatar } from "./Avatar";
import { T } from "./Text";
import { light } from "@bonfire/ui-tokens";
import { useSession } from "../../lib/session";

// Shared top-of-screen header. Every tab uses this so the profile avatar
// always lives at the same place (top-right) and titles/actions follow one
// rhythm. See DESIGN.md §5 Navigation for the rationale.

export interface AppHeaderProps {
  // Title text shown as displayLg, left-aligned. Ignored if `leading` is provided.
  title?: string;
  // Custom left content (e.g. the home screen's search pill). Takes the flex
  // slot — fills the remaining horizontal space.
  leading?: React.ReactNode;
  // Per-tab right action: icon button, text link, etc. Sits left of the avatar.
  rightAction?: React.ReactNode;
  // Hide the avatar (e.g. on profile screen itself). Defaults to true.
  showAvatar?: boolean;
}

export function AppHeader({
  title,
  leading,
  rightAction,
  showAvatar = true,
}: AppHeaderProps) {
  const { user } = useSession();

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 4,
        flexDirection: "row",
        alignItems: "center",
        columnGap: 12,
      }}
    >
      {leading ? (
        <View style={{ flex: 1 }}>{leading}</View>
      ) : title ? (
        <T variant="displayLg" style={{ flex: 1 }}>
          {title}
        </T>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {rightAction}
      {showAvatar ? (
        <Pressable
          onPress={() => router.push("/(app)/profile")}
          hitSlop={8}
          accessibilityLabel="Open profile"
          accessibilityRole="button"
        >
          <Avatar
            label={user?.letter_pair || "G"}
            color={user?.avatar_color || light.ember}
            size="md"
          />
        </Pressable>
      ) : null}
    </View>
  );
}
