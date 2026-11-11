# Fraggy private beta deployment and handoff

The current authority is `private-beta-plan.md`. Earlier prototype documents
describe a local, simulated app and are historical. Do not introduce payments,
paid instances, keepalive pings, public storage or direct ownership writes.

## Environments and credentials

- Existing project: Supabase **Fraggy**, `flczhwwlvfnkqmtxpkmq` (Tokyo).
- App: Expo SDK 58, React Native; keep the compatible SDK during this beta.
- Processor: Render **Free** web service, Singapore, one U2NetP CPU inference at
  a time. `render.yaml` and `server/Dockerfile` describe the service.
- Mobile: only `EXPO_PUBLIC_SUPABASE_URL` and publishable key. They are public
  identifiers. Native sessions use chunked SecureStore; browser development
  sessions use AsyncStorage/localStorage. Cached collection data is scoped by
  user and contains only that user's bottles/shelves/profile, never chat or
  delivery addresses. Signing out clears local caches/drafts; uploaded jobs
  remain recoverable from the server.
- Edge: Supabase supplies its own service-role and anon credentials at runtime.
  Do not export those into the Expo bundle.
- Worker: `FRAGGY_GATEWAY_URL` and a random `FRAGGY_WORKER_TOKEN`. The database
  retains only the worker token's hash. No Supabase service-role key on Render.
- Maintenance: generated server-only token in `private.settings`; never returned
  to the app, logged or included in the scheduled command text.

## Database rollout

1. Export the current database and storage before changes. The checked-in
   `supabase/baseline/remote-schema.json` captures **definitions only**, not a
   data backup. Use Supabase's database export/CLI with an operator's database
   credentials and keep the export outside Git and chat.
2. Review and apply migrations in lexical timestamp order to the existing
   project. Never reset it. `baseline_adoption` recreates the original schema on
   an empty development DB and does nothing when the existing `profiles` table
   is present. Later migrations are additive, preserve records, revoke broad
   client writes, and make `cutouts` private.
3. Check `supabase_migrations.schema_migrations` and the dashboard advisories.
   New privileged functions have empty search paths and explicit execute
   grants. `private.*` tables intentionally have no client access policies.
4. Anonymous signup through Auth does **not** create membership or grant any
   collection access. Disable public Auth signup in the project's Auth settings
   as an additional operational restriction; the gateway uses administrative
   invitation redemption. Do not disable password sign-in for existing members.
5. Confirm the founder's email before running this once in the SQL console:

   ```sql
   select public.bootstrap_founder('CONFIRMED_FOUNDER_EMAIL');
   ```

   Deliver the returned code privately. It is single-use, email-bound, expires
   after seven days, and is not committed. The first arbitrary signup never
   becomes an administrator. Bootstrap refuses to run after membership exists.
6. The founder joins in the app, then uses Profile → Founder administration for
   invitations, reports, listing/account suspensions, failures and quota usage.

## Gateway

Deploy `supabase/functions/beta-gateway/index.ts` with its `deno.json`:

```sh
supabase functions deploy beta-gateway --project-ref flczhwwlvfnkqmtxpkmq --no-verify-jwt
```

`verify_jwt=false` is deliberate: the gateway verifies real Auth users itself;
join/recovery require single-use random codes; workers require a secret **and**
per-job dispatch ticket; scheduled maintenance has a separate server token.
Database RPCs still verify membership, party identity, session validity and RLS.
Untrusted request bodies are bounded to 16 KB. Do not add unauthenticated admin
or testing actions.

## Render Free worker

1. Use the confirmed Render workspace. Deploy the reviewed branch of
   `https://github.com/mlvnpcrb/Fraggy` using `render.yaml`, or create a Docker web
   service with the same **free** plan/settings. No persistent disk or paid cron.
2. In the app's founder area configure the exact HTTPS `*.onrender.com` origin.
   Copy the generated token directly into Render's `FRAGGY_WORKER_TOKEN` secret.
   Set `FRAGGY_GATEWAY_URL` to
   `https://flczhwwlvfnkqmtxpkmq.supabase.co/functions/v1/beta-gateway`.
   An authenticated operator can perform the same `configure_worker` call with
   the founder's JWT. Do not place this token in a file committed to Git.
3. Build downloads and SHA-256-verifies the pinned 4.6 MB U2NetP model. Runtime
   never downloads it. The lean ONNX implementation retains U2NetP normalization
   and avoids importing optional matting stacks that exceeded Free's memory.
4. `/health` returns ready only after the model loads. `/jobs` accepts only
   authorized tickets. Originals/results use short-lived signed storage URLs;
   inference is serialized. Each lease receives a new immutable output path.
5. Render sleeps after inactivity. Measure its natural cold start; do not add
   keepalive traffic. The app displays waking/processing states. If a dispatch
   or lease is interrupted, retry resumes the saved original. It never silently
   substitutes that original for a PNG. Three-minute leases prevent a lost
   worker from holding jobs permanently.
