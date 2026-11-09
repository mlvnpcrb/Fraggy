import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fonts } from "../theme";
export const ui = StyleSheet.create({
  pad: { paddingHorizontal: 24 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 36,
    lineHeight: 41,
    letterSpacing: -1.7,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    color: colors.muted,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.muted,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  section: {
    fontFamily: fonts.bold,
    fontSize: 20,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  card: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  small: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
});
export function BackHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={[ui.row, { paddingHorizontal: 16, paddingBottom: 16 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        style={{ padding: 12 }}
      >
        <Feather name="arrow-left" size={22} color={colors.green} />
      </Pressable>
      <Text style={ui.eyebrow}>{title}</Text>
      <View style={{ width: 44 }} />
    </View>
  );
}
export function Filters<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginVertical: 20,
      }}
    >
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onChange(item.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === item.id }}
          style={{
            minHeight: 44,
            paddingHorizontal: 17,
            paddingVertical: 12,
            borderRadius: 24,
            backgroundColor: value === item.id ? colors.green : "transparent",
            borderWidth: 1,
            borderColor: value === item.id ? colors.green : colors.line,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 12,
              color: value === item.id ? colors.ivory : colors.muted,
            }}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
