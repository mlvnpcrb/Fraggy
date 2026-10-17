> Current Render/Supabase evidence and remaining external checks:
> [render-supabase-verification.md](render-supabase-verification.md).
> The live-source attempt below is historical; this phase ran no live import.

# Portable export validation — 2026-10-17

## Working backend and original package

Development continues in the independently extracted FraggyAPI export, not the original Codex checkout. The input archive was checked against its sibling SHA-256 file and ZIP CRC before extraction:

`a293a3de5b7847b53025a719fbcb2f927f971d7872e9b7c84fd71d78fa5d28b3`

Twenty original required source/test/configuration paths were verified before editing. A new virtual environment was installed **offline from the exported wheelhouse**, and all **55 original tests passed** before development.

The earlier portable-export phase compared twelve baseline files byte-for-byte. In the current Render phase the Docker entry point and database initialization wrapper were intentionally extended; existing additive migration statements and all baseline tests remain intact. API/matching/extraction/search implementation, dependency lock and original Compose configuration remain unchanged. Inline migrations were neither omitted nor replaced. See [migrations.md](migrations.md).

## Current automated/runtime checks

| Check | Result |
| --- | --- |
| Complete suite | **77 passed**, no skips; one upstream Starlette TestClient/httpx deprecation warning |
| Original baseline | All 55 tests retained unchanged |
| New regressions | 22 checks including read-only startup/missing-schema/PORT/CORS, plus ten-URL bounds, URL safety, authorization, targeted queue isolation, API/search/shelf checks, repeat deduplication, backup, failure receipts and package integrity |
| Independent dependencies | New virtualenv installed from bundled wheels without Codex services or network |
| Docker build | Passed using the exported wheelhouse and existing Python base image |
| Docker API startup/restart/recreation | Passed with persistent source/queue/canonical/audit data |
| Attended first-import CLI in Docker | Passed with **synthetic** source pages, actual loopback HTTP API, ten targeted records and repeated synchronization without duplicates/ID changes |
| PostgreSQL 16 | Passed legacy migration, source preservation, ID generation, repeated synthetic import, matching and API checks |
| External staging Compose config | Validated; only one API service, loopback host binding and persistent volume; no worker/scheduler |
| Current real first-import attempt | **Blocked** at environment proxy; zero records imported |

Docker/DB tests run in disposable containers/volumes without a public listener or real source network. The first-import source is explicitly mocked during integration tests. Those records are synthetic and are not included in the release or a main catalog. Existing worker/profile/approval gates remain intact.

## Live first-import evidence

A local development API was started with an isolated database, then `fraggy.first_import` was invoked for one selected Fragrantica URL under the user's previously confirmed data-agreement authorization. The API health check passed. The source client's first robots request was rejected by the environment proxy before any successful source HTTP response.

- Run status: `blocked`.
- Error kind: `environment_proxy`.
- Product records successfully imported: **0**.
- API-verified imported records: **0**.
- Actual canonical entities created by this attempt: **0**.
- Successful source HTTP observations: **0**.
- Receipt: local ignored `var/validation/first-import-live.json`.
- Unattended scraping: **disabled**.

The command exited nonzero and retained its failure/retry evidence. No CAPTCHA, robots restriction, TLS or access-control bypass was attempted. The development API was stopped. No external staging deployment occurred.

## Portable workflow behavior

The new command admits only 1..10 explicit product URLs from one source, requires an authorization acknowledgement/operator/reference, skips discovery, and scopes the existing queue query to those URLs. It does not process or recover unrelated jobs. Active retry delays and terminal failures are retained. SQLite backup precedes initialization/import; PostgreSQL requires a confirmed external backup.

Imported source details are compared against the running API/database; canonical search and provenance are checked with pagination, cache bypass and a bounded verification budget. An active canonical detail must provide a shelf reference. The receipt distinguishes imported IDs from API-verified records and preserves partial results if verification fails. It does not create a user shelf or claim source-wide live validation. Missing concentration/year can produce provisional shelf references requiring review; trading remains disabled for those references.

## Remaining requirements

- An approved external host with supported outbound HTTPS/DNS/CA trust to the chosen source.
- Actual permitted product URLs and a truthful data-permission reference.
- Successful live source parsing and manual comparison of metadata, followed by repeat-sync deduplication verification.
- Deployment-specific gateway/TLS/secret management, persistent storage and backups.
- Authenticated PWA shelf ownership/trading services; the catalog supplies references, not user mutations.
- Source-specific parsers remain experimental where previously experimental. No adapter is promoted by fixtures or CLI success alone.

Current real-data success is **not established**. Exact external commands and variables are in [external-staging.md](external-staging.md). The portable package needs no Codex token, environment publication or workspace path. No deployment and no scheduled scraping were performed.
