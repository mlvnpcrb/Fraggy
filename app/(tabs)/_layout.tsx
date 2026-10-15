import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../src/theme";
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        headerShown: false,
        tabBarStyle: { height: 72, paddingBottom: 12 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={
              route.name === "index"
                ? "albums-outline"
                : route.name === "discover"
                  ? "search-outline"
                  : route.name === "trades"
                    ? "swap-horizontal-outline"
                    : "person-outline"
            }
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Shelf" }} />
      <Tabs.Screen name="discover" options={{ title: "Explore" }} />
      <Tabs.Screen name="trades" options={{ title: "Trades" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
