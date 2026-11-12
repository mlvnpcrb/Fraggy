import { it, expect, vi } from "vitest";
import { processCapture } from "../../beta/capture";
import { emptyBottle, type Draft } from "../../beta/types";
it("keeps the latest fragrance edits and shelf step during asynchronous upload", async () => {
  const original: Draft = {
    id: "draft",
    uri: "file://original.heic",
    createdAt: "now",
    form: emptyBottle,
  };
  const saved: Draft[] = [];
  let started: Record<string, unknown> | undefined;
  const ui = {
    version: 1 as const,
    shelfId: "chosen-shelf",
    step: "inspect",
    reviewedCutoutPath: "ready-v2",
  };
  const form = { ...emptyBottle, brand: "Custom", name: "New edits" };
  const gateway = vi.fn(
    async (action: string, args?: Record<string, unknown>) => {
      if (action === "create-capture")
        return { job: { id: "job" }, upload_url: "signed" };
      started = args;
      return {};
    },
  );
  await processCapture(original, {
    gateway: gateway as any,
    save: async (d) => {
      saved.push(d);
    },
    upload: async () => {},
    loadJobs: async () => [],
    latestForm: () => form,
    latestUi: () => ui,
    refresh: async () => {},
    isCurrent: () => true,
  });
  expect(saved[0].form.name).toBe("New edits");
  expect(saved[0].ui?.step).toBe("inspect");
  expect((started?.draft as any).capture_ui.shelfId).toBe("chosen-shelf");
});

it("retains selected shelf and stage in the server-only retry draft", async () => {
  const { retryCaptureDraft } = await import("../../beta/capture");
  const result = retryCaptureDraft(
    { ...emptyBottle, brand: "House", name: "EDP" },
    {
      version: 1,
      shelfId: "saved-shelf",
      step: "inspect",
      reviewedCutoutPath: "old.png",
    },
  );
  expect(result.capture_ui).toEqual({
    version: 1,
    shelfId: "saved-shelf",
    step: "inspect",
    reviewedCutoutPath: "",
  });
});
