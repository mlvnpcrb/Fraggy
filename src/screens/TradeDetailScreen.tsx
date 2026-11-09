import React, { useState } from "react";
import {
  Modal,
  Text,
  View,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Screen } from "../components/Screen";
import { Bottle } from "../components/Bottle";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { BackHeader, ui } from "../components/ui";
import { useDemo } from "../state/DemoProvider";
import { collectors } from "../data/demo";
import { colors, fonts } from "../theme";
import { statusLabel } from "./TradesScreen";
import type { ScreenProps } from "../navigation";
export function TradeDetailScreen({
  navigation,
  route,
}: ScreenProps<"TradeDetail">) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.4;
  const artSize = Math.min(155, Math.max(105, (width - 114) / 1.48));
  const { trades, bottles, act } = useDemo();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(false);
  const [delivery, setDelivery] = useState(false);
  const trade = trades.find((t) => t.id === route.params.id);
  if (!trade)
    return (
      <Screen>
        <BackHeader title="TRADE" onBack={() => navigation.goBack()} />
        <EmptyState
          title="Trade not found."
          message="Your demo may have been reset."
        />
      </Screen>
    );
  const a = bottles.find((b) => b.id === trade.offeredBottleId),
    b = bottles.find((b) => b.id === trade.requestedBottleId);
  if (!a || !b) return null;
  const other =
    trade.proposerId === "you" ? trade.recipientId : trade.proposerId;
  const person = collectors[other]?.name ?? "Collector";
  const finished = trade.status === "complete",
    paused = trade.status === "paused";
  const accepted = trade.status === "in-progress" || finished;
  const received = trade.receivedBy.includes("you"),
    otherReceived = trade.receivedBy.includes(other);
  const action = (kind: "accept" | "receive" | "pause", actor = "you") => {
    try {
      act(trade.id, kind, actor);
      setError("");
      if (kind === "receive")
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update this trade.");
    }
  };
  return (
    <Screen>
      <BackHeader
        title={`SWAP WITH ${person.toUpperCase()}`}
        onBack={() => navigation.goBack()}
      />
      <View style={[ui.pad, { gap: 20 }]}>
        <Text accessibilityRole="header" style={ui.title}>
          {finished ? "New scent.\nNew chapter." : "A good\nswitch-up."}
        </Text>
        <View style={s.status}>
          <View
            style={[
              s.statusDot,
              { backgroundColor: paused ? colors.error : colors.green },
            ]}
          />
          <Text
            style={[ui.label, { color: paused ? colors.error : colors.green }]}
          >
            {statusLabel[trade.status]}
          </Text>
        </View>
        <View
          style={[s.duel, stacked ? { flexDirection: "column" } : undefined]}
        >
          <View style={s.side}>
            <Text style={ui.eyebrow}>YOU SEND</Text>
            <Bottle bottle={a} size={artSize} />
            <Text style={[ui.name, { textAlign: "center" }]}>{a.name}</Text>
            <Text style={[ui.small, { textAlign: "center" }]}>
              {a.sizeMl} ml · {a.remainingPercent}%
            </Text>
          </View>
          <View style={s.vs}>
            <Feather name="repeat" size={20} color={colors.green} />
          </View>
          <View style={s.side}>
            <Text style={ui.eyebrow}>YOU RECEIVE</Text>
            <Bottle bottle={b} size={artSize} />
            <Text style={[ui.name, { textAlign: "center" }]}>{b.name}</Text>
            <Text style={[ui.small, { textAlign: "center" }]}>
              {b.sizeMl} ml · {b.remainingPercent}%
            </Text>
          </View>
        </View>
        <View style={ui.row}>
          <Text style={ui.label}>Exchange method</Text>
          <Text style={ui.name}>
            {trade.method === "local" ? "Local meetup" : "Shipping"}
          </Text>
        </View>
        <View style={{ gap: 22, paddingVertical: 7 }}>
          <Step
            done={accepted}
            title={
              accepted
                ? "Both collectors accepted"
                : "Waiting for mutual acceptance"
            }
            detail={
              accepted
                ? "Both bottles reserved for this swap."
                : "Your offer is accepted on your side."
            }
          />
          <Step
            done={otherReceived}
            title={`${person} ${otherReceived ? "confirmed receipt" : "has not confirmed receipt"}`}
            detail={
              otherReceived
                ? `${a.name} has arrived.`
                : "Their receipt confirmation is still needed."
            }
          />
          <Step
            done={received}
            title={
              received ? "You confirmed receipt" : "Your receipt confirmation"
            }
            detail={
              received
                ? `${b.name} has arrived.`
                : "Confirm only after your bottle is with you."
            }
          />
        </View>
        <View
          style={[
            ui.card,
            {
              backgroundColor: finished ? colors.lime : colors.pale,
              borderWidth: 0,
            },
          ]}
        >
          <Text style={ui.name}>
            {finished ? "A fresh rotation." : "Both sides. One complete swap."}
          </Text>
          <Text style={[ui.body, { marginTop: 8 }]}>
            {finished
              ? `${b.name} is now on your shelf. ${a.name} moved to ${person}’s sample shelf.`
              : paused
                ? "A problem was reported. This demo trade stays paused and reserved until you reset it."
                : "Bottles move shelves only after both collectors confirm receipt. Accepting the offer alone does not transfer ownership."}
          </Text>
        </View>
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.error, fontFamily: fonts.medium }}
          >
            {error}
          </Text>
        )}
        {!finished && !paused && (
          <>
            {trade.status === "in-progress" && !received && (
              <Button
                title="I received my bottle"
                variant="lime"
                onPress={() => setConfirm(true)}
              />
            )}
            <View style={s.demo}>
              <Text style={[ui.eyebrow, { fontSize: 9 }]}>
                DEMO CONTROLS · NOT A REAL COLLECTOR
              </Text>
              <Text style={ui.small}>
                Play the other side to test the full swap.
              </Text>
              {!accepted ? (
                <Button
                  title={`Simulate ${person} accepting`}
                  variant="outline"
                  onPress={() => action("accept", other)}
                />
              ) : !otherReceived ? (
                <Button
                  title={`Simulate ${person} receiving`}
                  variant="outline"
                  onPress={() => action("receive", other)}
                />
              ) : (
                <Text style={ui.small}>
                  {person} has confirmed. Your confirmation is needed to finish.
                </Text>
              )}
            </View>
          </>
        )}
        <Button
          title={message ? "Close conversation preview" : `Message ${person}`}
          variant="outline"
          onPress={() => setMessage(!message)}
        />
        {message && (
          <View style={ui.card}>
            <Text style={ui.eyebrow}>CHAT PREVIEW · NO MESSAGE SENT</Text>
            <Text style={[ui.body, { marginTop: 10 }]}>
              {person}:{" "}
              {trade.method === "local"
                ? "A public meetup spot works for me. Let’s agree on a time."
                : "I’ll share tracking once the bottle is sent."}
            </Text>
            <Text style={[ui.small, { marginTop: 10 }]}>
              Real messaging is not connected in this prototype.
            </Text>
          </View>
        )}
        <Button
          title={delivery ? "Hide exchange details" : "View exchange details"}
          variant="outline"
          onPress={() => setDelivery(!delivery)}
        />
        {delivery && (
          <View style={ui.card}>
            <Text style={ui.name}>
              {trade.method === "local"
                ? "Local meetup preview"
                : "Shipping preview"}
            </Text>
            <Text style={[ui.body, { marginTop: 8 }]}>
              {trade.method === "local"
                ? "Agree on a public meetup location in chat. Inspect the bottles, exchange them, then each confirm receipt."
                : "Arrange shipment together in chat. No real address, label, tracking number, or shipping service is connected here."}
            </Text>
          </View>
        )}
        {!finished && !paused && (
          <Button
            title="Report a problem / pause trade"
            variant="outline"
            onPress={() => action("pause")}
          />
        )}
        <Text style={[ui.small, { textAlign: "center" }]}>
          SAMPLE TRADE · NO PAYMENTS · NO LIVE USERS
        </Text>
      </View>
      <Modal
        transparent
        visible={confirm}
        animationType="fade"
        onRequestClose={() => setConfirm(false)}
      >
        <View style={s.overlay}>
          <View accessibilityViewIsModal style={s.dialog}>
            <Text style={ui.section}>Bottle in hand?</Text>
            <Text style={ui.body}>
              Confirm you received {b.name}. When both collectors confirm, this
              swap completes and ownership changes.
            </Text>
            <Button
              title="Yes, confirm receipt"
              variant="lime"
              onPress={() => {
                action("receive");
                setConfirm(false);
              }}
            />
            <Button
              title="Not yet"
              variant="outline"
              onPress={() => setConfirm(false)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
function Step({
  done,
  title,
  detail,
}: {
  done: boolean;
  title: string;
  detail: string;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 14 }}>
      <View
        style={{
          height: 28,
          width: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: done ? colors.green : colors.soft,
        }}
      >
        <Feather
          name={done ? "check" : "clock"}
          size={14}
          color={done ? colors.lime : colors.muted}
        />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={ui.name}>{title}</Text>
        <Text style={ui.small}>{detail}</Text>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  status: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  duel: {
    backgroundColor: colors.soft,
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  side: { flex: 1, alignItems: "center", gap: 9 },
  vs: {
    height: 33,
    width: 33,
    borderRadius: 17,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  demo: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#A4B293",
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  overlay: {
    flex: 1,
    backgroundColor: "#071A13AA",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    backgroundColor: colors.ivory,
    padding: 24,
    borderRadius: 24,
    gap: 20,
  },
});
