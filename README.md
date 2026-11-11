# Fraggy

A private mobile fragrance cabinet for Philippine collectors. Racing green, ivory, restrained lime, and upright bottles on continuous illuminated shelves.

The authoritative redesign specification is [design.md](design.md): research-backed UI/UX rules, screen wireframes and states, visual tokens, demo/live boundaries, and acceptance checks. It describes the approved target; it does not claim those screens or the planned `admin/admin` demo login are already implemented. Earlier visual specifications are historical.

**Capture → automatic background removal → inspect the actual transparent PNG → save to a permanent shelf.** One-for-one swaps transfer ownership only after both collectors separately confirm receipt. No payments or cash top-ups.

## Private beta implementation

The default app connects to the existing Supabase Fraggy project. It includes invitation redemption, persistent email/password sessions, private collections, named shelves and ordering, recoverable capture jobs, discovery, trade proposals, chat, manual shipping/meetups, cancellation/disputes, reviews, notifications, reporting/blocking, account deletion, and founder administration.

The default app uses hosted photo jobs. Until the hosted worker is configured, captures show an actionable failure and retain the original; they never become fake successful cutouts.

This implementation is not a claim that the invitation beta is ready. See [verification and outstanding release gates](docs/private-beta-verification.md). Physical iPhone/Android, deployed cold starts, and a hosted Expo Go link must pass before inviting five collectors, then twenty.

## Develop

```sh
npm ci
cp .env.example .env.local
npx expo start --lan
```

Use Expo Go compatible with the existing SDK 58. Public Supabase URL/key defaults are included; they confer no privileged access. Never put service-role keys, worker tokens or database passwords in `EXPO_PUBLIC_*`, app config or GitHub. For a hosted preview that works with the developer’s Mac off, follow the [deployment runbook](docs/private-beta-deployment.md). A local Metro QR is not that release artifact.

## Verify

```sh
npm run typecheck
npm test
# Isolated local Postgres 17 only; NEVER point this at a hosted project.
npm run test:db
# Export first, then run the mocked API/browser screen smoke test.
npx expo export --platform all --output-dir /tmp/fraggy-beta-export
npm run test:browser
# In a Python environment containing server/requirements.txt + pytest + httpx:
U2NET_HOME=/path/to/model-directory python -m pytest server -q
docker build -f server/Dockerfile -t fraggy-worker-beta .
bash scripts/test-worker-memory.sh
```

`test:db` requires `fraggy_beta_test` on localhost:55432. It refuses other hosts and database names, resets only that test database, applies every migration and exercises RLS, quotas and real trade operations. Details are in the runbook. Browser smoke tests use an intercepted fixture API; database and model checks are separate real integration checks.

## Development fixtures

For the old session-only prototype, set `EXPO_PUBLIC_DEMO_MODE=true` and run a development Metro server. Only that explicit development path uses fixtures and simulated counterpart actions. It is ignored in production exports. `npm run cutout` starts its optional local companion and downloads the pinned model at setup time. This is unrelated to the hosted beta’s processing path.

## Collaboration

The approved scope is [the private beta plan](docs/private-beta-plan.md). Use pull requests and timestamped Supabase migrations. The captured [pre-beta schema](supabase/baseline/remote-schema.json) contains definitions, not user records or credentials. Existing records are adopted and preserved by the baseline migration. Deployment, founder bootstrap, cleanup, backups, rollback, and handoff instructions are in the runbook.
