import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { BetaProvider, useBeta } from "./Provider";
import { AuthScreen } from "./AuthScreen";
import {
  BottleScreen,
  CaptureScreen,
  CollectorScreen,
  DiscoverScreen,
  ShelfScreen,
} from "./CollectionScreens";
import { InboxScreen, TradeScreen, TradesScreen } from "./TradeScreens";
import { AdminScreen, ProfileScreen } from "./AccountScreens";
import { colors, fonts } from "../theme";
import { useReducedMotion } from "../components/Motion";
import type { BetaStack } from "./navigation";
const Stack = createNativeStackNavigator<BetaStack>(),
  Tab = createBottomTabNavigator();
function Tabs() {
  const b = useBeta(),
    unread = b.state.notifications.filter((n) => !n.read_at).length;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.ivory,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11 },
        tabBarIcon: ({ color, size }) => (
          <Feather
            name={
              route.name === "My Shelf"
                ? "grid"
                : route.name === "Discover"
                  ? "compass"
                  : route.name === "Trades"
                    ? "repeat"
                    : "user"
            }
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tab.Screen name="My Shelf" component={ShelfScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen
        name="Trades"
        component={TradesScreen}
        options={{ tabBarBadge: unread || undefined }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
function Root() {
  const b = useBeta(),
    reduced = useReducedMotion();
  if (b.loading)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.green,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.lime} />
      </View>
    );
  if (!b.session) return <AuthScreen />;
  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: colors.ivory,
          primary: colors.green,
          text: colors.ink,
          card: colors.ivory,
          border: colors.line,
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: reduced ? "none" : "fade_from_bottom",
        }}
      >
        <Stack.Screen name="Home" component={Tabs} />
        <Stack.Screen
          name="Capture"
          component={CaptureScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen name="Bottle" component={BottleScreen} />
        <Stack.Screen name="Collector" component={CollectorScreen} />
        <Stack.Screen name="Trade" component={TradeScreen} />
        <Stack.Screen name="Inbox" component={InboxScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
export function BetaApp() {
  return (
    <BetaProvider>
      <Root />
    </BetaProvider>
  );
}
