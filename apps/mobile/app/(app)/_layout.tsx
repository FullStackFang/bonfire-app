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
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="flame" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="around"
        options={{
          title: "Around",
          tabBarIcon: ({ color, size }) => <Ionicons name="location" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          title: "Network",
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color, size }) => <Ionicons name="mail" size={size} color={color} />,
        }}
      />
      {/* Routes that exist but shouldn't appear in the tab bar. Expo Router
          auto-discovers every file under (app)/, so each nested route needs
          an explicit href: null to stay out of the bottom bar. */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="profile/index" options={{ href: null }} />
      <Tabs.Screen name="profile/settings" options={{ href: null }} />
      <Tabs.Screen name="profile/[id]" options={{ href: null }} />
      <Tabs.Screen name="network/add" options={{ href: null }} />
      <Tabs.Screen name="network/circle/[id]" options={{ href: null }} />
    </Tabs>
  );
}
