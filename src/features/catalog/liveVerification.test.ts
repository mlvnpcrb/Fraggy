import { expect, it, vi } from "vitest";
import { verifyScento } from "../../../scripts/lib/verify-scento";
import laytonSearch from "./fixtures/layton-search.json";
import laytonProfile from "./fixtures/layton-profile.json";
function source(missingNotes = false) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = new URL(String(url)),
      q = u.searchParams.get("q");
    if (u.pathname.endsWith("/search")) {
      if (q?.startsWith("fraggy-no-match-"))
        return Response.json({ detail: { matches: [] }, continuation: null });
      if (q === "Layton") return Response.json(laytonSearch);
      return Response.json({
        detail: {
          matches: [
            {
              kind: "perfume",
              name: "Oud Wood",
              house: "Tom Ford",
              page: "https://www.scento.com/perfumes/oud-wood-tom-ford",
            },
          ],
        },
        continuation: null,
      });
    }
    const lookup = decodeURIComponent(u.pathname.split("/").at(-1) || "");
    // The API consumes documented perfume names, independently of website slugs.
    if (!["layton", "oud wood"].includes(lookup))
      return new Response("Unknown API lookup", { status: 404 });
    const profile =
      lookup === "layton"
        ? structuredClone(laytonProfile)
        : {
            detail: {
              name: "Oud Wood",
              house: "Tom Ford",
              pyramid: { top: ["Spices"], heart: ["Woods"], base: ["Amber"] },
            },
            scento_page: {
              url: "https://www.scento.com/perfumes/oud-wood-tom-ford",
            },
          };
    if (missingNotes) profile.detail.pyramid = null as any;
    return Response.json(profile);
  });
}
it("verifies actual adapter search, detail notes and empty results without claiming mocks are live", async () => {
  const fetcher = source();
  const result = await verifyScento(fetcher);
  expect(result.profiles.map((p) => p.name)).toEqual(["Layton", "Oud Wood"]);
  expect(result.profiles[0].noteCount).toBe(10);
  expect(result.profiles[0].id).toBe("layton-parfums-de-marly");
  expect(result.emptySearch).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(5);
});
it("fails verification if known profiles supply no notes or upstream is unavailable", async () => {
  await expect(verifyScento(source(true))).rejects.toThrow("notes");
  await expect(
    verifyScento(async () => new Response("unavailable", { status: 503 })),
  ).rejects.toThrow("unavailable");
});
