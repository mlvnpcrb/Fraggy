# Render Free + Supabase Free target

Start with [docs/render-free.md](docs/render-free.md) and
[docs/supabase-free.md](docs/supabase-free.md). Use
[docs/deployment-readiness.md](docs/deployment-readiness.md) before approval.
No deployment, project creation or live import has been performed. Current provider
terms/settings and live PostgreSQL TLS require confirmation. Target spend is ₱0.

The prior portable Docker/SQLite workflow remains available below. It is a separate
local/external-host option, not the ephemeral Render database configuration.

# Run the exported FraggyAPI independently

Use [docs/external-staging.md](docs/external-staging.md) for complete steps. No Codex publication or token is required.

1. Extract the ZIP and enter `FraggyAPI`.
2. With Docker/BuildKit and a Linux x86_64 target, build:

```sh
docker build --build-context wheelhouse=./wheelhouse --build-arg DEPENDENCY_MODE=offline -t fraggyapi:staging .
```

3. Prepare the settings and actual input URLs without starting anything:

```sh
cp -n .env.staging.example .env.staging
chmod 600 .env.staging
cp -n inputs/first-import.urls.example inputs/first-import.urls
chmod 755 inputs
chmod 644 inputs/first-import.urls
```

Edit the settings and add 1..10 real product URLs from one authorized source. Leave unattended-scraping settings empty. After deployment approval, start only the API:

```sh
docker compose -p fraggy-stage -f compose.staging.yaml up -d --no-build api
curl -fsS http://127.0.0.1:8000/health
```

The attended first-import command, variables, receipts and repeat-import verification are in `docs/external-staging.md`. External staging must have supported DNS, CA trust and permitted source HTTPS access. The package contains no real perfume data or credentials. It has not been deployed. Live scraping remains unverified; the current host's source request was blocked by its proxy.
