import { it, expect, vi } from "vitest";
import { indexedDB } from "fake-indexeddb";
it("stores original bytes across module reload and clears only the signed-out account", async () => {
  vi.stubGlobal("indexedDB", indexedDB);
  const nativeFetch = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(new Blob(["real-photo-bytes"], { type: "image/jpeg" })),
  );
  try {
    let storage = await import("./webDraftPhotos");
    const a = await storage.storeWebOriginal(
        "blob:temporary-a",
        "user-a",
        "capture",
      ),
      b = await storage.storeWebOriginal(
        "blob:temporary-b",
        "user-b",
        "capture",
      );
    vi.resetModules();
    storage = await import("./webDraftPhotos");
    const url = await storage.resolveWebOriginal(a, "user-a");
    expect(await (await nativeFetch(url)).text()).toBe("real-photo-bytes");
    await expect(storage.resolveWebOriginal(a, "user-b")).rejects.toThrow(
      "another account",
    );
    await storage.clearWebOriginals("user-a");
    await expect(storage.resolveWebOriginal(a, "user-a")).rejects.toThrow(
      "unavailable",
    );
    expect(await storage.resolveWebOriginal(b, "user-b")).toMatch(/^blob:/);
    await storage.clearWebOriginals("user-b");
  } finally {
    vi.unstubAllGlobals();
  }
});
