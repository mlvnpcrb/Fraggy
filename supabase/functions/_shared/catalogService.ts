import { catalogUrl, parseFragrance, parseSearch } from "./catalog.ts";
type Payload = Record<string, unknown>;
type Cache = { payload: Payload; stale: boolean };
type Deps = {
  read: (key: string) => Promise<Cache | null>;
  write: (key: string, payload: Payload, profile: boolean) => Promise<void>;
  fetcher?: typeof fetch;
};
const inFlight = new Map<string, Promise<Payload>>();
export async function lookupCatalog(
  action: string,
  input: Record<string, unknown>,
  deps: Deps,
): Promise<Payload> {
  const url = catalogUrl(action, input),
    cached = await deps.read(url);
  if (cached && !cached.stale) return cached.payload;
  const pending = inFlight.get(url);
  if (pending) return pending;
  const task = (async () => {
    try {
      const response = await (deps.fetcher || fetch)(url, {
        signal: AbortSignal.timeout(10000),
        headers: { Accept: "application/json" },
        redirect: "error",
      });
      if (response.status === 429) {
        const delay = response.headers.get("Retry-After");
        throw Error(
          `Scento is busy. ${delay && /^\d{1,6}$/.test(delay) ? `Try again in ${delay} seconds.` : "Try again later."}`,
        );
      }
      if (!response.ok)
        throw Error(
          "Scento is unavailable. Try again or enter details yourself.",
        );
      const text = await response.text();
      if (text.length > 100000) throw Error("Scento response is too large.");
      const raw = JSON.parse(text),
        result =
          action === "catalog-search" ? parseSearch(raw) : parseFragrance(raw);
      const payload = result as unknown as Payload;
      await deps.write(url, payload, action === "catalog-detail");
      return payload;
    } catch (e) {
      if (cached) return { ...cached.payload, stale: true };
      throw e;
    }
  })();
  inFlight.set(url, task);
  try {
    return await task;
  } finally {
    inFlight.delete(url);
  }
}
