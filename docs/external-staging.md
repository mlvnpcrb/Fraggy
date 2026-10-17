# Independent staging and attended first import

This workflow uses the exported backend, Docker, ordinary HTTPS and a persistent database. It does not call Codex APIs or require Codex publication. No deployment has been performed.

## Requirements

- An approved external Linux x86_64 staging host with Docker/BuildKit named-context support and Docker Compose v2. The bundled wheels target CPython 3.12/Linux x86_64. Other platforms must download matching wheels or use the online image build.
- The Python base image must be available to Docker. Offline dependency installation still needs that base image locally.
- Working deployment-supported DNS, CA trust and outbound HTTPS to the selected source, including its robots file and permitted product pages. Honor an existing supported proxy; do not copy an unreachable Codex proxy hostname or bypass restrictions.
- Permission/data agreement for the selected source and intended app use; one operator supplies a non-secret reference. An operator flag is an attestation, not proof of legal access.
- Between one and ten actual product URLs from **one source**. No guessed URLs or fake sample perfumes are bundled.
- Persistent storage, an approved database backup, and a TLS reverse proxy/shared gateway limiter before making an external API public. Shelf ownership/trading transactions remain the PWA's authenticated application responsibility.

The source adapters are not promoted to production-ready by this workflow. The seven generic adapters remain experimental. First test an authorized source whose live parser can be checked against its pages.

## Extract and test without Codex

```sh
unzip FraggyAPI-staging.zip
cd FraggyAPI
# With Python 3.12 and venv support on Linux x86_64:
python3.12 -m venv .venv
.venv/bin/python -m pip install --no-index --find-links ./wheelhouse -r requirements.lock
.venv/bin/python -m pytest -q
.venv/bin/python -m scripts.package_backend verify ../FraggyAPI-staging.zip
```

Alternatively use Docker directly; no local Python virtual environment is needed for the API:

```sh
docker build --build-context wheelhouse=./wheelhouse --build-arg DEPENDENCY_MODE=offline -t fraggyapi:staging .
```

On a builder with approved package-registry access, the online alternative is:

```sh
docker build -t fraggyapi:staging .
```

TLS verification stays enabled. The manifest verifies source/test/configuration inventory and per-file checksums; the sibling `.sha256` file checks the complete ZIP. Neither is a signature or a substitute for a trusted download channel.

## Prepare configuration without starting anything

```sh
cp -n .env.staging.example .env.staging
chmod 600 .env.staging
cp -n inputs/first-import.urls.example inputs/first-import.urls
chmod 755 inputs
chmod 644 inputs/first-import.urls
```

Edit `.env.staging` securely and put 1..10 real, authorized HTTPS product URLs in `inputs/first-import.urls`, one per line. URLs must have no query parameters, fragments or embedded credentials. Comments/blank lines are allowed. More than the chosen limit is rejected, not silently truncated. The URLs file is mounted read-only and deliberately readable by the non-root container user; it must contain no secrets.

| Variable | Staging value/default | Requirement |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:////app/var/fraggy.db` | API/import must use the same database; managed PostgreSQL credentials belong in a secret manager |
| `CORS_ORIGINS` | Empty until set | Set to the real PWA origin for browser use |
| `SCRAPER_USER_AGENT` | `FraggyAPI/0.1` | Use an identifiable agent and contact for live requests |
| `SCRAPE_DELAY_SECONDS` | `20` | Minimum 10, robots crawl-delay can increase it; source-specific override is supported |
| `SYNC_LOCK_PATH` | `/app/var/sync.lock` | Keep in the shared persistent volume |
| `API_RATE_LIMIT_PER_MINUTE` | `120` | Process-local, gateway limits required for replicas |
| `API_CACHE_TTL_SECONDS` | `5` | Verification sends no-cache to avoid stale responses |
| `FRAGGY_API_TOKEN` | Empty | Optional secure gateway token; never put it in a URL or permission reference |
| `SCRAPING_APPROVED_SOURCES` | **Empty** | Leave empty; no unattended scraping |
| `LIVE_VALIDATED_SOURCES` | **Empty** | Leave empty; fixtures do not establish live validation |
| `FRAGGY_PORT` | `8000` | Optional host-shell setting for Compose's loopback port |

There are no required Codex tokens, environment IDs or network secrets. External proxies/private gateways may need deployment-managed credentials; neither scripts nor receipts print those values.

## API-only staging — execute only after deployment approval

These are instructions, not actions already performed:

```sh
docker compose -p fraggy-stage -f compose.staging.yaml config --quiet
docker compose -p fraggy-stage -f compose.staging.yaml up -d --no-build api
curl -fsS http://127.0.0.1:8000/health
curl -fsS 'http://127.0.0.1:8000/v1/perfumes?canonical=true&limit=25'
```

