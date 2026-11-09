import React from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { Bottle } from "../components/Bottle";
import { EmptyState } from "../components/EmptyState";
import { ui } from "../components/ui";
import { useDemo } from "../state/DemoProvider";
import { colors } from "../theme";
import { collectors } from "../data/demo";
import type { RootStackParamList } from "../navigation";
export const statusLabel = {
  proposed: "Awaiting acceptance",
  "in-progress": "Exchange in progress",
  paused: "Paused · problem reported",
  complete: "Swap complete",
};
export function TradesScreen() {
  const { trades, bottles } = useDemo();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Screen>
      <View style={[ui.pad, { paddingTop: 26 }]}>
        <Text style={ui.eyebrow}>GOOD SCENTS, BETTER SWAPS</Text>
        <Text accessibilityRole="header" style={[ui.title, { marginTop: 22 }]}>
          The next{`\n`}chapter.
        </Text>
        <Text style={[ui.body, { marginTop: 12, marginBottom: 25 }]}>
          Your bottles have places to be.
        </Text>
        {trades.map((t) => {
          const a = bottles.find((b) => b.id === t.offeredBottleId),
            b = bottles.find((b) => b.id === t.requestedBottleId);
          if (!a || !b) return null;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Trade ${a.name} for ${b.name}`}
              key={t.id}
              onPress={() => nav.navigate("TradeDetail", { id: t.id })}
              style={[ui.card, { marginBottom: 18 }]}
            >
              <View style={ui.row}>
                <Text style={ui.name}>
                  With {collectors[t.recipientId]?.name}
                </Text>
                <Feather name="arrow-up-right" size={20} color={colors.green} />
              </View>
              <View
                style={[
                  ui.row,
                  { marginVertical: 18, justifyContent: "center" },
                ]}
              >
                <Bottle bottle={a} size={115} />
                <Feather name="repeat" size={22} color={colors.green} />
                <Bottle bottle={b} size={115} />
              </View>
              <Text style={ui.name}>
                {a.name} ↔ {b.name}
              </Text>
              <Text style={[ui.small, { marginTop: 8 }]}>
                {t.method === "local" ? "Local meetup" : "Shipping"} ·{" "}
                {statusLabel[t.status]}
              </Text>
            </Pressable>
          );
        })}
        {!trades.length && (
          <EmptyState
            title="Your next swap starts here."
            message="Find a bottle in Discover and propose an exchange."
          />
        )}
      </View>
    </Screen>
  );
}
