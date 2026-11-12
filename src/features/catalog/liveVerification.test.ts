import { expect, it, vi } from "vitest";
import { verifyScento } from "../../../scripts/lib/verify-scento";
function source(missingNotes = false) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = new URL(String(url)),
      q = u.searchParams.get("q");
    const name = q === "Oud Wood" ? "Oud Wood" : "Layton",
      id = name === "Layton" ? "layton" : "oud-wood",
      house = name === "Layton" ? "Parfums de Marly" : "Tom Ford";
    if (u.pathname.endsWith("/search"))
      return Response.json({
        detail: {
          matches: q?.startsWith("fraggy-no-match-")
            ? []
            : [
                {
                  kind: "perfume",
                  name,
                  house,
                  page: `https://www.scento.com/perfumes/${id}`,
                },
              ],
        },
        continuation: null,
      });
    const detailName = u.pathname.endsWith("/oud-wood") ? "Oud Wood" : "Layton";
    return Response.json({
      detail: {
        name: detailName,
        house: detailName === "Layton" ? "Parfums de Marly" : "Tom Ford",
        pyramid: missingNotes
          ? null
          : { top: ["Bergamot"], heart: ["Lavender"], base: ["Woods"] },
      },
      scento_page: {
        url: `https://www.scento.com/perfumes/${u.pathname.split("/").at(-1)}`,
      },
    });
  });
}
it("verifies actual adapter search, detail notes and empty results without claiming mocks are live", async () => {
  const fetcher = source();
  const result = await verifyScento(fetcher);
  expect(result.profiles.map((p) => p.name)).toEqual(["Layton", "Oud Wood"]);
  expect(result.emptySearch).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(5);
});
it("fails verification if known profiles supply no notes or upstream is unavailable", async () => {
  await expect(verifyScento(source(true))).rejects.toThrow("notes");
  await expect(
    verifyScento(async () => new Response("unavailable", { status: 503 })),
  ).rejects.toThrow("unavailable");
});
