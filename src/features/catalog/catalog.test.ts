import { describe, it, expect } from "vitest";
import {
  parseSearch,
  parseFragrance,
  customEntry,
  effectiveDetails,
  catalogUrl,
} from "../../../supabase/functions/_shared/catalog";
const profile = {
  detail: {
    name: "Layton",
    house: "Parfums de Marly",
    concentration: "eau de parfum",
    family: "Wood & Root",
    pyramid: { top: ["Apple"], heart: ["Lavender"], base: ["Vanilla"] },
    notes: null,
  },
  scento_page: {
    url: "https://www.scento.com/perfumes/layton-parfums-de-marly",
  },
};
describe("catalog contract", () => {
  it("uses canonical returned identity, preserving variants and continuation", () => {
    const result = parseSearch({
      detail: {
        matches: [
          {
            kind: "perfume",
            name: "Example EDP",
            house: "House",
            page: "https://www.scento.com/perfumes/example-edp",
          },
          {
            kind: "perfume",
            name: "Example EDT",
            house: "House",
            page: "https://www.scento.com/perfumes/example-edt",
          },
        ],
      },
      continuation: "opaque-token",
    });
    expect(result.results.map((x) => x.id)).toEqual([
      "example-edp",
      "example-edt",
    ]);
    expect(result.continuation).toBe("opaque-token");
  });
  it("keeps missing notes empty and never invents tiers", () => {
    const p = parseFragrance({
      ...profile,
      detail: { ...profile.detail, pyramid: null, notes: ["Musk"] },
    });
    expect(p.details.top).toEqual([]);
    expect(p.details.unstructuredNotes).toEqual(["Musk"]);
  });
  it("preserves provider data separately from collector overrides", () => {
    const p = parseFragrance(profile);
    const entry = {
      source: "scento" as const,
      reference: p.reference,
      details: p.details,
      overrides: { top: ["Pear"] },
    };
    expect(effectiveDetails(entry).top).toEqual(["Pear"]);
    expect(p.details.top).toEqual(["Apple"]);
    expect(customEntry(effectiveDetails(entry)).reference).toBeNull();
  });
  it("rejects untrusted links and malformed payloads instead of claiming no results", () => {
    expect(() =>
      parseSearch({
        detail: {
          matches: [
            {
              kind: "perfume",
              name: "A",
              house: "B",
              page: "https://evil.test/perfumes/a",
            },
          ],
        },
      }),
    ).toThrow();
    expect(() => parseSearch({ detail: {} })).toThrow();
    expect(() => parseFragrance({ detail: {} })).toThrow();
  });
  it("constructs only official URLs with encoded input", () => {
    expect(catalogUrl("catalog-search", { query: "oud & musk" })).toContain(
      "q=oud+%26+musk",
    );
    expect(() =>
      catalogUrl("catalog-detail", { id: "https://evil.test" }),
    ).toThrow();
  });
});

it("uses the documented perfume name lookup separately from the website reference id", () => {
  const url = new URL(
    catalogUrl("catalog-detail", {
      id: "layton-parfums-de-marly",
      name: "Layton",
      brand: "Parfums de Marly",
    }),
  );
  expect(decodeURIComponent(url.pathname)).toBe(
    "/api/perfume/v1/perfumes/layton",
  );
});

it("keeps valid fragrance matches when the provider also returns a brand-page result", () => {
  const result = parseSearch({
    detail: {
      matches: [
        {
          kind: "perfume",
          name: "Unprofiled result",
          house: "Montale",
          page: "https://www.scento.com/brand/montale",
        },
        {
          kind: "perfume",
          name: "Oud Wood",
          house: "Tom Ford",
          page: "https://www.scento.com/perfumes/oud-wood-tom-ford",
        },
      ],
    },
    continuation: "next-page",
  });
  expect(result.results.map((p) => p.name)).toEqual(["Oud Wood"]);
  expect(result.unavailableCount).toBe(1);
  expect(result.continuation).toBe("next-page");
});
it("does not claim there are no matches when every returned perfume has an unusable reference", () => {
  expect(() =>
    parseSearch({
      detail: {
        matches: [
          {
            kind: "perfume",
            name: "Unprofiled result",
            house: "Montale",
            page: "https://www.scento.com/brand/montale",
          },
        ],
      },
    }),
  ).toThrow("no usable fragrance");
});

it("preserves pagination when an entire page contains only unprofiled entries", () => {
  const result = parseSearch({
    detail: {
      matches: [
        {
          kind: "perfume",
          name: "Synthetic unprofiled result",
          house: "Montale",
          page: "https://www.scento.com/brand/montale",
        },
      ],
    },
    continuation: "next-page",
  });
  expect(result.results).toEqual([]);
  expect(result.continuation).toBe("next-page");
  expect(result.unavailableCount).toBe(1);
});
