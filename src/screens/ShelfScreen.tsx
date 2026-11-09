import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { Bottle } from "../components/Bottle";
import { BottleEntrance } from "../components/Motion";
import { EmptyState } from "../components/EmptyState";
import { Filters, ui } from "../components/ui";
import { colors, fonts } from "../theme";
import { useDemo } from "../state/DemoProvider";
import { ME } from "../domain/types";
import type { RootStackParamList } from "../navigation";
export function ShelfScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bottles } = useDemo();
  const [filter, setFilter] = useState("all");
  const { width, fontScale } = useWindowDimensions();
  const mine = bottles.filter((b) => b.ownerId === ME);
  const visible = mine.filter((b) => filter === "all" || b.tradeAvailable);
  const single = width < 350 || fontScale > 1.4;
  return (
    <Screen dark>
      <View style={s.header}>
        <View style={ui.row}>
          <Text style={s.logo}>
            fraggy<Text style={{ color: colors.lime }}>.</Text>
          </Text>
          <View style={s.avatar}>
            <Text
              style={{
                fontFamily: fonts.bold,
                color: colors.lime,
                fontSize: 12,
              }}
            >
              YOU
            </Text>
          </View>
        </View>
        <View style={[ui.row, { marginTop: 35, alignItems: "flex-end" }]}>
          <Text accessibilityRole="header" style={s.headline}>
            Your scent{`\n`}rotation.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a bottle"
            onPress={() => navigation.navigate("AddBottle")}
            style={s.add}
          >
            <Feather name="plus" size={27} color={colors.green} />
          </Pressable>
        </View>
        <View style={[ui.row, { marginTop: 20 }]}>
          <Text style={s.sub}>
            {mine.length} BOTTLES. ENDLESS POSSIBILITIES.
          </Text>
          <Feather name="arrow-down-right" color={colors.lime} size={22} />
        </View>
      </View>
      <View style={s.content}>
        <View style={ui.row}>
          <Text style={ui.eyebrow}>THE COLLECTION</Text>
          <Text style={ui.small}>Curated by you</Text>
        </View>
        <Filters
          items={[
            { id: "all", label: "All bottles" },
            { id: "swap", label: "Open to swap" },
          ]}
          value={filter}
          onChange={setFilter}
        />
        {visible.length === 0 ? (
          <EmptyState
            title={
              filter === "all"
                ? "Your shelf starts here."
                : "Keeping these close."
            }
            message={
              filter === "all"
                ? "Add your first bottle and make this space yours."
                : "No bottles open to swap yet. Add one with trading enabled."
            }
            action="Add a bottle"
            onPress={() => navigation.navigate("AddBottle")}
          />
        ) : (
          <View style={s.grid}>
            {visible.map((b, i) => (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityLabel={`View ${b.name}${b.reservedTradeId ? ", reserved for trade" : ""}`}
                onPress={() =>
                  navigation.navigate("BottleDetail", { id: b.id })
                }
                style={{ width: single ? "100%" : "47%", marginBottom: 26 }}
              >
                <View style={s.stage}>
                  <View
                    style={{
                      transform: [
                        {
                          rotate:
                            i % 3 === 0
                              ? "-5deg"
                              : i % 3 === 1
                                ? "4deg"
                                : "0deg",
                        },
                      ],
                    }}
                  >
                    <BottleEntrance>
                      <Bottle bottle={b} size={single ? 210 : 180} />
                    </BottleEntrance>
                  </View>
                  <View style={s.ledge} />
                </View>
                <Text
                  style={[
                    ui.eyebrow,
                    { fontSize: 8, letterSpacing: 1, marginTop: 14 },
                  ]}
                >
                  {b.brand}
                </Text>
                <Text style={[ui.name, { marginTop: 5 }]}>{b.name}</Text>
                <Text style={[ui.small, { marginTop: 5 }]}>
                  {b.sizeMl} ml · {b.remainingPercent}% left
                </Text>
                {b.reservedTradeId ? (
                  <Text style={s.tag}>↗ Reserved for trade</Text>
                ) : b.tradeAvailable ? (
                  <Text style={s.tag}>↔ Open to swap</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}
        <View style={s.note}>
          <Feather name="star" size={18} color={colors.green} />
          <Text style={[ui.small, { flex: 1 }]}>
            Good taste. Great company. Make room for your next obsession.
          </Text>
        </View>
        <Text style={[ui.small, { marginTop: 18, textAlign: "center" }]}>
          EXPO PROTOTYPE · ILLUSTRATED SAMPLE BOTTLES
        </Text>
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  header: {
    backgroundColor: colors.green,
    paddingHorizontal: 24,
    paddingTop: 15,
    paddingBottom: 28,
  },
  logo: {
    fontFamily: fonts.bold,
    fontSize: 34,
    color: colors.ivory,
    letterSpacing: -2,
  },
  avatar: {
    borderWidth: 1,
    borderColor: "#53735C",
    borderRadius: 25,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    fontFamily: fonts.bold,
    fontSize: 43,
    lineHeight: 47,
    letterSpacing: -2.5,
    color: colors.ivory,
    flex: 1,
  },
  add: {
    height: 54,
    width: 54,
    borderRadius: 18,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  sub: {
    fontFamily: fonts.medium,
    fontSize: 9,
    letterSpacing: 1,
    color: "#C5D4BC",
    flex: 1,
  },
  content: {
    backgroundColor: colors.ivory,
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  grid: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  stage: {
    height: 212,
    backgroundColor: "#EEEBE2",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 13,
    overflow: "hidden",
  },
  ledge: {
    position: "absolute",
    bottom: 12,
    height: 2,
    left: 12,
    right: 12,
    backgroundColor: "#D8D5C6",
  },
  tag: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.green,
    marginTop: 9,
  },
  note: {
    flexDirection: "row",
    gap: 14,
    padding: 18,
    backgroundColor: colors.pale,
    borderRadius: 16,
    alignItems: "center",
  },
});
