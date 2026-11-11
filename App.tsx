import React from "react";
import { BetaApp } from "./src/beta/App";
import { ActivityIndicator, Text, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { DemoProvider } from "./src/state/DemoProvider";
import { ShelfScreen } from "./src/screens/ShelfScreen";
import { DiscoverScreen } from "./src/screens/DiscoverScreen";
import { TradesScreen } from "./src/screens/TradesScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { AddBottleScreen } from "./src/screens/AddBottleScreen";
import { BottleDetailScreen } from "./src/screens/BottleDetailScreen";
import { TradeDetailScreen } from "./src/screens/TradeDetailScreen";
import { colors, fonts } from "./src/theme";
import { useReducedMotion } from "./src/components/Motion";
import type { RootStackParamList } from "./src/navigation";
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();
function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: "#7D8778",
        tabBarStyle: {
          backgroundColor: colors.ivory,
          borderTopColor: colors.line,
          height: 84,
          paddingTop: 9,
          paddingBottom: 20,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bold,
          fontSize: 10,
          marginTop: 4,
        },
        tabBarIcon: ({ color, size }) => (
          <Feather
            color={color}
            size={size - 2}
            name={
              route.name === "My Shelf"
                ? "grid"
                : route.name === "Discover"
                  ? "compass"
                  : route.name === "Trades"
                    ? "repeat"
                    : "user"
            }
          />
        ),
      })}
    >
      <Tab.Screen name="My Shelf" component={ShelfScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Trades" component={TradesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
export default function App() {
  const reducedMotion = useReducedMotion();
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
  if (!(__DEV__ && process.env.EXPO_PUBLIC_DEMO_MODE === "true"))
    return (
      <SafeAreaProvider>
        <BetaApp />
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <DemoProvider>
        <NavigationContainer
          theme={{
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              primary: colors.green,
              background: colors.ivory,
              card: colors.ivory,
              text: colors.ink,
              border: colors.line,
            },
          }}
        >
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animation: reducedMotion ? "none" : "fade_from_bottom",
              animationDuration: 200,
              contentStyle: { backgroundColor: colors.ivory },
            }}
          >
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen
              name="AddBottle"
              component={AddBottleScreen}
              options={{ presentation: "modal" }}
            />
            <Stack.Screen name="BottleDetail" component={BottleDetailScreen} />
            <Stack.Screen name="TradeDetail" component={TradeDetailScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </DemoProvider>
    </SafeAreaProvider>
  );
}
