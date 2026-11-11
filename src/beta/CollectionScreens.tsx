import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Image, Text, View, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PerfumeCabinet } from "../components/PerfumeCabinet";
import type { Bottle } from "../domain/types";
import { useBeta } from "./Provider";
import { compressPhoto, gateway, localPhoto, mediaUri } from "./api";
import {
  emptyBottle,
  type BottleForm,
  type BottleRow,
  type Draft,
} from "./types";
import {
  Body,
  BottleFields,
  Button,
  Card,
  Choices,
  Feedback,
  Field,
  Page,
  Photo,
  Toggle,
  useAction,
  validBottle,
  styles,
} from "./ui";
import type { BetaStack } from "./navigation";

function Cabinet({
  bottles,
  onBottle,
  onAdd,
}: {
  bottles: BottleRow[];
  onBottle: (b: Bottle) => void;
  onAdd?: () => void;
}) {
  const { session, offline } = useBeta(),
    [images, setImages] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    for (const bottle of bottles)
      if (bottle.image_path)
        mediaUri(bottle.image_path, session!.user.id, offline)
          .then((uri) => {
            if (active) setImages((old) => ({ ...old, [bottle.id]: uri }));
          })
          .catch(() => {});
    return () => {
      active = false;
    };
  }, [bottles, session?.user.id, offline]);
  return (
    <PerfumeCabinet
      bottles={bottles.map((b) => ({
        id: b.id,
        ownerId: b.owner_id,
        brand: b.brand,
        name: b.name,
        sizeMl: b.size_ml,
        remainingPercent: b.remaining_percent,
        imageUri: images[b.id],
        imageKind: b.image_kind,
        imageWidth: b.image_width || undefined,
        imageHeight: b.image_height || undefined,
        tradeAvailable: b.trade_available,
        reservedTradeId: b.reserved_trade_id || undefined,
        art: "green",
        notes: b.notes,
        methods: b.methods,
      }))}
      onBottle={onBottle}
      onAdd={onAdd}
    />
  );
}
export function ShelfScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BetaStack>>();
  const b = useBeta(),
    [shelf, setShelf] = useState(""),
    [name, setName] = useState("");
  const a = useAction();
  const own = b.state.shelves.filter((s) => s.owner_id === b.session!.user.id),
    selected = own.find((s) => s.id === shelf) || own[0];
  const bottles = b.state.bottles.filter(
    (x) =>
      x.owner_id === b.session!.user.id &&
      (!selected || x.shelf_id === selected.id),
  );
  return (
    <Page
      title="Good scents. Your space."
      subtitle={`${b.state.bottles.filter((x) => x.owner_id === b.session!.user.id).length}/25 bottles · ${b.offline ? "Cached shelf · reconnect to make changes" : "Private by default"}`}
    >
      <Button
        title="+ Capture a bottle"
        onPress={() => navigation.navigate("Capture", {})}
      />
      {b.error && <Body>{b.error}</Body>}
      {b.drafts.map((d) => (
        <Button
          key={d.id}
          title={`Resume capture · ${d.form.name || "Untitled bottle"}`}
          secondary
          onPress={() => navigation.navigate("Capture", { draftId: d.id })}
        />
      ))}
      {b.state.jobs
        .filter((j) => !b.drafts.some((d) => d.jobId === j.id))
        .map((j) => (
          <Button
            key={j.id}
            title={`Resume saved photo · ${j.status}`}
            secondary
            onPress={() => navigation.navigate("Capture", { jobId: j.id })}
          />
        ))}
      <View style={styles.wrap}>
        {own.map((s) => (
          <Button
            key={s.id}
            title={s.name}
            secondary={selected?.id !== s.id}
            onPress={() => setShelf(s.id)}
          />
        ))}
      </View>
      <Cabinet
        bottles={bottles}
        onBottle={(bottle) => navigation.navigate("Bottle", { id: bottle.id })}
        onAdd={() => navigation.navigate("Capture", {})}
      />
      <Card>
        <Field
          label="Shelf name"
          value={name}
          onChangeText={setName}
          maxLength={50}
        />
        <Button
          title="Create shelf"
          secondary
          disabled={a.busy || b.offline}
          onPress={() =>
            void a.act(async () => {
              setShelf(await b.run<string>("save_shelf", { p_name: name }));
              setName("");
            })
          }
        />
        {selected && (
          <Button
            title={`Rename ${selected.name}`}
            secondary
            disabled={a.busy || b.offline}
            onPress={() =>
              void a.act(async () => {
                await b.run("save_shelf", { p_name: name, p_id: selected.id });
                setName("");
              })
            }
          />
        )}
        <Feedback {...a} />
      </Card>
    </Page>
  );
}

