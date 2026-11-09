import React from "react";
import { Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import { colors, fonts } from "../theme";
export function Button({
  title,
  onPress,
  variant = "green",
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "green" | "lime" | "outline";
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "lime"
          ? styles.lime
          : variant === "outline"
            ? styles.outline
            : styles.green,
        { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: variant === "green" ? colors.ivory : colors.green },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  green: { backgroundColor: colors.green },
  lime: { backgroundColor: colors.lime },
  outline: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "transparent",
  },
  text: { fontFamily: fonts.bold, fontSize: 14, textAlign: "center" },
});
