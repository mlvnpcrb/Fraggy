import React from "react";
import { ActivityIndicator, View, Pressable, Text } from "react-native";
import {
  NavigationContainer,
  DefaultTheme,
  useNavigation,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useBeta } from "./context";
import {
  BottleScreen,
  CollectorScreen,
  DiscoverScreen,
  ShelfScreen,
} from "./CollectionScreens";
import { InboxScreen, TradeScreen, TradesScreen } from "./TradeScreens";
import { AdminScreen, SettingsScreen } from "./AccountScreens";
import { colors, fonts } from "../theme";
import { useReducedMotion } from "../components/Motion";
import type { BetaStack } from "./navigation";
import { CaptureScreen } from "../features/capture/CaptureScreen";
import {
  ProfileHub,
  ActivityScreen,
  WishlistScreen,
  PrivacyPreviewScreen,
  SupportScreen,
} from "../features/account/Screens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProposalScreen } from "../features/trades/ProposalScreen";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
const Stack = createNativeStackNavigator<BetaStack>(),
  Tab = createBottomTabNavigator();
function Tabs() {
  const navigation = useNavigation<NativeStackNavigationProp<BetaStack>>(),
    insets = useSafeAreaInsets();
  const b = useBeta(),
    unread = b.state.notifications.filter((n) => !n.read_at).length;
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenListeners={({ route }) => ({
          focus: () =>
            void b.refresh(
              route.name === "Discover"
                ? ["collection", "community"]
                : route.name === "My Shelf"
                  ? ["collection", "jobs"]
                  : route.name === "Trades"
                    ? ["trading", "collection", "community"]
                    : ["account", "community"],
            ),
        })}
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
        <Tab.Screen name="Profile" component={ProfileHub} />
      </Tab.Navigator>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Capture a bottle"
        onPress={() => navigation.navigate("Capture", {})}
        style={({ pressed }) => ({
          position: "absolute",
          right: 20,
          bottom: insets.bottom + 62,
          borderRadius: 30,
          minHeight: 52,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: colors.green,
          opacity: pressed ? 0.75 : 1,
          borderWidth: 1,
          borderColor: colors.ivory,
        })}
      >
        <Feather name="camera" size={20} color={colors.ivory} />
        <Text
          style={{ color: colors.ivory, fontFamily: fonts.bold, fontSize: 14 }}
        >
          Capture
        </Text>
      </Pressable>
    </View>
  );
}
export function BetaNavigator() {
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
        <Stack.Screen name="Proposal" component={ProposalScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Activity" component={ActivityScreen} />
        <Stack.Screen name="Wishlist" component={WishlistScreen} />
        <Stack.Screen name="PrivacyPreview" component={PrivacyPreviewScreen} />
        <Stack.Screen name="Support" component={SupportScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
