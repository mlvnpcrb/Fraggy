import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { useBeta } from "../../beta/context";
import type { BetaStack } from "../../beta/navigation";
import { emptyBottle, type BottleForm, type BottleRow } from "../../beta/types";
import {
  Body,
  Button,
  Card,
  Feedback,
  Page,
  Photo,
  useAction,
  styles,
} from "../../beta/ui";
import { FragranceEditor, FragranceSummary } from "../catalog/FragranceEditor";
import {
  customEntry,
  effectiveDetails,
} from "../../../supabase/functions/_shared/catalog";
export function ProfileHub() {
  const b = useBeta(),
    navigation = useNavigation<NativeStackNavigationProp<BetaStack>>(),
    me = b.session!.user.id,
    p = b.state.profiles.find((p) => p.id === me);
  return (
    <Page
      title={p?.name || "Your profile"}
      subtitle={p ? `${p.handle} · ${p.city}` : undefined}
    >
      {p?.avatar_url && <Photo path={p.avatar_url} height={120} />}
      <Body>{p?.bio || "Make this space yours."}</Body>
      <Body>
        {b.state.bottles.filter((x) => x.owner_id === me).length} bottles ·{" "}
        {b.state.trades.filter((t) => t.status === "complete").length} completed
        swaps
      </Body>
      <Button
        title="Wishlist"
        onPress={() => navigation.navigate("Wishlist")}
      />
      <Button
        title="Activity and saved drafts"
        secondary
        onPress={() => navigation.navigate("Activity")}
      />
      <Button
        title="Notifications"
        secondary
        onPress={() => navigation.navigate("Inbox")}
      />
      <Button
        title="View as another collector"
        secondary
        onPress={() => navigation.navigate("PrivacyPreview")}
      />
      <Button
        title="Profile, privacy and account settings"
        secondary
        onPress={() => navigation.navigate("Settings")}
      />
      <Button
        title="Support and safety"
        secondary
        onPress={() => navigation.navigate("Support")}
      />
      {b.state.is_admin && (
        <Button
          title="Founder administration"
          secondary
          onPress={() => navigation.navigate("Admin")}
        />
      )}
      <Button
        title={b.mode === "demo" ? "Exit demo" : "Sign out"}
        secondary
        onPress={() => void b.signOut()}
      />
    </Page>
  );
}
export function ActivityScreen({
  navigation,
}: NativeStackScreenProps<BetaStack, "Activity">) {
  const b = useBeta();
  const jobs = b.state.jobs.filter(
    (j) => !j.bottle_id && !b.drafts.some((d) => d.jobId === j.id),
  );
  return (
    <Page
      title="Your next move."
      subtitle="Unfinished captures and swaps that need you."
      back={() => navigation.goBack()}
    >
      <Button
        title="Refresh activity"
        secondary
        onPress={() => void b.refresh()}
      />
      {!b.drafts.length &&
        !jobs.length &&
        !b.state.trades.some((t) =>
          ["proposed", "in-progress", "paused"].includes(t.status),
        ) && (
          <Body>You’re all caught up. Your saved bottles are on My Shelf.</Body>
        )}
      {b.drafts.map((d) => (
        <Card key={d.id}>
          <Body>
            {d.form.name || "Untitled bottle"} ·{" "}
            {d.error ? "Needs attention" : "Saved capture"}
          </Body>
          <Button
            title="Resume capture"
            onPress={() => navigation.navigate("Capture", { draftId: d.id })}
          />
        </Card>
      ))}
      {jobs.map((j) => (
        <Card key={j.id}>
          <Body>Photo studio · {j.status}</Body>
          <Button
            title="Open processing job"
            onPress={() => navigation.navigate("Capture", { jobId: j.id })}
          />
        </Card>
      ))}
      {b.state.trades
        .filter((t) => ["proposed", "in-progress", "paused"].includes(t.status))
        .map((t) => (
          <Card key={t.id}>
            <Body>
              {t.snapshot.offered.name} ↔ {t.snapshot.requested.name} ·{" "}
              {t.status}
            </Body>
            <Button
              title="Open exchange checklist"
              onPress={() => navigation.navigate("Trade", { id: t.id })}
            />
          </Card>
        ))}
    </Page>
  );
}
export function WishlistScreen({
  navigation,
}: NativeStackScreenProps<BetaStack, "Wishlist">) {
  const b = useBeta(),
    a = useAction(),
    [adding, setAdding] = useState(false),
    [form, setForm] = useState<BottleForm>({ ...emptyBottle }),
    [notice, setNotice] = useState("");
  return (
    <Page
      title="On your radar."
      subtitle="A private wishlist. Matching never sends an offer automatically."
      back={() => navigation.goBack()}
    >
      <Feedback {...a} />
      {!!notice && <Body>{notice}</Body>}
      <Button
        title={adding ? "Close fragrance entry" : "+ Add a fragrance"}
        onPress={() => setAdding(!adding)}
      />
      {adding && (
        <Card>
          <FragranceEditor value={form} onChange={setForm} />
          <Button
            title="Save to wishlist"
            disabled={
              a.busy || !form.brand.trim() || !form.name.trim() || b.offline
            }
            onPress={() =>
              void a.act(async () => {
                await b.run("save_wish", {
                  p_fragrance:
                    form.fragrance ||
                    customEntry({ brand: form.brand, name: form.name }),
                });
                setAdding(false);
                setForm({ ...emptyBottle });
                setNotice("Saved to your private wishlist.");
              })
            }
          />
        </Card>
      )}
      {!(b.state.wishlist || []).length && !adding && (
        <Body>Save something you’d love to add to your shelf.</Body>
      )}
      {(b.state.wishlist || []).map((w) => {
        const d = effectiveDetails(w.fragrance),
          exact = w.fragrance.source === "scento";
        const matches = b.state.bottles.filter(
          (x) =>
            x.owner_id !== b.session!.user.id &&
            x.trade_available &&
            !x.reserved_trade_id &&
            !b.state.blocks.some((block) => block.blocked_id === x.owner_id) &&
            (exact
              ? x.fragrance?.reference?.id === w.fragrance.reference?.id
              : `${x.brand} ${x.name}`
                  .toLowerCase()
                  .includes(`${d.brand} ${d.name}`.toLowerCase())),
        );
        return (
          <Card key={w.id}>
            <Text style={styles.label}>
              {d.brand} · {d.name}
              {d.concentration ? ` · ${d.concentration}` : ""}
            </Text>
            <Body>
              {exact
                ? "Matching catalog entries"
                : "Text search suggestions · confirm the exact fragrance"}{" "}
              · {matches.length} available
            </Body>
            {matches.map((x) => (
              <Button
                key={x.id}
                title={`View ${x.name} · ${x.remaining_percent}%`}
                secondary
                onPress={() => navigation.navigate("Bottle", { id: x.id })}
              />
            ))}
            {!matches.length && (
              <Body>No available matches yet. Your wishlist is saved.</Body>
            )}
            <Button
              title="Remove from wishlist"
              secondary
              disabled={a.busy || b.offline}
              onPress={() =>
                void a.act(() => b.run("remove_wish", { p_id: w.id }))
              }
            />
          </Card>
        );
      })}
    </Page>
  );
}
export function PrivacyPreviewScreen({
  navigation,
}: NativeStackScreenProps<BetaStack, "PrivacyPreview">) {
  const b = useBeta(),
    a = useAction(),
    [bottles, setBottles] = useState<BottleRow[]>([]),
    [shared, setShared] = useState(false);
  useEffect(() => {
    void a.act(async () => {
      if (b.mode === "demo") {
        const p = b.state.profiles.find((p) => p.id === b.session!.user.id);
        setShared(!!p?.shelf_public);
        setBottles(
          b.state.bottles.filter(
            (x) =>
              x.owner_id === b.session!.user.id &&
              (p?.shelf_public || x.trade_available),
          ),
        );
        return;
      }
      const preview = await b.run<{ shared: boolean; bottles: BottleRow[] }>(
        "preview_shelf",
      );
      setShared(preview.shared);
      setBottles(preview.bottles);
    });
  }, []);
  return (
    <Page
      title="Through their eyes."
      subtitle="Preview for an invited member you have not blocked."
      back={() => navigation.goBack()}
    >
      <Feedback {...a} />
      <Body>
        {shared
          ? "Your full shelf is shared."
          : "Your full shelf is private. Only your available trade listings appear."}{" "}
        Blocked collectors and anonymous visitors cannot browse your collection.
        Trade participants retain their agreed snapshots.
      </Body>
      {!a.busy && !bottles.length && (
        <Body>No bottles are visible in this preview.</Body>
      )}
      {bottles.map((x) => (
        <Card key={x.id}>
          <Photo path={x.image_path} />
          <Body>
            {x.brand} · {x.name}
          </Body>
        </Card>
      ))}
    </Page>
  );
}
export function SupportScreen({
  navigation,
}: NativeStackScreenProps<BetaStack, "Support">) {
  return (
    <Page title="A little help." back={() => navigation.goBack()}>
      <Card>
        <Text style={styles.label}>PHOTO STUDIO</Text>
        <Body>
          Use a plain background and soft light. Keep the cap and base in frame.
          Retry a poor cutout; your original stays with the draft. Free
          processing can take about a minute to wake.
        </Body>
      </Card>
      <Card>
        <Text style={styles.label}>SAFE SWAPS</Text>
        <Body>
          Inspect the real photos, condition and collector history. Agree on
          meetup or shipping in your private trade. Only confirm receipt after
          you have inspected the bottle. Both collectors must confirm before
          ownership changes.
        </Body>
      </Card>
      <Card>
        <Text style={styles.label}>REPORT A PROBLEM</Text>
        <Body>
          Open the bottle, collector profile or trade to submit a report. A
          problem during an exchange pauses it for resolution. You can manage
          blocked collectors and view your report status in settings.
        </Body>
      </Card>
      <Card>
        <Text style={styles.label}>ACCOUNT RECOVERY</Text>
        <Body>
          Ask the founder who invited you for a single-use recovery code. Fraggy
          does not ask you to share your password.
        </Body>
      </Card>
    </Page>
  );
}
