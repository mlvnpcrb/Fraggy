import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fonts } from "../theme";
import { Button } from "./Button";
export function EmptyState({
  title,
  message,
  action,
  onPress,
}: {
  title: string;
  message: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={s.box}>
      <Feather name="inbox" size={32} color={colors.green} />
      <Text style={s.title}>{title}</Text>
      <Text style={s.message}>{message}</Text>
      {action && onPress && <Button title={action} onPress={onPress} />}
    </View>
  );
}
const s = StyleSheet.create({
  box: { padding: 28, gap: 16, alignItems: "center" },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.ink,
    textAlign: "center",
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    color: colors.muted,
    textAlign: "center",
  },
});