export function CaptureScreen({
  route,
  navigation,
}: NativeStackScreenProps<BetaStack, "Capture">) {
  const b = useBeta();
  const initial = b.drafts.find((d) => d.id === route.params.draftId);
  const [draftId, setDraftId] = useState(initial?.id || ""),
    [jobId, setJobId] = useState(initial?.jobId || route.params.jobId || ""),
    [uri, setUri] = useState(initial?.uri || ""),
    [form, setForm] = useState<BottleForm>({
      ...emptyBottle,
      ...initial?.form,
      ...b.state.jobs.find((j) => j.id === route.params.jobId)?.draft,
    }),
    [shelf, setShelf] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const a = useAction();
  const draft = b.drafts.find((d) => d.id === draftId),
    job = b.state.jobs.find((j) => j.id === (draft?.jobId || jobId));
  useEffect(() => {
    if (draftId || jobId) {
      const t = setTimeout(() => {
        if (draftId)
          void b.saveDraft({
            id: draftId,
            uri,
            jobId: draft?.jobId || jobId || undefined,
            form,
            createdAt: draft?.createdAt || new Date().toISOString(),
          });
        if (job)
          void b
            .run("save_capture_draft", { p_job: job.id, p_draft: form })
            .catch(() => {});
      }, 600);
      return () => clearTimeout(t);
    }
  }, [form, draftId, job?.id]);
  useEffect(() => {
    setConfirmed(false);
  }, [job?.cutout_path]);
  const pick = async (camera: boolean) => {
    await a.act(async () => {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        throw Error("Allow photo access in Settings to add your bottle.");
      const result = await (camera
        ? ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 })
        : ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 1,
          }));
      if (result.canceled) return;
      const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const photo = localPhoto(await compressPhoto(result.assets[0].uri), id);
      const next: Draft = {
        id,
        uri: photo,
        form,
        createdAt: new Date().toISOString(),
      };
      await b.saveDraft(next);
      setDraftId(id);
      setUri(photo);
      setJobId("");
      setConfirmed(false);
      const jid = await b.processDraft(next);
      setJobId(jid);
    });
  };
  const stalled =
    job &&
    ["processing", "waking", "queued"].includes(job.status) &&
    Date.now() - new Date(job.updated_at).getTime() > 190000;
  const status =
    job?.status === "ready"
      ? "Cutout ready · check the edges"
      : job?.status === "waking"
        ? "Waking the photo studio… this can take about a minute."
        : job?.status === "processing"
          ? "Removing the background…"
          : job?.status === "queued"
            ? "Your photo is in the queue."
            : job?.status === "failed"
              ? "Your original is saved. Processing needs another try."
              : uri
                ? "Uploading your bottle…"
                : "Take a photo or choose one. Background removal starts automatically.";
  return (
    <Page
      title="Make shelf space."
      subtitle={status}
      back={() => navigation.goBack()}
    >
      <View style={styles.wrap}>
        <Button
          title="Take a photo"
          disabled={a.busy}
          onPress={() => void pick(true)}
        />
        <Button
          title="Choose a photo"
          secondary
          disabled={a.busy}
          onPress={() => void pick(false)}
        />
      </View>
      {job?.status === "ready" ? (
        <>
          <Photo path={job.cutout_path} height={300} />
          <Body>
            Check the cap, label and glass edges against this background. If the
            result is poor, retry or retake it.
          </Body>
          <Toggle
            label="This cutout looks good"
            value={confirmed}
            onChange={setConfirmed}
          />
        </>
      ) : uri ? (
        <Image
          source={{ uri }}
          style={{ height: 240, width: "100%", borderRadius: 18 }}
          resizeMode="contain"
          accessibilityLabel="Original bottle photo"
        />
      ) : (
        job && <Photo path={job.original_path} />
      )}{" "}
      {(job?.status === "failed" ||
        job?.status === "ready" ||
        stalled ||
        draft?.error) && (
        <Button
          title={
            stalled
              ? "Recover interrupted processing"
              : "Retry background removal"
          }
          secondary
          disabled={a.busy}
          onPress={() =>
            void a.act(async () => {
              setConfirmed(false);
              if (job && job.status !== "uploading")
                await gateway("retry-capture", { job_id: job.id, draft: form });
              else if (draft) await b.processDraft(draft);
              await b.refresh();
            })
          }
        />
      )}{" "}
      {job?.error && <Body>{job.error}</Body>}
      {draft?.error && <Body>{draft.error}</Body>}
      <Feedback {...a} />
      {(uri || job) && (
        <>
          <BottleFields value={form} onChange={setForm} />
          <View style={styles.wrap}>
            {b.state.shelves
              .filter((s) => s.owner_id === b.session!.user.id)
              .map((s) => (
                <Button
                  key={s.id}
                  title={s.name}
                  secondary={s.id !== shelf}
                  onPress={() => setShelf(s.id)}
                />
              ))}
          </View>
          <Button
            title="Place on my shelf"
            disabled={a.busy || job?.status !== "ready" || !confirmed}
            onPress={() =>
              void a.act(async () => {
                validBottle(form);
                await b.run("finalize_capture", {
                  p_job: job!.id,
                  p_data: form,
                  p_shelf: shelf || null,
                });
                if (draftId) await b.removeDraft(draftId);
                navigation.goBack();
              })
            }
          />
          <Body>
            You can close Fraggy while processing. Your unfinished capture will
            be waiting on My Shelf.
          </Body>
        </>
      )}
    </Page>
  );
}

