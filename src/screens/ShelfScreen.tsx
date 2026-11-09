import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { PerfumeCabinet } from "../components/PerfumeCabinet";
import { Filters, ui } from "../components/ui";
import { colors, fonts } from "../theme";
import { useDemo } from "../state/DemoProvider";
import type { RootStackParamList } from "../navigation";
export function ShelfScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bottles } = useDemo();
  const [filter, setFilter] = useState("all");
  const mine = bottles.filter((b) => b.ownerId === "you");
  const visible = mine.filter((b) => filter === "all" || b.tradeAvailable);
  const add = () => navigation.navigate("AddBottle");
  return (
    <Screen>
      <View style={s.header}>
        <View style={[ui.row, { flexWrap: "wrap" }]}>
          <Text style={s.logo}>
            fraggy<Text style={{ color: "#71964D" }}>.</Text>
          </Text>
          <View style={s.counter}>
            <Feather name="grid" size={13} color={colors.green} />
            <Text style={s.counterText}>YOUR COLLECTION</Text>
          </View>
        </View>
        <View style={[ui.row, { marginTop: 23, alignItems: "center" }]}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={s.title}>
              Your scent shelf.
            </Text>
            <Text style={s.subtitle}>
              {mine.length} BOTTLES. ENDLESS POSSIBILITIES.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a bottle"
            onPress={add}
            style={s.add}
          >
            <Feather name="plus" size={23} color={colors.green} />
          </Pressable>
        </View>
        <Filters
          value={filter}
          onChange={setFilter}
          items={[
            { id: "all", label: "All bottles" },
            { id: "swap", label: "Open to swap" },
          ]}
        />
      </View>
      <View style={s.collection}>
        <PerfumeCabinet
          bottles={visible}
          onBottle={(b) => navigation.navigate("BottleDetail", { id: b.id })}
          onAdd={add}
        />
        <View style={s.hint}>
          <Feather name="camera" size={17} color={colors.green} />
          <Text style={s.hintText}>Snap it. Cut it out. Shelf it.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Photograph a bottle"
            onPress={add}
            style={{ padding: 12 }}
          >
            <Feather name="arrow-up-right" size={21} color={colors.green} />
          </Pressable>
        </View>
        <Text style={s.footnote}>
          Tap a bottle to explore. Tap an empty space to add yours.
        </Text>
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 8 },
  logo: {
    fontFamily: fonts.bold,
    fontSize: 32,
    letterSpacing: -2,
    color: colors.green,
  },
  counter: { flexDirection: "row", alignItems: "center", gap: 7 },
  counterText: {
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1.1,
    color: colors.green,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 29,
    letterSpacing: -1.4,
    color: colors.green,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 7.5,
    letterSpacing: 1,
    color: colors.muted,
    marginTop: 10,
  },
  add: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lime,
  },
  collection: { paddingHorizontal: 16 },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 15,
    marginTop: 18,
    backgroundColor: colors.pale,
    borderRadius: 16,
  },
  hintText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.green,
    flex: 1,
  },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
    marginTop: 15,
    paddingHorizontal: 16,
  },
});
