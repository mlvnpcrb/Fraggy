# FraggyAPI — portable backend

This backend was verified from the exported FraggyAPI package and runs without Codex Cloud APIs, credentials, publication or workspace paths. Use the directory containing this README as the project root. Original source APIs, extraction preservation, canonical matching, inline database migrations and unattended-scraping safeguards are retained.

## Render Free + Supabase Free

Use [Render setup](docs/render-free.md), [Supabase setup](docs/supabase-free.md),
[operator import](docs/first-import-operator.md), [backups](docs/database-backup.md),
[frontend integration](docs/frontend-integration.md) and the
[readiness checklist](docs/deployment-readiness.md). Current evidence is in
[Render/Supabase verification](docs/render-supabase-verification.md).
Configuration targets ₱0/month with no paid disk/worker and no unattended scraping.
Provider dashboard/free-tier settings and live connectivity are unverified; no
service or project has been created. Do not deploy before explicit owner approval.
For this target use `.env.render.example`, explicit `python -m fraggy.migrate`,
then reader-only web startup with `DATABASE_AUTO_MIGRATE=false`.

## Start here

See [external staging and attended first import](docs/external-staging.md) for exact commands and variables. `START-HERE.md` is the short version.

For Docker/BuildKit on Linux x86_64:

```sh
docker build --build-context wheelhouse=./wheelhouse --build-arg DEPENDENCY_MODE=offline -t fraggyapi:staging .
```

The bundled wheels target CPython 3.12/Linux x86_64; other platforms need matching wheels or the online build. The Python base image must already be available or downloadable by Docker. No TLS verification is disabled.

The new `compose.staging.yaml` starts **only the API**, with a persistent volume and loopback host port. It has no scheduled worker. Do not deploy it automatically; the deployment commands are instructions for an approved staging host.

## Safe first import

`python -m fraggy.first_import` requires a single source, explicit permission acknowledgement/reference and a file of 1..10 real HTTPS product URLs. It rejects over-limit/cross-source/non-product URLs, skips discovery, preserves unrelated jobs and active retry delays, backs up existing SQLite before writing, and uses the existing source/queue/matching pipeline. PostgreSQL requires an operator-confirmed external backup.

After import it checks the running API for source details, canonical search, provenance and shelf-selection references. It writes an atomic receipt even when a request or verification fails; partial imports retain their committed IDs. No source is automatically marked live-verified, no user collection is written and no trade or unattended scrape is started. Keep both unattended-scraping settings empty.

## API contracts

Existing endpoints remain unchanged by default:

- `/health`, `/v1/sources`, `/v1/sync/status`
- `/v1/perfumes`, `/v1/perfumes/{id}`, `/v1/perfumes/{id}/extraction`, `/v1/brands`
- Optional `/v1/perfumes?canonical=true` and `/v1/canonical-perfumes`
- `/v1/canonical-perfumes/{id}` and `/v1/canonical-perfumes/{id}/sources`
- `/docs` for OpenAPI

Source IDs/URLs/ratings/timestamps remain separate. Canonical UUIDs are retained for shelves; inactive/provisional selections require review and cannot authorize automatic trading. Matching review and undo are documented in [catalog.md](docs/catalog.md).

## Validation and packaging

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install --no-index --find-links ./wheelhouse -r requirements.lock
.venv/bin/python -m pytest -q
.venv/bin/python -m scripts.package_backend verify ../FraggyAPI-staging.zip
```

The original 55 tests and inline migration code are preserved. Current suite: **77 tests passing** (one upstream TestClient deprecation warning). See [current validation](docs/validation.md) and [migration inventory](docs/migrations.md). Synthetic fixtures are not real imported perfumes. The current host's live first-import attempt is proxy-blocked, with **0 real records** imported.

To create a new verified export, without overwriting an existing archive:

```sh
.venv/bin/python -m scripts.package_backend build --root . --output ../FraggyAPI-render-supabase.zip
```

The archive includes source, inline migrations, tests, Docker/staging config, documentation, optional bundled wheels, per-file checksums and a whole-archive checksum. It excludes `.env` values, input URL lists, databases, backups, caches, virtual environments and Git metadata. Historical Codex diagnostics in older docs do not form runtime dependencies; the portable staging instructions above are authoritative for this export.