export function DiscoverScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BetaStack>>();
  const { state, session } = useBeta();
  const [query, setQuery] = useState(""),
    [city, setCity] = useState(""),
    [method, setMethod] = useState("any"),
    [remaining, setRemaining] = useState("any");
  const bottles = state.bottles.filter(
    (b) =>
      b.owner_id !== session!.user.id &&
      b.trade_available &&
      !b.reserved_trade_id &&
      `${b.brand} ${b.name}`.toLowerCase().includes(query.toLowerCase()) &&
      (!city ||
        state.profiles
          .find((p) => p.id === b.owner_id)
          ?.city.toLowerCase()
          .includes(city.toLowerCase())) &&
      (method === "any" ||
        b.methods.includes(method as "local" | "shipping")) &&
      (remaining === "any" || b.remaining_percent >= Number(remaining)),
  );
  return (
    <Page
      title="Find your next obsession."
      subtitle="One bottle for one bottle. No cash top-ups."
    >
      <Field label="Fragrance or brand" value={query} onChangeText={setQuery} />
      <Field label="Philippine city" value={city} onChangeText={setCity} />
      <Choices
        label="Exchange"
        values={["any", "local", "shipping"]}
        value={method}
        onChange={setMethod}
      />
      <Choices
        label="Minimum remaining (%)"
        values={["any", "25", "50", "75"]}
        value={remaining}
        onChange={setRemaining}
      />
      {bottles.length === 0 && <Body>No available bottles match yet.</Body>}
      {bottles.map((x) => (
        <Card key={x.id}>
          <Photo path={x.image_path} />
          <Text style={styles.label}>
            {x.brand} · {x.name}
          </Text>
          <Body>
            {x.remaining_percent}% · {x.condition} ·{" "}
            {state.profiles.find((p) => p.id === x.owner_id)?.city}
          </Body>
          <Button
            title="View bottle"
            onPress={() => navigation.navigate("Bottle", { id: x.id })}
          />
        </Card>
      ))}
    </Page>
  );
}

