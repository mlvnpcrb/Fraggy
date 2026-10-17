# Render Free staging (approval required)

Use the exported FraggyAPI root containing Dockerfile, requirements.lock and fraggy/.
No service, database, disk, domain, billing upgrade or deployment was created by this task.
Target hosting spend: ₱0/month. Stop if either dashboard requires a paid plan or payment.

## Configuration and provider verification

`render-free-settings.json` is an inert dashboard checklist, not an executable Blueprint.
No render.yaml is supplied: current Render documentation requests failed at the Codex
proxy, so the user's requirement to verify free-tier Blueprint compatibility cannot be
met here. Do not treat a syntactically plausible Blueprint as provider validation.
Before deployment confirm current Free availability, Docker support, health checks,
secret-file availability, outbound TCP 5432 and the cost summary in the dashboard.
Official references: https://render.com/docs/free and
https://render.com/docs/blueprint-spec . No paid disks, workers, cron, pre-deploy
commands, reserved IPs or paid Render database are required by this configuration.
If a required feature is paid, stop; do not upgrade.

## Exact setup sequence

1. Complete [Supabase setup](supabase-free.md), backup and explicit migrations first.
2. Run the local verification commands below. Review the readiness checklist.
3. Ask the owner for deployment approval. These instructions do not grant approval.
4. After approval, publish the reviewed source root to the chosen Git repository.
   Exported files are local; this task has not committed or pushed them. Exclude `.env`,
   credentials, `var/`, backups and actual input URL lists. Check `git diff --cached`.
5. In Render choose New → Web Service → that repository. If the backend is nested,
   set its root directory to the folder containing Dockerfile. Runtime Docker;
   Dockerfile `./Dockerfile`, build context `.`, instance **Free**, one instance.
   Disable automatic deploys. Do not add a disk or background service.
6. Copy settings from `.env.render.example` into dashboard environment settings,
   replacing placeholders securely. Add the trusted Supabase project CA as secret
   file `supabase-ca.crt`, available at `/etc/secrets/supabase-ca.crt`; confirm the
   feature is free. Never put a private key or DB password in this file or Git.
7. Health check `/health`; leave Docker command unset. Existing CMD now runs
   `python -m fraggy.web`, binds `0.0.0.0:$PORT`, single API process, no scheduler.
   Render supplies PORT. Build uses the existing online pinned dependencies.
8. Review summary showing Free/₱0 and no paid resources, then manually deploy
   only within the explicit approval. Do not enable automatic redeployment.
9. Run the HTTPS smoke checks below. Missing schema must fail startup; never fix
   it by granting DDL to the web reader or enabling startup migrations.

Environment settings:

| Variable | Web value |
|---|---|
| DATABASE_URL | Secret SQLAlchemy psycopg URI using `fraggy_reader.PROJECT`, session pooler 5432, verified TLS |
| DATABASE_AUTO_MIGRATE | `false` (required) |
| CORS_ORIGINS | Exact approved `https://PROJECT.pages.dev`; empty until known |
| API_RATE_LIMIT_PER_MINUTE | `120` per client per process |
| API_CACHE_TTL_SECONDS | `5` |
| SCRAPING_APPROVED_SOURCES | Empty |
| LIVE_VALIDATED_SOURCES | Empty |
| PORT | Assigned by Render; no manual override |

No API or Supabase service-role key is needed by the public frontend or API. Web
uses only the DB reader password. DATABASE_URL passwords must be URL encoded.
The bounded SQLAlchemy pool uses 3 connections plus at most 2 overflow, a 15-second
wait, pre-ping, 300-second recycle. Budget operator connections separately.

## Local verification

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
.venv/bin/python -m pytest -q
docker build -t fraggyapi:render .
.venv/bin/python -m scripts.validate_docker --image fraggyapi:render
.venv/bin/python -m scripts.validate_postgres --image fraggyapi:render
```

Offline x86_64 CPython 3.12 alternative:

```bash
.venv/bin/python -m pip install --no-index --find-links=wheelhouse -r requirements.lock
docker build --build-context wheelhouse=./wheelhouse --build-arg DEPENDENCY_MODE=offline -t fraggyapi:render .
```

Use the supplied Docker integration scripts locally only; they create isolated
throwaway resources and synthetic fixtures. They are not live imports.

After an approved deployment, substitute the actual HTTPS URL:

```bash
export FRAGGY_API_BASE_URL='https://YOUR-SERVICE.onrender.com'
curl --fail --max-time 90 "$FRAGGY_API_BASE_URL/health"
curl --fail --max-time 90 "$FRAGGY_API_BASE_URL/v1/canonical-perfumes?limit=10"
curl --fail --max-time 90 "$FRAGGY_API_BASE_URL/v1/brands?limit=10"
```

Initial empty catalog results are valid, not evidence of a successful real import.
Use the attended workflow only after source URLs and permission details are supplied.

## Free-tier constraints

Free services may sleep on inactivity and incur long cold starts, restart, have
limited hours/bandwidth/build resources and lack availability guarantees. Exact
quotas and terms must be rechecked; no forever-free guarantee can be made here.
No durable local disk is used for catalog state: DATABASE_AUTO_MIGRATE=false
connects to PostgreSQL without mkdir/DDL/index writes. Cache is disposable in memory.
The image directory `/app/var` exists for backward-compatible SQLite/operator use
but the Render web process does not depend on its persistence.
Free Supabase projects may pause, have storage/connection/egress limits and no
included managed backup entitlement. Retain local backups. Do not activate billing
upgrades or paid options; keep storage and bandwidth below current free caps.
