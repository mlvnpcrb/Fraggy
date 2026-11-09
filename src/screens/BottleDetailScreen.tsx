import React, { useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { Bottle } from "../components/Bottle";
import { Button } from "../components/Button";
import { BackHeader, Filters, ui } from "../components/ui";
import { EmptyState } from "../components/EmptyState";
import { useDemo } from "../state/DemoProvider";
import { collectors } from "../data/demo";
import { colors, fonts } from "../theme";
import type { Method } from "../domain/types";
import type { ScreenProps } from "../navigation";
export function BottleDetailScreen({
  navigation,
  route,
}: ScreenProps<"BottleDetail">) {
  const { bottles, propose } = useDemo();
  const bottle = bottles.find((b) => b.id === route.params.id);
  const [selected, setSelected] = useState("");
  const [method, setMethod] = useState<Method>("local");
  const [error, setError] = useState("");
  if (!bottle)
    return (
      <Screen>
        <BackHeader title="BOTTLE" onBack={() => navigation.goBack()} />
        <EmptyState
          title="Bottle not found."
          message="This demo may have been reset. Return to the shelf."
        />
      </Screen>
    );
  const mine = bottle.ownerId === "you";
  const options = bottles.filter(
    (b) =>
      b.ownerId === "you" &&
      b.tradeAvailable &&
      !b.reservedTradeId &&
      b.methods.includes(method),
  );
  const unavailable = !!bottle.reservedTradeId || !bottle.tradeAvailable;
  const submit = () => {
    try {
      const id = propose({
        offeredBottleId: selected,
        requestedBottleId: bottle.id,
        method,
      });
      navigation.replace("TradeDetail", { id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not propose this swap.");
    }
  };
  return (
    <Screen>
      <BackHeader
        title={mine ? "FROM YOUR ROTATION" : "YOUR NEXT OBSESSION?"}
        onBack={() => navigation.goBack()}
      />
      <View style={[ui.pad, { gap: 18 }]}>
        <View style={s.hero}>
          <View style={{ transform: [{ rotate: "-6deg" }] }}>
            <Bottle bottle={bottle} size={280} />
          </View>
          <Text style={s.artLabel}>
            {bottle.imageKind === "cutout"
              ? "BACKGROUND REMOVED"
              : bottle.imageKind === "original"
                ? "ORIGINAL PHOTO"
                : "ILLUSTRATED SAMPLE"}
          </Text>
        </View>
        <Text style={ui.eyebrow}>{bottle.brand}</Text>
        <Text accessibilityRole="header" style={ui.title}>
          {bottle.name}
        </Text>
        <Text style={ui.body}>{bottle.notes}</Text>
        <View style={[ui.card, ui.row]}>
          <View>
            <Text style={ui.name}>{bottle.sizeMl} ml</Text>
            <Text style={ui.small}>Bottle size</Text>
          </View>
          <View>
            <Text style={ui.name}>{bottle.remainingPercent}%</Text>
            <Text style={ui.small}>Remaining</Text>
          </View>
          <Feather name="droplet" size={25} color={colors.green} />
        </View>
        <Text style={ui.label}>
          {mine
            ? "On your shelf"
            : `${collectors[bottle.ownerId]?.name ?? "Collector"} · ${collectors[bottle.ownerId]?.city ?? ""} · Sample collector`}
        </Text>
        {mine ? (
          <View style={ui.card}>
            <Text style={ui.name}>
              {bottle.reservedTradeId
                ? "Reserved for a trade"
                : bottle.tradeAvailable
                  ? "Open to swap"
                  : "Part of your personal rotation"}
            </Text>
            <Text style={[ui.body, { marginTop: 8 }]}>
              {bottle.reservedTradeId
                ? "Both collectors must confirm receipt before ownership changes."
                : "Explore Discover to find a bottle you would trade for."}
            </Text>
          </View>
        ) : unavailable ? (
          <Text style={ui.body}>
            This bottle is currently unavailable for a new swap.
          </Text>
        ) : (
          <>
            <Text style={[ui.section, { marginTop: 12 }]}>
              Make a little switch.
            </Text>
            <Text style={ui.body}>
              Choose an exchange method and a bottle to offer.
            </Text>
            <Filters
              value={method}
              onChange={(v) => {
                setMethod(v);
                setSelected("");
                setError("");
              }}
              items={bottle.methods.map((id) => ({
                id,
                label: id === "local" ? "Local meetup" : "Shipping",
              }))}
            />
            <Text style={ui.eyebrow}>YOUR SIDE OF THE SWAP</Text>
            {options.map((b) => (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityLabel={`Offer ${b.name}`}
                accessibilityState={{ selected: selected === b.id }}
                onPress={() => {
                  setSelected(b.id);
                  setError("");
                }}
                style={[
                  ui.card,
                  ui.row,
                  {
                    borderColor: selected === b.id ? colors.green : colors.line,
                    backgroundColor:
                      selected === b.id ? colors.pale : colors.surface,
                    padding: 12,
                  },
                ]}
              >
                <Bottle bottle={b} size={90} />
                <View style={{ flex: 1 }}>
                  <Text style={ui.name}>{b.name}</Text>
                  <Text style={ui.small}>
                    {b.sizeMl} ml · {b.remainingPercent}% left
                  </Text>
                </View>
                <Feather
                  name={selected === b.id ? "check-circle" : "circle"}
                  size={22}
                  color={colors.green}
                />
              </Pressable>
            ))}
            {!options.length && (
              <EmptyState
                title="Pick a bottle to put in play."
                message="You need an unreserved bottle marked open to swap for this method."
                action="Add a bottle"
                onPress={() => navigation.navigate("AddBottle")}
              />
            )}
            <Text style={ui.small}>
              Proposing accepts your side. The other collector still needs to
              accept. No payment is involved.
            </Text>
            {!!error && (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.error, fontFamily: fonts.medium }}
              >
                {error}
              </Text>
            )}
            <Button
              title="Propose this swap  ↗"
              variant="lime"
              disabled={!selected}
              onPress={submit}
            />
          </>
        )}
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  hero: {
    height: 330,
    backgroundColor: colors.soft,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  artLabel: {
    position: "absolute",
    bottom: 12,
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.muted,
  },
});