export function BottleScreen({
  route,
  navigation,
}: NativeStackScreenProps<BetaStack, "Bottle">) {
  const b = useBeta(),
    a = useAction();
  const bottle = b.state.bottles.find((x) => x.id === route.params.id);
  const [edit, setEdit] = useState(false),
    [form, setForm] = useState<BottleForm>(
      bottle ? { ...bottle } : emptyBottle,
    ),
    [offered, setOffered] = useState(""),
    [method, setMethod] = useState<"local" | "shipping">("local"),
    [reason, setReason] = useState("");
  if (!bottle)
    return (
      <Page title="Bottle unavailable" back={() => navigation.goBack()}>
        <Body>The listing may have changed or become private.</Body>
      </Page>
    );
  const own = bottle.owner_id === b.session!.user.id;
  return (
    <Page
      title={bottle.name}
      subtitle={bottle.brand}
      back={() => navigation.goBack()}
    >
      <Photo path={bottle.image_path} height={280} />
      <Body>
        {bottle.size_ml} ml · {bottle.remaining_percent}% · {bottle.condition}
        {bottle.has_cap ? " · Cap" : ""}
        {bottle.has_box ? " · Box" : ""}
      </Body>
      <Body>{bottle.notes}</Body>
      <Photo path={bottle.original_path} />
      {bottle.condition_path && <Photo path={bottle.condition_path} />}
      <Feedback {...a} />
      {own ? (
        <>
          {bottle.reserved_trade_id ? (
            <Body>
              Reserved for an accepted trade. Resolve that trade before editing.
            </Body>
          ) : (
            <>
              <Button
                title={edit ? "Close editing" : "Edit bottle"}
                secondary
                onPress={() => setEdit(!edit)}
              />
              {edit && (
                <>
                  <BottleFields value={form} onChange={setForm} />
                  <Button
                    title="Save changes"
                    disabled={a.busy}
                    onPress={() =>
                      void a.act(async () => {
                        validBottle(form);
                        await b.run("edit_bottle", {
                          p_bottle: bottle.id,
                          p_data: form,
                        });
                        setEdit(false);
                      })
                    }
                  />
                  <Body>Changing details expires outstanding proposals.</Body>
                  <Button
                    title="Add condition photo"
                    secondary
                    disabled={a.busy}
                    onPress={() =>
                      void a.act(async () => {
                        const result =
                          await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ["images"],
                          });
                        if (result.canceled) return;
                        const uri = await compressPhoto(
                          result.assets[0].uri,
                          250000,
                        );
                        const { uploadPhoto } = await import("./api");
                        const size = (await import("expo-file-system")).File;
                        const bytes =
                          Platform.OS === "web"
                            ? (await (await fetch(uri)).blob()).size
                            : new size(uri).size;
                        const ticket = await gateway<{
                          path: string;
                          upload_url: string;
                        }>("condition-upload", { size: bytes });
                        await uploadPhoto(ticket.upload_url, uri);
                        await b.run("attach_photo", {
                          p_path: ticket.path,
                          p_bottle: bottle.id,
                        });
                      })
                    }
                  />
                  <Button
                    title="Remove bottle from collection"
                    secondary
                    disabled={a.busy}
                    onPress={() =>
                      void a.act(async () => {
                        await b.run("edit_bottle", {
                          p_bottle: bottle.id,
                          p_data: { archived: true },
                        });
                        navigation.goBack();
                      })
                    }
                  />
                </>
              )}
            </>
          )}
          <Body>Move to a named shelf</Body>
          {b.state.shelves
            .filter((s) => s.owner_id === bottle.owner_id)
            .map((s) => (
              <Button
                key={s.id}
                title={s.name}
                secondary
                disabled={a.busy || !!bottle.reserved_trade_id}
                onPress={() =>
                  void a.act(() =>
                    b.run("move_bottle", {
                      p_bottle: bottle.id,
                      p_shelf: s.id,
                      p_position: 0,
                    }),
                  )
                }
              />
            ))}
          <Button
            title="Move one place earlier"
            secondary
            disabled={a.busy || !!bottle.reserved_trade_id}
            onPress={() =>
              void a.act(() =>
                b.run("move_bottle", {
                  p_bottle: bottle.id,
                  p_shelf: bottle.shelf_id,
                  p_position: Math.max(0, bottle.position - 1),
                }),
              )
            }
          />
        </>
      ) : (
        <>
          <Button
            title="Collector profile & reviews"
            secondary
            onPress={() =>
              navigation.navigate("Collector", { id: bottle.owner_id })
            }
          />
          <Body>Choose one of your available bottles to offer.</Body>
          {b.state.bottles
            .filter(
              (x) =>
                x.owner_id === b.session!.user.id &&
                x.trade_available &&
                !x.reserved_trade_id,
            )
            .map((x) => (
              <Button
                key={x.id}
                title={`${x.brand} · ${x.name}`}
                secondary={offered !== x.id}
                onPress={() => setOffered(x.id)}
              />
            ))}
          <Choices
            label="Exchange method"
            values={bottle.methods}
            value={method}
            onChange={setMethod}
          />
          <Button
            title="Propose swap & open chat"
            disabled={!offered || a.busy || !bottle.trade_available}
            onPress={() =>
              void a.act(async () => {
                const id = await b.run<string>("propose_trade", {
                  p_offered: offered,
                  p_requested: bottle.id,
                  p_method: method,
                });
                navigation.navigate("Trade", { id });
              })
            }
          />
          <Field
            label="Report this listing"
            value={reason}
            onChangeText={setReason}
            maxLength={500}
          />
          <Button
            title="Send report"
            secondary
            disabled={!reason || a.busy}
            onPress={() =>
              void a.act(async () => {
                await b.run("report_problem", {
                  p_user: bottle.owner_id,
                  p_bottle: bottle.id,
                  p_reason: reason,
                });
                setReason("");
              })
            }
          />
        </>
      )}
    </Page>
  );
}