6. Inspect structured `cutout_ready`/`cutout_failed` logs and database failed
   jobs. Logs contain job IDs, duration and memory only, never photos, addresses,
   signed URLs, passwords or tokens.

## Cleanup, quotas and monitoring

Supabase pg_cron runs `private.maintenance_tick()` daily at 19:15 UTC (03:15 PHT).
It invokes the gateway with the private maintenance token. Abandoned unsaved
jobs older than seven days lose their files and expire; unreferenced immutable
versions are also collected after seven days. Saved originals/cutouts and trade
snapshot references are retained. The founder can run the same cleanup manually.

Check `cron.job_run_details` **and** `net._http_response` for failures; a cron
SQL success alone does not prove the HTTP cleanup succeeded. A paused Supabase
project cannot process cleanup until resumed; run maintenance after resuming.
Do not use cron to ping Render.

Defaults enforced server-side: 20 members, 25 active bottles/member, 10 capture
creations and 10 inference attempts/member/day (UTC), 10 supplemental-photo
tickets/day, 500 KB originals and PNGs, 250 KB conditions, 100 KB avatars.
Storage admission serializes an 800 MB check with conservative pending-upload
reservations. Uploads stop before the limit; collection reads continue.
Founder administration displays storage and database size. Check dashboard usage
for the 1 GB Storage/500 MB database allowances and free Realtime/egress/function
limits. Respond to quota pressure by stopping invitations/uploads and cleaning
abandoned data, never by enabling a paid plan automatically.

## Hosted Expo Go preview

An operator must sign in to the intended Expo account and publish an Expo
Go-compatible SDK 58 preview through the current supported Expo publishing
workflow. Verify that workflow against current Expo documentation; do not
publish a development-build-only EAS update and label it an Expo Go preview.
Do not share Expo passwords/tokens in chat or Git. The session that implemented
this branch had no Expo credentials and could compile bundles but could not
claim publication or a working remote QR.

Record the published project/revision and actual QR/link in the release report.
Open it on physical iPhone and Android Expo Go, switch the developer's Mac off,
then capture/upload, wait through hosted removal, save, sign out/restart, and
restore from another device. If the current Expo Go publishing workflow cannot
serve this SDK independently, this release gate remains blocked; do not silently
replace it with a Metro tunnel or a paid/store build.

## Recovery and deletion

Founder-assisted recovery requires out-of-band identity verification. The
founder selects the correct member and issues a single-use recovery code. The
gateway changes that account's password and revokes other sessions. No email
delivery is assumed. For a locked-out sole founder, an authorized database
operator verifies identity and runs `public.operator_recovery(founder_uuid)`;
this function is not executable by mobile members or anonymous clients.

Account deletion blocks unresolved accepted/paused exchanges and a sole founder.
It anonymizes the profile, archives listings, removes membership and sign-in,
and clears structured address details. Historical messages/reviews/snapshots are
retained for participants and moderation; do not promise removal of text another
collector received. If Auth deletion fails after preparation, retrying the same
request is safe. Never delete profiles referenced by historical trades.

## Backup and rollback

- Keep a private pre-rollout database export, regular operator exports, and a
  separate export of Storage objects. Founder JSON export is a useful readable
  **application** backup, not a full Auth/private-schema/storage backup. It must
  never be published or attached to an issue. Use operator `pg_dump`/Supabase CLI
  for a recoverable full database export; Auth identities need their IDs intact.
- Restore a backup into an isolated database/project first. Compare counts,
  migration history, member identity links, object paths, private bucket/RLS,
  reservations and a two-party receipt test. Do not overwrite production with
  an untested dump.
- App rollback: publish the previous known-good **beta** revision with the same
  private RPC contract. Never roll back to the pre-beta public/demo app as a
  substitute for a functioning real collection.
- Worker rollback: redeploy the previous image/commit; retain private job state
  and token configuration. Interrupted leases expire and can be retried.
- Database rollback: prefer a forward corrective migration with uploads/new
  proposals temporarily disabled. Do not restore old public storage policies,
  drop trade history, or reverse ownership after completed exchanges. Restoring
  a pre-release backup is only for a coordinated outage with no later accepted
  user writes; otherwise reconcile all post-backup trades first.
- Rehearse backup/restore against the local isolated fixture DB and keep the
  command results in the verification report. Repeat with a private hosted
  export before the first invitation group.

## Local database checks

Create an isolated Postgres 17 container, database `fraggy_beta_test`, port
127.0.0.1:55432, credentials matching `scripts/test-beta-db.cjs` (test-only).
`npm run test:db` refuses hosted URLs/other DB names, recreates fixture schemas,
applies all migrations, and exercises privacy, quotas, immutable processing,
concurrent competing acceptances, mutual receipts, cancellation and disputes.
It is never a hosted deployment command.

## Codex / Antigravity handoff

Work on the PR branch; read the approved plan, this runbook and verification
report first. Run required checks. Inspect migration history before adding a
new migration; never edit an already-applied migration. Keep secrets server-side.
Record unresolved physical-device and publication gates honestly. Merge/release
only after five collectors pass the acceptance matrix, then expand to twenty.
