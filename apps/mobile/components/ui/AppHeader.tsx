import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Avatar } from "./Avatar";
import { T } from "./Text";
import { light } from "@bonfire/ui-tokens";
import { useSession } from "../../lib/session";

// Shared top-of-screen header. Every tab uses this so the profile avatar
// always lives at the same place (top-right) and titles/actions follow one
// rhythm. See DESIGN.md §5 Navigation for the rationale.
//
// Owns the top safe-area inset itself so the hearth bar paints all the way
// up to the device top. Screens hosting AppHeader should omit "top" from
// their SafeAreaView edges, otherwise the inset is padded twice.

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
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        columnGap: 12,
        backgroundColor: light.hearth,
        borderBottomWidth: 1,
        borderBottomColor: light.ash,
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
