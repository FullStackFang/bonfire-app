import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ChunkyTabBar } from "../../components/ui";

export default function AppLayout() {
  return (
    // Custom chunky-chip bar replaces Expo's default flat tab bar. Destinations and Ionicons are
    // unchanged; the bar is icon-only, so the per-screen `title` rides the accessibility label.
    <Tabs
      tabBar={(props) => <ChunkyTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Fire",
          tabBarIcon: ({ color, size }) => <Ionicons name="flame" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="group"
        options={{
          title: "Group",
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      {/* Routes that exist but shouldn't appear in the tab bar. Expo Router
          auto-discovers every file under (app)/, so each nested route needs
          an explicit href: null to stay out of the bottom bar. */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="profile/index" options={{ href: null }} />
      <Tabs.Screen name="profile/settings" options={{ href: null }} />
    </Tabs>
  );
}
