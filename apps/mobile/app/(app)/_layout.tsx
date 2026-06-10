import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { light } from "@bonfire/ui-tokens";

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: light.ember,
        tabBarInactiveTintColor: light.smoke,
        tabBarStyle: {
          backgroundColor: light.hearth,
          borderTopColor: light.ash,
          borderTopWidth: 0.5,
          height: 64,
          paddingTop: 6,
          paddingBottom: 12,
        },
        tabBarLabelStyle: {
          fontFamily: "Onest_500Medium",
          fontSize: 11,
          marginTop: 0,
        },
      }}
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
