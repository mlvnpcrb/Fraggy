/** Provider contract, shared by Edge and mobile. No SDK, secrets or network side effects. */
export type CatalogRef = {
  provider: "scento";
  id: string;
  sourceUrl: string;
  fetchedAt: string;
};
export type FragranceDetails = {
  brand: string;
  name: string;
  concentration: string | null;
  family: string | null;
  top: string[];
  heart: string[];
  base: string[];
  unstructuredNotes: string[];
};
export type FragranceEntry = {
  source: "scento" | "custom";
  reference: CatalogRef | null;
  details: FragranceDetails;
  overrides: Partial<FragranceDetails>;
};
export type CatalogMatch = {
  id: string;
  brand: string;
  name: string;
  family: string | null;
  concentration: string | null;
  sourceUrl: string;
};
export type CatalogSearchPage = {
  results: CatalogMatch[];
  continuation: string | null;
  stale?: boolean;
};
export type CatalogFragrance = {
  reference: CatalogRef;
  details: FragranceDetails;
  stale?: boolean;
};
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error(
      "Scento returned an unsupported response. Enter details yourself or retry.",
    );
  return v as Record<string, unknown>;
};
const str = (v: unknown, max = 160) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const list = (v: unknown): string[] =>
  v == null
    ? []
    : Array.isArray(v)
      ? v
          .filter((x) => typeof x === "string")
          .slice(0, 24)
          .map((x) => str(x, 80))
          .filter(Boolean)
      : typeof v === "string"
        ? [str(v, 500)]
        : [];
export function canonicalReference(value: unknown): {
  id: string;
  sourceUrl: string;
} {
  const sourceUrl = str(value, 500);
  const u = new URL(sourceUrl);
  if (
    u.protocol !== "https:" ||
    !["www.scento.com", "scento.com"].includes(u.hostname) ||
    u.username ||
    u.password ||
    u.port
  )
    throw Error("Unsupported Scento reference.");
  const match = u.pathname.match(
    /^\/(?:en\/)?perfumes\/([a-z0-9][a-z0-9-]{0,159})\/?$/i,
  );
  if (!match || u.search || u.hash)
    throw Error(`Unsupported Scento fragrance link path: ${u.pathname}.`);
  return { id: match[1], sourceUrl: u.origin + u.pathname };
}
export function parseSearch(raw: unknown): CatalogSearchPage {
  const root = object(raw),
    detail = object(root.detail);
  if (!Array.isArray(detail.matches))
    throw Error("Scento returned an unsupported search response.");
  return {
    results: detail.matches
      .filter((x) => object(x).kind === "perfume")
      .slice(0, 10)
      .map((x) => {
        const m = object(x),
          ref = canonicalReference(m.page);
        const name = str(m.name, 100),
          brand = str(m.house, 80);
        if (!name || !brand) throw Error("Incomplete Scento result.");
        return {
          ...ref,
          name,
          brand,
          family: str(m.family) || null,
          concentration: str(m.concentration) || null,
        };
      }),
    continuation:
      typeof root.continuation === "string"
        ? str(root.continuation, 1500)
        : null,
  };
}
export function parseFragrance(raw: unknown): CatalogFragrance {
  const root = object(raw),
    d = object(root.detail),
    p = d.pyramid == null ? {} : object(d.pyramid),
    ref = canonicalReference(object(root.scento_page).url);
  const name = str(d.name, 100),
    brand = str(d.house, 80);
  if (!name || !brand) throw Error("Incomplete Scento fragrance.");
  return {
    reference: {
      provider: "scento",
      ...ref,
      fetchedAt: new Date().toISOString(),
    },
    details: {
      name,
      brand,
      concentration: str(d.concentration) || null,
      family: str(d.family) || null,
      top: list(p.top),
      heart: list(p.heart),
      base: list(p.base),
      unstructuredNotes: list(d.notes),
    },
  };
}
export function customEntry(
  details: Partial<FragranceDetails> = {},
): FragranceEntry {
  return {
    source: "custom",
    reference: null,
    details: {
      brand: "",
      name: "",
      concentration: null,
      family: null,
      top: [],
      heart: [],
      base: [],
      unstructuredNotes: [],
      ...details,
    },
    overrides: {},
  };
}
export function effectiveDetails(entry: FragranceEntry): FragranceDetails {
  return { ...entry.details, ...entry.overrides };
}
export function catalogUrl(
  action: string,
  input: Record<string, unknown>,
): string {
  const base = "https://www.scento.com/api/perfume/v1";
  if (action === "catalog-search") {
    const q = str(input.query, 160);
    if (q.length < 2) throw Error("Enter at least two characters.");
    const p = new URLSearchParams({ q, kind: "perfume", lang: "en" });
    if (input.continuation)
      p.set("continuation", str(input.continuation, 1500));
    return `${base}/search?${p}`;
  }
  if (
    action !== "catalog-detail" ||
    typeof input.id !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,159}$/i.test(input.id)
  )
    throw Error("Choose a valid fragrance.");
  // The website's SEO slug is a reference ID, not necessarily an API alias.
  // Scento documents the perfume name as a valid lookup value.
  if (
    input.name !== undefined &&
    (typeof input.name !== "string" ||
      !input.name.trim() ||
      input.name.length > 100)
  )
    throw Error("Choose a valid fragrance name.");
  const lookup =
    input.name === undefined
      ? input.id
      : String(input.name).trim().toLowerCase();
  return `${base}/perfumes/${encodeURIComponent(lookup)}?lang=en`;
}
