import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { colors } from "./src/theme";
import { AppGate } from "./src/features/app/AppGate";
export default function App() {
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_800ExtraBold,
  });
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.green,
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <ActivityIndicator color={colors.lime} />
        <Text style={{ color: colors.ivory }}>Setting the shelf…</Text>
      </View>
    );
  return (
    <SafeAreaProvider>
      <AppGate />
    </SafeAreaProvider>
  );
}
