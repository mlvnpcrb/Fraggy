# Render Free + Supabase Free preparation report — 2026-10-17

## Repository/package audit

Working source: exported FraggyAPI backend; original checkout and prior staging ZIP
were not replaced. The prior staging ZIP passed manifest/CRC/SHA validation: 73 files,
33 bundled wheels. The new release is separate, `FraggyAPI-render-supabase.zip`.

| Concern | Verified implementation |
|---|---|
| FastAPI | fraggy/api.py `app = create_app()`; route contracts unchanged |
| Web process | fraggy/web.py; Docker CMD `python -m fraggy.web`, assigned PORT, 0.0.0.0, one process |
| Docker | Existing multi-stage Dockerfile; original compose.yaml and API-only compose.staging.yaml retained |
| Environment | .env.render.example; DATABASE_URL, DATABASE_AUTO_MIGRATE, CORS_ORIGINS, rate/cache settings; scraping gates empty |
| Migration | Existing inline additive migrations in fraggy/db.py, explicit fraggy/migrate.py wrapper |
| Web DB | DATABASE_AUTO_MIGRATE=false checks required tables/columns, no DDL/filesystem initialization; reader credentials |
| PostgreSQL | SQLAlchemy psycopg; bounded 3+2 pool, pre-ping/recycle, session-pooler/TLS config documented |
| Health | GET /health performs SELECT 1 |
| Catalog | GET /v1/canonical-perfumes; legacy /v1/perfumes and optional canonical=true |
| Detail/shelves | GET /v1/canonical-perfumes/{id}, selection.canonical_id; /sources preserves provenance and per-source ratings |
| Import | fraggy/first_import.py; explicit 1–10 URLs, existing approval/backup flags and partial-failure receipt |
| Receipt | CLI --report; operator guide mandates durable external storage, not Render filesystem |
| Workers | fraggy/sync.py CLI only; --daily remains gated by both source approval variables; no web startup scheduler |
| Administration | No HTTP import/migration/matching mutation routes; only private operator CLI |

## Results

- **77 automated tests passed**, no failures/skips: all 73 baseline tests plus four
  deployment regressions. One pre-existing upstream Starlette/httpx deprecation warning.
- Offline Docker build passed using pinned lock, bundled wheels and cached Python base.
  New image: fraggyapi-render-validation:local. Online Render build remains untested.
- Docker non-root startup, canonical API, restart and recreation with persistent
  SQLite source/queue/canonical/audit data passed.
- Existing attended import integration passed with ten **synthetic** records and
  repeated sync without ID/count changes. These are not live imported perfumes.
- PostgreSQL 16 integration passed legacy migration twice, original ID/data/time
  preservation, sequence generation, repeated fixture synchronization, canonical
  linking and API provenance.
- Extended PostgreSQL integration passed with a SELECT-only role, actual uvicorn
  HTTP on assigned PORT=10000, **read-only root filesystem**, no persistent app
  disk, health, canonical search, detail/shelf references and two source records.
- Missing-schema read-only startup fails rather than creating/migrating tables.
- Exact-origin frontend CORS allowed; unrelated origin rejected.
- check_sources --help is now offline; --source restricts robots probes to one
  selected source, and failed probes exit nonzero rather than signaling success.
- No Supabase pg_dump/restore drill executed: host lacks PostgreSQL CLI tools and
  Supabase credentials. Backup helper requires operator-installed native clients,
  verified TLS, private files and a reviewed restore drill before import.

Disposable local Docker resources were cleaned. Existing tests were not rewritten
or removed. Existing API, extraction, canonical matching and first-import pipeline
remain unchanged; database changes wrap the original additive migration code rather
than replace it. Default local SQLite auto-initialization remains backward compatible.

## Provider/network status and cost

HTTPS requests to current official Render Blueprint/Free and Supabase connection/TLS
documentation all failed with **environment proxy errors**, not provider rejection.
No current provider schema, quotas or selected account settings could be verified.
Consequently no deployable render.yaml is provided. docs/render-free-settings.json
is an inert manual configuration checklist with Free specified and no disk/worker/cron.
Recheck these provider features and the ₱0 dashboard total before approval is executed.
No billing or paid plan was enabled. This preparation needs no paid infrastructure,
but provider free limits and future pricing cannot be guaranteed by local tests.

Session pooler 5432 is the intended IPv4-compatible Supabase connection method;
actual hostname, custom-role login and verify-full TLS must be tested from the chosen
Render region. No live Render/Supabase startup, migration or deployment is verified.

## Source/live-data status

| Source | This phase | Earlier evidence / readiness |
|---|---|---|
| Fragrantica | Not probed/imported | Proxy-blocked; dedicated HTML parser fixture-tested, live unverified |
| Parfumo | Not probed/imported | Proxy-blocked; experimental generic Product JSON-LD |
| Basenotes | Not probed/imported | Proxy-blocked; experimental generic Product JSON-LD |
| Wikiparfum | Not probed/imported | Proxy-blocked; experimental generic Product JSON-LD |
| Osmoz | Not probed/imported | Proxy-blocked; experimental generic Product JSON-LD |
| Perfume.com | Not probed/imported | Proxy-blocked; experimental generic Product JSON-LD |
| FragranceX | Not probed/imported | Proxy-blocked; experimental generic Product JSON-LD |
| LuckyScent | Not probed/imported | Proxy-blocked; experimental generic Product JSON-LD |

**Real perfumes imported: 0. Real canonical fragrances created: 0.**
No new live import was attempted: the owner must supply approved URLs and permission
details first. No synthetic data is seeded into a release database. No source is
promoted to production-ready. Images/reviews are not downloaded.

## Files created/changed

New: fraggy/web.py, fraggy/migrate.py, .env.render.example,
scripts/backup_postgres.py, tests/test_deployment.py,
docs/render-free-settings.json, docs/render-free.md, docs/supabase-free.md,
docs/first-import-operator.md, docs/database-backup.md, docs/frontend-integration.md,
docs/deployment-readiness.md and this report.

Changed: fraggy/db.py (explicit initialization gate/schema check/bounded pool),
Dockerfile (API-only PORT launcher), scripts/check_sources.py (source selection/help/failure
exit), scripts/package_backend.py (new deliverables and format 2; format 1 verification
retained), .gitignore/.dockerignore (safe example inclusion), README.md, START-HERE.md,
docs/catalog.md, docs/live-validation.md and docs/validation.md.

## Commands and approval boundary

Follow docs/render-free.md for exact install/build/test/dashboard settings,
docs/supabase-free.md for role/migration/connectivity commands,
docs/database-backup.md for backup/restore, and docs/first-import-operator.md
for the attended import. Frontend contract: docs/frontend-integration.md.

Remaining blockers: explicit deployment approval, reviewed source in repository,
current Free dashboard confirmation, an actual Supabase project/credentials/CA,
reader privilege audit, live pooled TLS/connectivity, migration/restore drill,
Render HTTPS smoke checks, approved source URLs/permissions and real extraction
comparison/repeated sync. Authenticated shelf persistence/trading is future work;
current catalog supplies stable selection references only.

**No deployment, project creation, frontend publication, paid resource, real import
or unattended scraper was started.** Review docs/deployment-readiness.md first.