export function CollectorScreen({
  route,
  navigation,
}: NativeStackScreenProps<BetaStack, "Collector">) {
  const b = useBeta(),
    a = useAction();
  const profile = b.state.profiles.find((p) => p.id === route.params.id),
    [reason, setReason] = useState("");
  const [completed, setCompleted] = useState<number | null>(null);
  useEffect(() => {
    void b
      .run<{ completed_trades: number }>("collector_stats", {
        p_user: route.params.id,
      })
      .then((x) => setCompleted(x.completed_trades))
      .catch(() => {});
  }, [route.params.id]);
  if (!profile)
    return (
      <Page title="Collector unavailable" back={() => navigation.goBack()}>
        <Body>This profile is private or unavailable.</Body>
      </Page>
    );
  const reviews = b.state.reviews.filter((r) => r.reviewee_id === profile.id),
    blocked = b.state.blocks.some((x) => x.blocked_id === profile.id);
  return (
    <Page
      title={profile.name}
      subtitle={`${profile.handle} · ${profile.city}`}
      back={() => navigation.goBack()}
    >
      {profile.avatar_url && <Photo path={profile.avatar_url} height={120} />}
      <Body>{profile.bio}</Body>
      <Body>
        {completed ?? "—"} completed trades · {reviews.length} reviews ·{" "}
        {reviews.length
          ? `${(reviews.reduce((n, r) => n + r.rating, 0) / reviews.length).toFixed(1)}/5`
          : "No reviews yet"}
      </Body>
      {reviews.map((r) => (
        <Card key={`${r.trade_id}:${r.reviewer_id}`}>
          <Body>
            {r.rating}/5 · {r.comment}
          </Body>
        </Card>
      ))}
      {profile.shelf_public ? (
        <>
          <Body>Shared collection</Body>
          <Cabinet
            bottles={b.state.bottles.filter((x) => x.owner_id === profile.id)}
            onBottle={(x) => navigation.navigate("Bottle", { id: x.id })}
          />
        </>
      ) : (
        <Body>
          This collector’s full shelf is private. Available trade listings
          appear in Discover.
        </Body>
      )}
      <Field
        label="Report collector"
        value={reason}
        onChangeText={setReason}
        maxLength={500}
      />
      <Feedback {...a} />
      <Button
        title="Send report"
        secondary
        disabled={!reason || a.busy}
        onPress={() =>
          void a.act(async () => {
            await b.run("report_problem", {
              p_user: profile.id,
              p_reason: reason,
            });
            setReason("");
          })
        }
      />
      <Button
        title={blocked ? "Unblock collector" : "Block collector"}
        secondary
        disabled={a.busy}
        onPress={() =>
          void a.act(() =>
            b.run("block_collector", { p_user: profile.id, p_block: !blocked }),
          )
        }
      />
      <Body>
        Blocking prevents new messages and offers. Accepted trades remain
        available for resolution.
      </Body>
    </Page>
  );
}
