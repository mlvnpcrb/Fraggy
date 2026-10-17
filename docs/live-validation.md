> Render/Supabase target: see [render-supabase-verification.md](render-supabase-verification.md)
> and [first-import-operator.md](first-import-operator.md). No live import was run
> in this phase; approved URLs and permission details are required before one.

> Historical development evidence. For this portable export, use [external-staging.md](external-staging.md). No Codex paths or publication are needed.

# Source-by-source live validation

All eight robots probes on 2026-10-17 returned **environment proxy access denied**. No successful live perfume extraction has been demonstrated. `/v1/sources` remains `live_verified: false`. Run `python -m scripts.check_sources` for fresh read-only probes; a robots HTTP success alone is not a catalog success.

| Source | Entry point to inspect | Extraction checks after permitted access works | Current state |
| --- | --- | --- | --- |
| Fragrantica | `/designers/`, designer links and robots sitemaps | Actual HTML identity, brand, all note tiers, accords, perfumers, rating/votes, original longevity/sillage scales | Proxy denied; synthetic HTML tests only |
| Parfumo | `/Brands`, robots sitemaps and `/Perfumes/...` | Single Product JSON-LD, brand/name/concentration/year, native rating scale; inspect separate notes/performance markup | Proxy denied; generic parser experimental |
| Basenotes | `/directory/`, robots sitemaps and `/fragrances/...` | Current directory URL structure, Product entity availability, release year and perfumer/notes fields | Proxy denied; generic parser experimental |
| Wikiparfum | `/en/fragrances`, robots sitemaps | Language/canonical URLs, Product availability, ingredients versus notes and fragrance families | Proxy denied; generic parser experimental |
| Osmoz | `/perfumes`, robots sitemaps | Current product routes, Product availability, description, olfactory families and notes | Proxy denied; generic parser experimental |
| Perfume.com | Homepage and robots product sitemaps | Canonical product URL, SKU, separate variants/concentrations, size, currency and availability | Proxy denied; generic parser experimental |
| FragranceX | Homepage and robots product sitemaps | Current product routes, SKU, offers/currency, concentration/size variants, no category records | Proxy denied; generic parser experimental |
| LuckyScent | Homepage and robots product sitemaps | `/product/...` identity, Product availability, brand, perfumers, sample versus bottle variants | Proxy denied; generic parser experimental |

For **each source**, record dated evidence for all steps below before declaring it live-validated:

1. Fetch robots using the configured identifiable User-Agent. Record status, permitted routes, crawl delay, sitemap URLs, and any agreement-supported access route. Stop on disallow, 401/403/429, redirect requiring inspection, challenge, or access denial. Never rotate identities or bypass controls.
2. Inspect a permitted listing and sitemap. Confirm same-site URL discovery against actual visible catalog links, pagination, and canonical URLs. A candidate route in code is not evidence of coverage.
3. Run a bounded import: `python -m fraggy.sync --sources SOURCE_KEY --max-jobs 10`. Inspect job errors and source-specific status. Verify that actual perfume jobs completed, not only discovery jobs.
4. Compare at least three imported records to source pages: ordinary fragrance, missing-field example, and EDT/EDP/Parfum/Elixir variant. Confirm IDs/URLs, name/brand, concentration and year. Check ratings against that site's scale. Verify category, sample, and bundle pages do not become false fragrance identities.
5. Refresh those same records. Confirm no extra source rows; unchanged accepted values preserve `updated_at`; `last_checked_at` advances only on a successful parse. Verify missing/uncertain fields keep prior accepted values and extraction evidence records their state.
6. Validate any explicit empty field against authoritative source content. An absent selector or loading placeholder is not an empty value. Inspect parser drift and numeric-format failures.
7. Inspect canonical memberships. Same full identity may share a canonical entity; different concentrations/years must not. Incomplete identities require review. Source-specific ratings must remain distinct.
8. Record measured request throughput, rate-limit responses, discovery completeness limitations and an achievable refresh interval. Enable a durable monitored scheduler only after these checks. Save sanitized fixtures, without credentials or member data, for regression tests.

