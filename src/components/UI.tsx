import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { theme } from "../theme";
export function Heading({ children, sub }: { children: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={styles.title}>{children}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
export function Action({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.button}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "800", color: theme.ink },
  sub: { fontSize: 13, color: theme.muted, marginTop: 7 },
  card: {
    backgroundColor: theme.card,
    padding: 18,
    borderRadius: 18,
    marginBottom: 12,
  },
  button: {
    backgroundColor: theme.accent,
    padding: 16,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
