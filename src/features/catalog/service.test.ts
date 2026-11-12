import { expect, it, vi } from "vitest";
import { lookupCatalog } from "../../../supabase/functions/_shared/catalogService";
const profile = {
  detail: { name: "Example", house: "House", notes: null },
  scento_page: { url: "https://www.scento.com/perfumes/example" },
};
it("coalesces requests and uses fresh cache without contacting upstream", async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(profile)));
  const deps = {
    read: async () => null,
    write: vi.fn(async () => {}),
    fetcher,
  };
  const [a, b] = await Promise.all([
    lookupCatalog("catalog-detail", { id: "example" }, deps),
    lookupCatalog("catalog-detail", { id: "example" }, deps),
  ]);
  expect(a).toEqual(b);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await lookupCatalog(
    "catalog-detail",
    { id: "cached" },
    { ...deps, read: async () => ({ payload: a, stale: false }) },
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("preserves stale cached details on outage and exposes retry guidance", async () => {
  const cached = { reference: { id: "example" }, details: { name: "Example" } };
  const result = await lookupCatalog(
    "catalog-detail",
    { id: "outage" },
    {
      read: async () => ({ payload: cached, stale: true }),
      write: async () => {},
      fetcher: async () => {
        throw Error("network");
      },
    },
  );
  expect(result).toEqual({ ...cached, stale: true });
  await expect(
    lookupCatalog(
      "catalog-detail",
      { id: "missing" },
      {
        read: async () => null,
        write: async () => {},
        fetcher: async () =>
          new Response("", { status: 429, headers: { "Retry-After": "30" } }),
      },
    ),
  ).rejects.toThrow("30");
});
