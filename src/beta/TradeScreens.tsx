import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useBeta } from "./Provider";
import {
  Body,
  Button,
  Card,
  Choices,
  Feedback,
  Field,
  Page,
  Photo,
  Toggle,
  useAction,
  styles,
} from "./ui";
import type { BetaStack } from "./navigation";
import type { Exchange } from "./types";
export function TradesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BetaStack>>();
  const b = useBeta();
  return (
    <Page
      title="A good swap starts here."
      subtitle="Your private offers and conversations."
    >
      {!b.state.trades.length && (
        <Body>
          No offers yet. Mark a bottle available, then explore Discover.
        </Body>
      )}
      {b.state.trades.map((t) => (
        <Card key={t.id}>
          <Text style={styles.label}>
            {t.snapshot.offered?.name} ↔ {t.snapshot.requested?.name}
          </Text>
          <Body>
            {t.status} · {t.method}
            {b.state.notifications.some(
              (n) => n.trade_id === t.id && !n.read_at,
            )
              ? " · Unread"
              : ""}
          </Body>
          <Button
            title="Open trade & chat"
            onPress={() => navigation.navigate("Trade", { id: t.id })}
          />
        </Card>
      ))}
    </Page>
  );
}
export function TradeScreen({
  route,
  navigation,
}: NativeStackScreenProps<BetaStack, "Trade">) {
  const b = useBeta(),
    a = useAction(),
    id = route.params.id,
    me = b.session!.user.id;
  const trade = b.state.trades.find((t) => t.id === id);
  const [message, setMessage] = useState(""),
    [reason, setReason] = useState(""),
    [receipt, setReceipt] = useState(false),
    [receiptChecked, setReceiptChecked] = useState(false),
    [exchange, setExchange] = useState<Exchange>(trade?.exchange[me] || {}),
    [rating, setRating] = useState("5"),
    [comment, setComment] = useState(""),
    [cancelConfirm, setCancelConfirm] = useState(false);
  useEffect(() => {
    void b.run("mark_notifications_read", { p_trade: id }).catch(() => {});
  }, [
    id,
    b.state.notifications.filter((n) => n.trade_id === id && !n.read_at).length,
  ]);
  if (!trade)
    return (
      <Page title="Trade unavailable" back={() => navigation.goBack()}>
        <Body>Reconnect and refresh to load this conversation.</Body>
      </Page>
    );
  const other =
      me === trade.proposer_id ? trade.recipient_id : trade.proposer_id,
    ended = ["complete", "declined", "cancelled", "expired"].includes(
      trade.status,
    ),
    accepted = trade.status === "in-progress",
    paused = trade.status === "paused",
    unaccepted = !(
      trade.accepted_by.includes(trade.proposer_id) &&
      trade.accepted_by.includes(trade.recipient_id)
    );
  const action = (p_action: string, p_data: Record<string, unknown> = {}) =>
    b.run("trade_action", { p_trade: id, p_action, p_data });
  return (
    <Page
      title="The exchange."
      subtitle={`${trade.status} · ${trade.method}`}
      back={() => navigation.goBack()}
    >
      <Card>
        <Text style={styles.label}>THE AGREED BOTTLES</Text>
        <Body>
          {trade.snapshot.offered.name} ↔ {trade.snapshot.requested.name}
        </Body>
        {[trade.snapshot.offered, trade.snapshot.requested].map((x) => (
          <View key={x.id} style={{ gap: 10 }}>
            <Photo path={x.image_path} />
            <Body>
              {x.brand} · {x.size_ml} ml · {x.remaining_percent}% ·{" "}
              {x.condition} · {x.has_cap ? "Cap" : "No cap"} ·{" "}
              {x.has_box ? "Box" : "No box"}
            </Body>
            <Body>{x.notes}</Body>
            <Photo path={x.original_path} />
            {x.condition_path && <Photo path={x.condition_path} />}
          </View>
        ))}
        <Body>These photos and details are preserved for this trade.</Body>
      </Card>
      <Feedback {...a} />
      {(trade.status === "proposed" || (paused && unaccepted)) && (
        <>
          <Body>
            Offer expires {new Date(trade.expires_at).toLocaleDateString()}.
            Both collectors must agree before either bottle is reserved.
          </Body>
          {trade.status === "proposed" && !trade.accepted_by.includes(me) && (
            <Button
              title="Accept this exact swap"
              disabled={a.busy}
              onPress={() =>
                void a.act(() => b.run("accept_trade", { p_trade: id }))
              }
            />
          )}
          <Button
            title={
              me === trade.proposer_id
                ? "Withdraw proposal"
                : "Decline proposal"
            }
            secondary
            disabled={a.busy}
            onPress={() =>
              void a.act(() =>
                action(me === trade.proposer_id ? "cancel" : "decline"),
              )
            }
          />
        </>
      )}
      {(accepted || (paused && !unaccepted)) && (
        <>
          <Body>
            {trade.received_by.length}/2 receipts confirmed. Ownership changes
            only after both collectors confirm.
          </Body>
          {paused ? (
            <>
              <Body>
                This trade is paused. Bottles remain reserved while you resolve
                the problem.
              </Body>
              <Button
                title={
                  trade.resume_by.includes(me)
                    ? "Waiting for the other collector to resume"
                    : "Agree to resume"
                }
                disabled={a.busy || trade.resume_by.includes(me)}
                onPress={() => void a.act(() => action("resume"))}
              />
            </>
          ) : (
            <>
              <Card>
                <Body>
                  Private exchange details · visible only to you and the other
                  collector.
                </Body>
                <Field
                  label={
                    trade.method === "local"
                      ? "Meetup instructions"
                      : "Shipping instructions"
                  }
                  value={exchange.instructions || ""}
                  onChangeText={(instructions) =>
                    setExchange({ ...exchange, instructions })
                  }
                  multiline
                  maxLength={800}
                />
                {trade.method === "shipping" && (
                  <>
                    <Field
                      label="Your delivery address & recipient contact"
                      multiline
                      value={exchange.address || ""}
                      onChangeText={(address) =>
                        setExchange({ ...exchange, address })
                      }
                      maxLength={800}
                    />
                    <Field
                      label="Carrier for your outgoing bottle"
                      value={exchange.carrier || ""}
                      onChangeText={(carrier) =>
                        setExchange({ ...exchange, carrier })
                      }
                      maxLength={80}
                    />
                    <Field
                      label="Tracking reference"
                      value={exchange.tracking || ""}
                      onChangeText={(tracking) =>
                        setExchange({ ...exchange, tracking })
                      }
                      maxLength={100}
                    />
                  </>
                )}
                <Button
                  title="Save private details"
                  secondary
                  disabled={a.busy}
                  onPress={() => void a.act(() => action("exchange", exchange))}
                />
                {trade.method === "shipping" && (
                  <Button
                    title={
                      trade.dispatched_by.includes(me)
                        ? "Update dispatch details"
                        : "Confirm I dispatched my bottle"
                    }
                    disabled={a.busy || trade.cancel_by.length > 0}
                    onPress={() =>
                      void a.act(() => action("dispatch", exchange))
                    }
                  />
                )}
                <Body>
                  Other collector’s details:{" "}
                  {Object.entries(trade.exchange[other] || {})
                    .map(([key, value]) => `${key}: ${value}`)
                    .join("\n") || "Not shared yet"}
                </Body>
              </Card>
              {!trade.received_by.includes(me) && (
                <Button
                  title="I received the bottle"
                  disabled={a.busy || trade.cancel_by.length > 0}
                  onPress={() => setReceipt(true)}
                />
              )}{" "}
              {receipt && (
                <Card>
                  <Text accessibilityRole="header" style={styles.label}>
                    CONFIRM ACTUAL RECEIPT
                  </Text>
                  <Body>
                    Only confirm after you physically receive and check the
                    agreed bottle. This cannot be undone. When both collectors
                    confirm, Fraggy transfers ownership on both shelves.
                  </Body>
                  <Toggle
                    label="I received and checked the agreed bottle"
                    value={receiptChecked}
                    onChange={setReceiptChecked}
                  />
                  <Button
                    title="Confirm my receipt"
                    disabled={!receiptChecked || a.busy}
                    onPress={() =>
                      void a.act(async () => {
                        await b.run("confirm_receipt", { p_trade: id });
                        setReceipt(false);
                        setReceiptChecked(false);
                      })
                    }
                  />
                  <Button
                    title="Go back without confirming"
                    secondary
                    onPress={() => setReceipt(false)}
                  />
                </Card>
              )}
            </>
          )}
          {!trade.dispatched_by.length && !trade.received_by.length && (
            <>
              <Button
                title={
                  trade.cancel_by.includes(other)
                    ? "Other collector requests cancellation"
                    : "Request mutual cancellation"
                }
                secondary
                disabled={a.busy}
                onPress={() => setCancelConfirm(true)}
              />
              {cancelConfirm && (
                <Card>
                  <Body>
                    Both collectors must agree. Until then, neither bottle is
                    released and dispatch/receipt is paused.
                  </Body>
                  <Button
                    title="Agree to cancel this trade"
                    disabled={a.busy}
                    onPress={() =>
                      void a.act(async () => {
                        await action("cancel");
                        setCancelConfirm(false);
                      })
                    }
                  />
                  <Button
                    title="Keep this trade"
                    secondary
                    disabled={a.busy}
                    onPress={() =>
                      void a.act(async () => {
                        if (accepted) await action("keep");
                        setCancelConfirm(false);
                      })
                    }
                  />
                </Card>
              )}
            </>
          )}
        </>
      )}
      {(!ended || trade.status === "complete") && (
        <Card>
          <Field
            label="Report an exchange problem"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={500}
          />
          <Button
            title={
              trade.status === "complete"
                ? "Report completed trade"
                : "Report & pause this trade"
            }
            secondary
            disabled={!reason || a.busy}
            onPress={() =>
              void a.act(async () => {
                await b.run("report_problem", {
                  p_trade: id,
                  p_user: other,
                  p_reason: reason,
                });
                setReason("");
              })
            }
          />
        </Card>
      )}
      <Button
        title="View collector"
        secondary
        onPress={() => navigation.navigate("Collector", { id: other })}
      />
      <Text style={styles.label}>PRIVATE CONVERSATION</Text>
      {b.state.messages
        .filter((m) => m.trade_id === id)
        .map((m) => (
          <Card key={m.id}>
            <Text style={styles.label}>
              {m.sender_id === me
                ? "You"
                : b.state.profiles.find((p) => p.id === m.sender_id)?.name ||
                  "Collector"}{" "}
              · {new Date(m.sent_at).toLocaleString()}
            </Text>
            <Body>{m.text}</Body>
          </Card>
        ))}
      <Field
        label="Message"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={1000}
      />
      <Button
        title="Send message"
        disabled={!message.trim() || a.busy || b.offline}
        onPress={() =>
          void a.act(async () => {
            await b.run("send_message", { p_trade: id, p_text: message });
            setMessage("");
          })
        }
      />
      {trade.status === "complete" &&
        !b.state.reviews.some(
          (r) => r.trade_id === id && r.reviewer_id === me,
        ) && (
          <Card>
            <Choices
              label="Review your completed swap"
              values={["1", "2", "3", "4", "5"]}
              value={rating}
              onChange={setRating}
            />
            <Field
              label="Review"
              value={comment}
              onChangeText={setComment}
              maxLength={500}
            />
            <Button
              title="Publish review"
              disabled={a.busy}
              onPress={() =>
                void a.act(() =>
                  b.run("review_trade", {
                    p_trade: id,
                    p_rating: Number(rating),
                    p_comment: comment,
                  }),
                )
              }
            />
          </Card>
        )}
      <Body>
        {b.state.events
          .filter((e) => e.trade_id === id)
          .map((e) => `${new Date(e.created_at).toLocaleString()} · ${e.kind}`)
          .join("\n")}
      </Body>
    </Page>
  );
}
export function InboxScreen({
  navigation,
}: NativeStackScreenProps<BetaStack, "Inbox">) {
  const b = useBeta(),
    a = useAction();
  return (
    <Page title="You’re in the loop." back={() => navigation.goBack()}>
      <Feedback {...a} />
      <Button
        title="Mark all as read"
        secondary
        onPress={() => void a.act(() => b.run("mark_notifications_read"))}
      />
      {!b.state.notifications.length && (
        <Body>Notifications will appear here.</Body>
      )}
      {b.state.notifications.map((n) => (
        <Card key={n.id}>
          <Text style={styles.label}>
            {!n.read_at ? "● " : ""}
            {n.text}
          </Text>
          <Body>{new Date(n.created_at).toLocaleString()}</Body>
          {n.trade_id && (
            <Button
              title="Open conversation"
              onPress={() => navigation.navigate("Trade", { id: n.trade_id! })}
            />
          )}
        </Card>
      ))}
    </Page>
  );
}
