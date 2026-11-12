import { gateway } from "../../beta/runtime";
import {
  customEntry,
  type CatalogFragrance,
  type CatalogSearchPage,
} from "../../../supabase/functions/_shared/catalog";
export function createCatalogApi(mode: "live" | "demo", viewerId: string) {
  return {
    async searchFragrances(
      query: string,
      continuation?: string,
    ): Promise<CatalogSearchPage> {
      if (mode === "live")
        return gateway("catalog-search", { query, continuation }, viewerId);
      return {
        results: [
          {
            id: "sample-fragrance",
            brand: "Sample house",
            name: "Sample fragrance · demo fixture",
            sourceUrl: "https://www.scento.com/perfumes/sample-fragrance",
            family: null,
            concentration: null,
          },
        ].filter((x) =>
          `${x.brand} ${x.name}`.toLowerCase().includes(query.toLowerCase()),
        ),
        continuation: null,
      };
    },
    async getFragrance(id: string): Promise<CatalogFragrance> {
      if (mode === "live") return gateway("catalog-detail", { id }, viewerId);
      return {
        reference: {
          provider: "scento",
          id: "sample-fragrance",
          sourceUrl: "https://www.scento.com/perfumes/sample-fragrance",
          fetchedAt: new Date().toISOString(),
        },
        details: customEntry({
          brand: "Sample house",
          name: "Sample fragrance",
          top: ["Citrus"],
          heart: ["Floral accord"],
          base: ["Woods"],
        }).details,
      };
    },
  };
}
