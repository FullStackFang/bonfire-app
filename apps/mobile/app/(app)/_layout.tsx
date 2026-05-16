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
          height: 84,
          paddingTop: 8,
          paddingBottom: 24,
        },
        tabBarLabelStyle: {
          fontFamily: "Onest_500Medium",
          fontSize: 11,
          marginTop: 2,
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
    </Tabs>
  );
}
