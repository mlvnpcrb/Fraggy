import React, { useEffect, useState } from "react";
import { Image, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BetaStack } from "../../beta/navigation";
import { useBeta } from "../../beta/context";
import { gateway, localPhoto, resolveDraftPhoto } from "../../beta/runtime";
import { recoverUploadedCapture, retryCaptureDraft } from "../../beta/capture";
import { emptyBottle, type BottleForm, type Draft } from "../../beta/types";
import {
  Body,
  BottleFields,
  Button,
  Card,
  Feedback,
  Page,
  Photo,
  Toggle,
  useAction,
  validBottle,
  styles,
} from "../../beta/ui";
import { FragranceEditor } from "../catalog/FragranceEditor";
import { samplePhoto } from "../app/samplePhoto";
export function CaptureScreen({
  route,
  navigation,
}: NativeStackScreenProps<BetaStack, "Capture">) {
  const b = useBeta();
  const initial = b.drafts.find((d) => d.id === route.params.draftId);
  const serverJob = b.state.jobs.find((j) => j.id === route.params.jobId);
  const initialUi = initial?.ui || serverJob?.draft.capture_ui;
  const [step, setStep] = useState(
    initialUi?.step || (initial || serverJob ? "identify" : "photo"),
  );
  const [dark, setDark] = useState(false);
  const [reviewedPath, setReviewedPath] = useState(
    initialUi?.reviewedCutoutPath || "",
  );
  const [draftId, setDraftId] = useState(initial?.id || ""),
    [jobId, setJobId] = useState(initial?.jobId || route.params.jobId || ""),
    [uri, setUri] = useState(initial?.uri || ""),
    [form, setForm] = useState<BottleForm>({
      ...emptyBottle,
      ...initial?.form,
      ...b.state.jobs.find((j) => j.id === route.params.jobId)?.draft,
    }),
    [shelf, setShelf] = useState(
      initialUi?.shelfId || route.params.shelfId || "",
    ),
    [confirmed, setConfirmed] = useState(false);
  const a = useAction();
  const [displayUri, setDisplayUri] = useState("");
  useEffect(() => {
    let active = true;
    setDisplayUri("");
    if (uri)
      void resolveDraftPhoto(uri, b.session!.user.id)
        .then((value) => {
          if (active) setDisplayUri(value);
        })
        .catch(() => {
          if (active)
            a.setError(
              "Original photo unavailable. Choose it again to continue.",
            );
        });
    return () => {
      active = false;
    };
  }, [uri, b.session?.user.id]);
  const draft = b.drafts.find((d) => d.id === draftId),
    job = b.state.jobs.find((j) => j.id === (draft?.jobId || jobId));
  const ui = {
    version: 1 as const,
    shelfId: shelf,
    step,
    reviewedCutoutPath: reviewedPath,
  };
  useEffect(() => {
    if (draftId || jobId) {
      const t = setTimeout(() => {
        if (draftId)
          void b.saveDraft({
            id: draftId,
            uri,
            jobId: draft?.jobId || jobId || undefined,
            form,
            ui,
            createdAt: draft?.createdAt || new Date().toISOString(),
          });
        if (job)
          void b
            .run("save_capture_draft", {
              p_job: job.id,
              p_draft: { ...form, capture_ui: ui },
            })
            .catch(() => {});
      }, 600);
      return () => clearTimeout(t);
    }
  }, [form, draftId, job?.id, shelf, step, reviewedPath]);
  useEffect(() => {
    setConfirmed(!!job?.cutout_path && reviewedPath === job.cutout_path);
  }, [job?.cutout_path, reviewedPath]);
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
      const photo = await localPhoto(
        result.assets[0].uri,
        id,
        b.session!.user.id,
      );
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
      setReviewedPath("");
      setStep("identify");
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
      back={() =>
        step === "photo"
          ? navigation.goBack()
          : setStep(
              step === "details"
                ? "inspect"
                : step === "inspect"
                  ? "identify"
                  : "photo",
            )
      }
    >
      <Body>
        {step === "photo"
          ? "1 · Your bottle"
          : step === "identify"
            ? "2 · Identify fragrance"
            : step === "inspect"
              ? "3 · Inspect cutout"
              : "4 · Bottle details"}
      </Body>
      {b.mode === "demo" && step === "photo" ? (
        <Card>
          <Body>
            Demo capture uses the labelled sample photo. Real photos require a
            live account.
          </Body>
          <Button
            title="Use sample bottle photo"
            onPress={() =>
              void a.act(async () => {
                const next: Draft = {
                  id: `demo-draft-${Date.now()}`,
                  uri: samplePhoto,
                  form,
                  createdAt: new Date().toISOString(),
                  ui,
                };
                await b.saveDraft(next);
                setDraftId(next.id);
                setUri(samplePhoto);
                setStep("identify");
                setJobId(await b.processDraft(next));
              })
            }
          />
        </Card>
      ) : step === "photo" ? (
        <>
          <Card>
            <Body>
              Keep the bottle upright, include the cap and base, and use a plain
              background with soft light. Avoid glare on the glass.
            </Body>
          </Card>
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
        </>
      ) : null}
      {step !== "details" &&
        (job?.status === "ready" ? (
          <>
            <Photo
              path={job.cutout_path}
              height={300}
              background={dark ? "#0C291F" : "#F6F3EB"}
            />
            <Button
              title={
                dark
                  ? "Use light inspection background"
                  : "Use dark inspection background"
              }
              secondary
              onPress={() => setDark(!dark)}
            />
            <Body>
              Check the cap, label and glass edges against this background. If
              the result is poor, retry or retake it.
            </Body>
            <Toggle
              label="This cutout looks good"
              value={confirmed}
              onChange={(on) => {
                setConfirmed(on);
                setReviewedPath(on ? job.cutout_path : "");
              }}
            />
          </>
        ) : uri ? (
          <Image
            source={{ uri: displayUri }}
            style={{ height: 240, width: "100%", borderRadius: 18 }}
            resizeMode="contain"
            accessibilityLabel="Original bottle photo"
          />
        ) : (
          job && <Photo path={job.original_path} />
        ))}{" "}
      {job?.status === "uploading" && !uri && (
        <>
          <Body>
            If this upload was interrupted on another device, Fraggy can
            continue from its saved original. If the original never finished
            uploading, choose the photo again.
          </Body>
          <Button
            title="Resume uploaded photo"
            secondary
            disabled={a.busy}
            onPress={() =>
              void a.act(async () => {
                const recovered = await recoverUploadedCapture(job, gateway);
                if (!recovered)
                  throw Error(
                    "The original did not finish uploading. Choose the photo again.",
                  );
                await b.refresh();
              })
            }
          />
        </>
      )}
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
              setReviewedPath("");
              if (b.mode === "demo" && draft) {
                await b.processDraft(draft);
                return;
              }
              if (job && job.status !== "uploading")
                await gateway("retry-capture", {
                  job_id: job.id,
                  draft: retryCaptureDraft(form, ui),
                });
              else if (draft) await b.processDraft(draft);
              await b.refresh();
            })
          }
        />
      )}{" "}
      {job?.error && <Body>{job.error}</Body>}
      {draft?.error && <Body>{draft.error}</Body>}
      <Feedback {...a} />
      {step === "identify" && (uri || job) && (
        <>
          <FragranceEditor value={form} onChange={setForm} />
          <Button
            title="Continue to cutout inspection"
            disabled={!form.brand.trim() || !form.name.trim()}
            onPress={() => setStep("inspect")}
          />
        </>
      )}
      {step === "inspect" && (
        <>
          <Body>
            {job?.status === "ready"
              ? "Confirm the actual cutout above before continuing."
              : "Your draft is saved. You can leave this screen while the processor works."}
          </Body>
          <Button
            title="Continue to bottle details"
            disabled={!confirmed || job?.status !== "ready"}
            onPress={() => setStep("details")}
          />
        </>
      )}
      {step === "details" && (uri || job) && (
        <>
          <BottleFields value={form} onChange={setForm} showIdentity={false} />
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