Do not set a live-verification flag based solely on fixture tests, process uptime, robots responses, or registered adapters. Site-specific fields remain unimplemented for the seven generic adapters until supported parsers and real-page evidence are available.

## Latest network investigation and source status

Fresh probes on 2026-10-17 again fail **before reaching any source**: httpx raises `ProxyError: 403 Forbidden` at HTTPS CONNECT. The configured HTTP/HTTPS proxy hostname is `proxy`, port 8080; diagnostics do not print credentials or complete environment values. A verified-TLS PyPI request succeeds through that same proxy. Direct local hostname lookup fails for both package/source hosts, while proxy-routed package HTTPS succeeds: local resolver failure alone is not an explanation for source-specific CONNECT rejection.

A normal Docker bridge container inherits resolver `172.31.0.29` and cannot resolve package hosts. This explains the online builder DNS failure independently of source HTTP behavior. Offline wheel installation works without disabling TLS or altering package verification. The temporary database tests use a shared Unix socket and no external network.

| Source | Current network evidence | Discovery / selectors / pagination | Real records imported |
| --- | --- | --- | --- |
| Fragrantica | Environment proxy CONNECT denied | Untested live; dedicated HTML fixtures pass | 0 |
| Parfumo | Environment proxy CONNECT denied | Untested live; JSON-LD experimental | 0 |
| Basenotes | Environment proxy CONNECT denied | Untested live; JSON-LD experimental | 0 |
| Wikiparfum | Environment proxy CONNECT denied | Untested live; JSON-LD experimental | 0 |
| Osmoz | Environment proxy CONNECT denied | Untested live; JSON-LD experimental | 0 |
| Perfume.com | Environment proxy CONNECT denied | Untested live; JSON-LD experimental | 0 |
| FragranceX | Environment proxy CONNECT denied | Untested live; JSON-LD experimental | 0 |
| LuckyScent | Environment proxy CONNECT denied | Untested live; JSON-LD experimental | 0 |

No evidence currently identifies a source-side ban, CAPTCHA, robots permission, permitted complete discovery method, or production-ready source parser. No protected images or reviews were copied. Candidate routes in the earlier table must still be checked against actual permitted pages.

### Required environment action

The bound configuration draft already contains these exact bare/www pairs:

`fragrantica.com`, `www.fragrantica.com`, `parfumo.com`, `www.parfumo.com`, `basenotes.com`, `www.basenotes.com`, `wikiparfum.com`, `www.wikiparfum.com`, `osmoz.com`, `www.osmoz.com`, `perfume.com`, `www.perfume.com`, `fragrancex.com`, `www.fragrancex.com`, `luckyscent.com`, `www.luckyscent.com`.

Review/save the existing outbound-domain configuration in environment settings and apply the platform's supported runtime update/restart if required. Saved draft metadata does not establish active proxy policy. If the same CONNECT denial persists after application, platform support must diagnose egress-policy propagation. No raw GitHub token, new scraping credential, application parser change, direct-IP route or proxy bypass resolves the observed pre-source denial. A changed permission state should be followed by fresh diagnostics, not repeated unchanged scraping attempts.

```sh
.venv/bin/python -m scripts.diagnose_network
# Only after permitted source access works:
.venv/bin/python -m fraggy.sync --sources fragrantica --max-jobs 10
```

Keep `SCRAPING_APPROVED_SOURCES` and `LIVE_VALIDATED_SOURCES` empty during investigation. No source is automatically marked live-verified by an operator environment variable. Complete the per-source comparison/repeat-sync checklist above before attesting readiness and enabling a scheduler. Real-data success criteria remain unmet until at least one allowed source imports actual perfume records and the subsequent canonical/repeat-sync checks succeed.
