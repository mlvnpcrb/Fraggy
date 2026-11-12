import { lookupCatalog } from "../../supabase/functions/_shared/catalogService.ts";
import type {
  CatalogFragrance,
  CatalogSearchPage,
} from "../../supabase/functions/_shared/catalog.ts";
/** Shared adapter exercise. A caller using fixtures MUST label its result as a test. */
export async function verifyScento(
  fetcher: typeof fetch,
  onStep: (message: string) => void = () => {},
) {
  const cache = new Map<string, Record<string, unknown>>();
  const deps = {
    fetcher,
    read: async (key: string) =>
      cache.has(key) ? { payload: cache.get(key)!, stale: false } : null,
    write: async (key: string, payload: Record<string, unknown>) => {
      cache.set(key, payload);
    },
  };
  const profiles: {
    name: string;
    brand: string;
    id: string;
    noteCount: number;
    sourceUrl: string;
  }[] = [];
  for (const query of ["Layton", "Oud Wood"]) {
    onStep(`Search: ${query}`);
    const results = (await lookupCatalog(
      "catalog-search",
      { query },
      deps,
    )) as unknown as CatalogSearchPage;
    const match = results.results.find(
      (p) => p.name.toLowerCase() === query.toLowerCase(),
    );
    if (!match)
      throw Error(`Search did not return the expected fragrance “${query}”.`);
    onStep(`Full profile: ${match.brand} · ${match.name}`);
    const profile = (await lookupCatalog(
      "catalog-detail",
      { id: match.id, name: match.name, brand: match.brand },
      deps,
    )) as unknown as CatalogFragrance;
    if (
      profile.details.name.toLowerCase() !== match.name.toLowerCase() ||
      profile.details.brand.toLowerCase() !== match.brand.toLowerCase()
    )
      throw Error(
        `Profile identity did not match the selected search result for “${query}”.`,
      );
    const noteCount =
      profile.details.top.length +
      profile.details.heart.length +
      profile.details.base.length +
      profile.details.unstructuredNotes.length;
    if (!noteCount)
      throw Error(`The known profile “${query}” returned no usable notes.`);
    profiles.push({
      name: profile.details.name,
      brand: profile.details.brand,
      id: profile.reference.id,
      noteCount,
      sourceUrl: profile.reference.sourceUrl,
    });
  }
  onStep("Unknown-fragrance search");
  const empty = (await lookupCatalog(
    "catalog-search",
    { query: "fraggy-no-match-28e5d346" },
    deps,
  )) as unknown as CatalogSearchPage;
  if (empty.results.length)
    throw Error(
      "The no-match search unexpectedly returned a fragrance. Inspect the provider search semantics.",
    );
  return { profiles, emptySearch: true };
}