`compose.staging.yaml` has **only the API**, binds the host port to loopback, and retains SQLite in a named volume. There is no worker, cron, scheduler or daily scrape service. The existing original Compose configuration remains available, with its opt-in worker profile and gates preserved. Do not start that profile for this workflow.

The database initializer retains all inline additive migrations in `fraggy/db.py` and the existing SQLite search-index migration. Initialize once before multiple processes. See [migration inventory](migrations.md).

## First import — at most ten explicit product URLs

After permissions and actual robots/source access are confirmed, run this **once**, attended:

```sh
docker compose -p fraggy-stage -f compose.staging.yaml exec -T api \
  python -m fraggy.first_import \
  --source fragrantica \
  --urls-file /app/inputs/first-import.urls \
  --limit 10 \
  --authorized \
  --operator catalog-owner \
  --permission-reference 'Owner-confirmed Fragrantica data agreement' \
  --api-base-url http://127.0.0.1:8000 \
  --report /app/var/first-import.json
```

Use the source you actually have permission to access and a truthful non-secret reference. Do not include credentials or agreement contents. CLI help lists all available source keys. No URL discovery is performed in this attended workflow, and unrelated pending/running jobs are not consumed or recovered.

Before initialization/import, an existing SQLite database is backed up through SQLite's backup API into `/app/var/backups` by default. For PostgreSQL, take a provider snapshot/`pg_dump` backup first and add `--database-backup-confirmed`; the flag does not create that external backup. The existing worker lock prevents overlap. Active backoff/terminal failures are preserved, not forcibly reset.

The command fetches robots through the existing source client, obeys robots/rate limits, fetches only selected product pages, saves through the existing extraction/queue/canonical pipeline and verifies against the running API. At most ten product URLs are attempted. A robots failure, challenge, 401/403/429 or uninspected redirect stops the source. Missing/uncertain extraction preserves existing values. Earlier successful records remain committed if a later request fails.

Receipts include the run, imported source record IDs, per-job error classifications, successful HTTP observations/body hashes (no raw HTML), API-verified canonical/shelf references, timestamps and backup reference. A failure or no imported records exits nonzero. Verification failures retain committed record IDs in the receipt instead of implying that nothing was written.

## Verify search, shelves and repeat synchronization

```sh
docker compose -p fraggy-stage -f compose.staging.yaml cp api:/app/var/first-import.json ./first-import.json
curl -fsS 'http://127.0.0.1:8000/v1/canonical-perfumes?source=fragrantica&limit=100'
```

The command itself checks each imported source detail against the database, locates its canonical UUID in paginated search, verifies associated source provenance, and retrieves an active shelf-selection reference. The report's `verified_records[].shelf_reference` contains `canonical_id` and `source_record_id` for a shelf. Provisional identities can still be saved for review; their trading flag stays false. No user shelf is created without authentication, and no trading operation is executed.

Manually compare imported names, brands, concentrations, years, ratings/scales and available notes/perfumers with the actual source pages. Review unsupported/missing fields. The report always states `live_source_validation: not_established_by_this_check`; technical import/API success is not a declaration that all source selectors or data rights are validated.

After respecting any persisted retry delay, repeat the same command with:

```text
--report /app/var/first-import-repeat.json
```

Compare the two receipts and database counts. Unchanged source identity must keep the same source-record ID and canonical UUID without creating duplicates. Unchanged accepted data keeps `updated_at`; a successful refresh advances `last_checked_at`. Changed source identity can correctly require review. Do not reset failed queues or delete data to make the check pass. Keep both unattended settings empty even after this attended import.

## Reproduce isolated checks

With the reviewed image tagged for validation:

```sh
.venv/bin/python -m scripts.validate_docker --image fraggyapi:staging
docker pull postgres:16-alpine
.venv/bin/python -m scripts.validate_postgres --image fraggyapi:staging
```

The Docker test uses synthetic source pages against actual local HTTP, imports ten targeted records, verifies search/shelf references, repeats without duplicates, and checks restart/recreation persistence. The source is mocked and the container has no external network. PostgreSQL tests use synthetic data and an isolated socket-only container. These tests clean up their own resources and are not deployment or live ingestion.

## Current live result

In the Codex host, the new first-import command was exercised once against a development API and one selected Fragrantica URL. It exited nonzero with `environment_proxy` before any successful source HTTP response. Actual imported records: **0**. Actual canonical entities from that attempt: **0**. No scheduler was started. External staging still needs successful permitted network access, actual product URLs and manual source comparison before live data can be called validated.
