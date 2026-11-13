import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { chooseMode, loadApplication, type ApplicationMode } from "./mode";
import { setRuntimeMode } from "../../beta/runtime";
import { colors, fonts } from "../../theme";
export function AppGate() {
  const [App, setApp] = useState<React.ComponentType<{
      onExit: () => void;
    }> | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState("");
  const open = async (mode: ApplicationMode) => {
    if (loading) return;
    setLoading(true);
    setError("");
    setRuntimeMode(mode);
    try {
      const app = await loadApplication<
        React.ComponentType<{ onExit: () => void }>
      >(mode, {
        live: async () => (await import("../../beta/App")).BetaApp,
        demo: async () => (await import("./DemoApp")).DemoApp,
      });
      setPassword("");
      setApp(() => app);
    } catch {
      setError("Could not open Fraggy. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  if (App)
    return (
      <App
        onExit={() => {
          setApp(null);
          setUsername("");
          setPassword("");
          setRuntimeMode("demo");
        }}
      />
    );
  const button = (label: string, action: () => void, secondary = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: loading }}
      disabled={loading}
      onPress={action}
      style={({ pressed }) => ({
        minHeight: 52,
        padding: 16,
        borderRadius: 28,
        backgroundColor: secondary ? colors.pale : colors.green,
        opacity: pressed ? 0.75 : 1,
        justifyContent: "center",
      })}
    >
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: 16,
          color: secondary ? colors.green : colors.ivory,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ivory }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 24,
            paddingTop: 54,
            gap: 20,
            maxWidth: 520,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 36,
              color: colors.green,
            }}
          >
            fraggy.
          </Text>
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 32,
              color: colors.green,
            }}
          >
            Good scents.{"\n"}Your space.
          </Text>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 17,
              lineHeight: 26,
              color: colors.ink,
            }}
          >
            Your bottles. Your shelves. Your people. Discover fragrance
            collectors and share what you love.
          </Text>
          {button(
            "Explore public shelves",
            () => {
              setRuntimeMode("live");
              setLoading(true);
              void import("../social/Screens")
                .then((module) => setApp(() => module.PublicFeed))
                .catch(() =>
                  setError("Could not open public shelves. Try again."),
                )
                .finally(() => setLoading(false));
            },
            true,
          )}
          {button("Sign in or join the beta", () => void open("live"))}
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 20,
              color: colors.green,
            }}
          >
            Explore the demo
          </Text>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 16,
              color: colors.muted,
            }}
          >
            Use admin / admin. Sample bottles and simulated swaps stay on this
            device.
          </Text>
          <TextInput
            accessibilityLabel="Demo username"
            placeholder="Demo username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              borderColor: colors.muted,
              borderRadius: 12,
              minHeight: 52,
              padding: 14,
              fontSize: 17,
              color: colors.ink,
            }}
          />
          <TextInput
            accessibilityLabel="Demo password"
            placeholder="Demo password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              borderColor: colors.muted,
              borderRadius: 12,
              minHeight: 52,
              padding: 14,
              fontSize: 17,
              color: colors.ink,
            }}
          />
          {button(
            "Open isolated demo",
            () => {
              if (chooseMode(username, password)) void open("demo");
              else
                setError(
                  "Use admin / admin for the demo. Use live sign-in for your collector account.",
                );
            },
            true,
          )}
          {loading && <ActivityIndicator color={colors.green} />}
          {!!error && (
            <Text
              accessibilityRole="alert"
              style={{ color: colors.error, fontSize: 16 }}
            >
              {error}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
