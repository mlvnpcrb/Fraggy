import React, { useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { Bottle } from "../components/Bottle";
import { Filters, ui } from "../components/ui";
import { EmptyState } from "../components/EmptyState";
import { colors, fonts } from "../theme";
import { useDemo } from "../state/DemoProvider";
import { collectors } from "../data/demo";
import type { RootStackParamList } from "../navigation";
export function DiscoverScreen() {
  const { bottles } = useDemo();
  const [method, setMethod] = useState("all");
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const available = bottles.filter(
    (b) =>
      b.ownerId !== "you" &&
      b.tradeAvailable &&
      !b.reservedTradeId &&
      (method === "all" || b.methods.includes(method as "local" | "shipping")),
  );
  return (
    <Screen>
      <View style={[ui.pad, { paddingTop: 26 }]}>
        <View style={ui.row}>
          <Text style={ui.eyebrow}>THE SCENT SCENE</Text>
          <Feather name="compass" size={23} color={colors.green} />
        </View>
        <Text accessibilityRole="header" style={[ui.title, { marginTop: 22 }]}>
          Find your next{`\n`}obsession
          <Text style={{ color: colors.green }}>.</Text>
        </Text>
        <Text style={[ui.body, { marginTop: 12 }]}>
          Someone’s shelf-worthy is your next signature.
        </Text>
        <Filters
          value={method}
          onChange={setMethod}
          items={[
            { id: "all", label: "All swaps" },
            { id: "local", label: "Local meetup" },
            { id: "shipping", label: "Shipping" },
          ]}
        />
        <View style={[ui.row, { marginBottom: 18 }]}>
          <Text style={ui.eyebrow}>OPEN TO SOMETHING NEW</Text>
          <Text style={ui.small}>{available.length} finds</Text>
        </View>
        {available.map((b, i) => (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            accessibilityLabel={`Discover ${b.name}`}
            onPress={() => nav.navigate("BottleDetail", { id: b.id })}
            style={s.card}
          >
            <View
              style={[
                s.image,
                { backgroundColor: i % 2 ? colors.pale : colors.soft },
              ]}
            >
              <View
                style={{ transform: [{ rotate: i % 2 ? "-7deg" : "6deg" }] }}
              >
                <Bottle bottle={b} size={220} />
              </View>
              <View style={s.badge}>
                <Text style={s.badgeText}>UP FOR A SWAP ↗</Text>
              </View>
            </View>
            <View style={{ padding: 18, gap: 8 }}>
              <View style={ui.row}>
                <Text style={[ui.eyebrow, { flex: 1 }]}>{b.brand}</Text>
                <Feather name="arrow-up-right" size={18} color={colors.green} />
              </View>
              <Text style={[ui.section, { fontSize: 23 }]}>{b.name}</Text>
              <Text style={ui.small}>
                {b.sizeMl} ml · {b.remainingPercent}% remaining
              </Text>
              <View
                style={[
                  ui.row,
                  {
                    borderTopWidth: 1,
                    borderColor: colors.line,
                    paddingTop: 14,
                    marginTop: 6,
                  },
                ]}
              >
                <Text style={ui.label}>
                  {collectors[b.ownerId]?.name ?? "Collector"}
                </Text>
                <Text style={ui.small}>
                  {collectors[b.ownerId]?.city} · Sample
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
        {!available.length && (
          <EmptyState
            title="All good things take time."
            message="No sample bottles match this filter. Try another method or reset your demo."
          />
        )}
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    marginBottom: 22,
  },
  image: { height: 264, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    left: 16,
    top: 16,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.lime,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.green,
  },
});
