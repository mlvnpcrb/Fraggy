import { Stack } from "expo-router";
import { theme } from "../src/theme";
export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.ink,
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="add" options={{ title: "Add Perfume" }} />
    </Stack>
  );
}
