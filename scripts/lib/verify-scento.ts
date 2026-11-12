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
  for (const { query, brand } of [
    { query: "Layton", brand: "Parfums de Marly" },
    { query: "Oud Wood", brand: "Tom Ford" },
  ]) {
    let match: CatalogSearchPage["results"][number] | undefined;
    let continuation: string | undefined;
    for (let page = 0; page < 3; page++) {
      onStep(`Search: ${query}${page ? ` · page ${page + 1}` : ""}`);
      const results = (await lookupCatalog(
        "catalog-search",
        { query, continuation },
        deps,
      )) as unknown as CatalogSearchPage;
      if (results.unavailableCount)
        onStep(
          `Excluded ${results.unavailableCount} result(s) without usable fragrance links`,
        );
      match = results.results.find(
        (p) =>
          p.name.toLowerCase() === query.toLowerCase() &&
          p.brand.toLowerCase() === brand.toLowerCase(),
      );
      if (match || !results.continuation) break;
      continuation = results.continuation;
    }
    if (!match)
      throw Error(
        `Search did not return the expected fragrance “${query}” by ${brand} within three pages.`,
      );
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
  const unknownQuery = "fraggy-no-match-28e5d346";
  const suggestions = (await lookupCatalog(
    "catalog-search",
    { query: unknownQuery },
    deps,
  )) as unknown as CatalogSearchPage;
  if (
    suggestions.results.some(
      (p) => p.name.trim().toLowerCase() === unknownQuery,
    )
  )
    throw Error(
      "The unknown query unexpectedly matched an exact fragrance name. Review this test query.",
    );
  const emptySearch = suggestions.results.length === 0;
  return {
    profiles,
    emptySearch,
    unknownSearch: {
      mode: emptySearch ? ("empty" as const) : ("suggestions" as const),
      suggestionCount: suggestions.results.length,
      exactMatch: false as const,
    },
  };
}
