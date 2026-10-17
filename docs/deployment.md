> Historical development evidence. For this portable export, use [external-staging.md](external-staging.md). No Codex paths or publication are needed.

# Local testing and staging deployment requirements

No deployment has been performed. Commands under “Staging after approval” are instructions for a later explicitly approved deployment, not evidence that staging exists. Live scraping remains blocked, and automatic workers stay disabled.

## Local verification

```sh
cd /workspace/Fraggy
UV_CACHE_DIR=/tmp/fraggy-uv-cache uv venv --allow-existing .venv
UV_CACHE_DIR=/tmp/fraggy-uv-cache uv pip install --python .venv/bin/python -r requirements.lock
.venv/bin/python -m pytest -q
.venv/bin/python -m scripts.diagnose_network
.venv/bin/python -m uvicorn fraggy.api:app --host 0.0.0.0 --port 8000
```

In another terminal, use internal requests:

```sh
curl -fsS http://127.0.0.1:8000/health
curl -fsS 'http://127.0.0.1:8000/v1/perfumes?canonical=true&limit=25'
curl -fsS 'http://127.0.0.1:8000/v1/sources'
```

No public preview is needed. The main catalog is empty until a real permitted import succeeds. Tests do not populate it.

## Reproduce isolated Docker and PostgreSQL checks

Default online build, on a builder with supported DNS/egress:

```sh
docker build -t fraggyapi-validation:local .
```

Current cloud builder DNS is unavailable, so the validated alternative is:

```sh
export DOCKER_CONFIG=/tmp/fraggy-docker-config
python -m pip download --only-binary=:all: --dest /tmp/fraggy-wheelhouse -r requirements.lock
docker build --build-context wheelhouse=/tmp/fraggy-wheelhouse --build-arg DEPENDENCY_MODE=offline -t fraggyapi-validation:local .
.venv/bin/python -m scripts.validate_docker --image fraggyapi-validation:local
docker pull postgres:16-alpine
.venv/bin/python -m scripts.validate_postgres --image fraggyapi-validation:local
docker compose config --quiet
```

Download wheels over verified HTTPS on a host matching the image's Python 3.12/Linux/CPU, then transfer them through a trusted channel if needed. No TLS/checksum verification is disabled. The temporary PostgreSQL check has TCP disabled and uses a private Unix-socket volume with local trust only inside throwaway test containers; it is not a production authentication configuration.

Both scripts create uniquely named temporary containers/volumes and remove their own resources. SQLite validation covers startup, restart and container recreation, source/queue/canonical/audit persistence, and fixture import. PostgreSQL validation covers migration from a legacy populated table, preserved source values, generated IDs, repeated synthetic import, matching and API behavior. Neither script scrapes a real site.

## Staging after approval — API only

Requirements: reviewed image, backed-up database, deployment-supported egress/DNS, TLS reverse proxy, a shared gateway rate limiter for replicas, secret management, the PWA's exact allowed origin, and application monitoring. Use one initialization process before multiple API/worker processes. Keep workers disabled until source evidence and permissions are reviewed.

Build/tag the reviewed image with the commands above, then **only after deployment approval**:

```sh
docker volume create fraggy-staging-catalog
# .env is ignored by Git. Review its names and populate values securely first.
cp -n .env.example .env
docker run -d --name fraggy-staging-api --restart unless-stopped \
  -p 127.0.0.1:8000:8000 \
  --env-file .env \
  --mount type=volume,source=fraggy-staging-catalog,target=/app/var \
  fraggyapi-validation:local
curl -fsS http://127.0.0.1:8000/health
curl -fsS 'http://127.0.0.1:8000/v1/perfumes?canonical=true'
```

Set `CORS_ORIGINS` to the real PWA origin before staging use. This command runs only the API, binds the host port to loopback, and starts no scheduler. Put HTTPS at the approved reverse proxy. No environment proxy hostname/credential should be copied blindly into Docker: configure the deployment's supported DNS/egress routes. The development proxy route may not resolve inside a bridge container.

For managed PostgreSQL, supply `DATABASE_URL=postgresql+psycopg://...` through the deployment's secret manager rather than a committed file or shell argument containing credentials. Apply provider TLS settings without weakening verification. PostgreSQL 16 is integration-tested, but a particular managed provider's network/auth/TLS setup still needs its own check.

Optional PostgreSQL search optimization, run by a database administrator on the approved database:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS perfumes_name_trgm ON perfumes USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS perfumes_brand_trgm ON perfumes USING gin (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS canonical_name_trgm ON canonical_perfumes USING gin (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS canonical_brand_trgm ON canonical_perfumes USING gin (normalized_brand gin_trgm_ops);
```

These optional extension/index commands were not applied to a production database and their load behavior was not benchmarked. SQLite FTS5 trigram indexing is automatic when supported, with the existing LIKE predicate as the authority and fallback.

## Bounded source validation, then separately approved scheduling

After outbound access and permissions are confirmed, use a single source and inspect actual records:

```sh
.venv/bin/python -m fraggy.sync --sources fragrantica --max-jobs 10
.venv/bin/python -m fraggy.catalog match
# After diagnosing a terminal failure and correcting its cause:
.venv/bin/python -m fraggy.sync --sources fragrantica --max-jobs 10 --retry-failed
```

Complete [the live checklist](live-validation.md), including repeated sync, real record comparison, no duplicates and canonical attribution. Do not use fixture success to set these attestations. Once that source has actually passed validation and scheduling is explicitly approved:

```sh
export SCRAPING_APPROVED_SOURCES=fragrantica
export LIVE_VALIDATED_SOURCES=fragrantica
.venv/bin/python -m fraggy.sync --sources fragrantica --max-jobs 100 --refresh-days 7 --daily
```

For Compose, `docker compose up -d api` starts the API only. Starting the worker requires the explicit `scraping` profile and the same reviewed environment attestations. The default online Compose build still requires a functioning builder network. Do not launch multiple schedulers; the lock is filesystem-local and must be shared by all workers/review commands on that host. Multi-host worker claiming is not implemented.

## Operational requirements and remaining limits

- Back up SQLite using its backup API or a quiesced database, including source records, memberships, reviews and audit history. Do not copy an actively written database blindly. Use managed PostgreSQL backups/PITR where available.
- Retain backups before additive migrations. Old IDs/data are preserved; no destructive downgrade migration is supplied. Historical canonical references remain resolvable even if inactive.
- Monitor HTTP errors, per-source blocked/partial/deferred states, terminal jobs, last successful record checks, queue depth and actual catalog coverage. Never infer readiness from a running worker alone.
- Set `SCRAPER_USER_AGENT` to an identifiable agent/contact and respect robots crawl delays and Retry-After. A 401/403/429, challenge or uninspected redirect stops that source. No identity rotation or access-control bypass is supported.
- Rate limit/catalog cache settings are process-local. A shared gateway should enforce replica-wide quotas and handle trusted proxy IPs. Source/extraction status endpoints are uncached; cached selection eligibility is not trading authorization.
- Generic source adapters still need actual HTML/JSON-LD and discovery validation. Unsupported notes/perfumers/accords/performance fields must remain missing, not guessed.
- Authenticated shelf ownership, trading transactions, provider-specific PostgreSQL TLS, shared/distributed rate limiting and realistic production load testing are outside the verified capabilities of this catalog iteration.
