# Private beta verification — 2026-11-12 (Philippine time)

## Release status

**Not ready for invitations.** The implementation and reproducible local checks
exist, but a published Expo Go preview and physical-device
acceptance are separate gates. Do not describe compiled bundles or a local QR
as a working remote beta.

## Evidence

| Boundary | Check | Result |
|---|---|---|
| TypeScript app | `npm run typecheck` | Pass |
| Collection/trade/native upload and session isolation regressions | `npm test` | 30 tests pass, including failed-network sign-out and account switches during captures |
| Real PostgreSQL 17 | `npm run test:db` | All migrations apply; RLS, private media, denied direct ownership writes, dual receipts, repeat finalization/receipts, cancellation, dispatch, dispute locks, blocked existing chat, invitation claims, output leases, expiry and upload limits pass |
| Concurrent trade offers | Two independent DB connections accept competing offers | Exactly one acceptance succeeds; shared bottle belongs to one reservation |
| Python API/model/hosted worker | `python -m pytest server -q` with pinned model | 11 tests pass, including real inference, transparent PNG, corrupt input, authorized jobs and serial inference |
| Render image | `docker build -f server/Dockerfile -t fraggy-worker-beta .` | Builds with checksum-verified model included |
| Free memory envelope | `bash scripts/test-worker-memory.sh` | 512 MB container, swap/network disabled; three real runs, peak ~380 MB, output ~25 KB PNG; model load ~0.12 s, fixture inference ~0.7 s locally |
| Edge runtime types | Deno `check` on gateway | Pass |
| Mobile/web compilation | `expo export --platform all` | iOS Hermes, Android Hermes and web bundles exported |
| Browser screens | `npm run test:browser` after export | Mocked API smoke passes auth, cabinet rendering, named shelf, discovery/proposal navigation and receipt guard; no page errors |
| Backup/restore rehearsal | Local `pg_dump -Fc` and `pg_restore` to isolated restore DB | 7 trades, 12 public policies, private bucket, one completed trade with two receipts preserved |
| Expo identity | `npx expo whoami` | Not logged in; publication unavailable in this session |

The initial rembg import stack peaked at ~546 MB. A regression test then failed
with a 450 MB headroom target. Retaining U2NetP while removing optional matting
imports and disabling ONNX CPU memory arenas brought the repeated check below
that target. This is local memory evidence, **not a measurement of Render's
sleep/wake latency or final photographic quality**.

The browser test intercepts its fixture API intentionally. It does not prove
deployed Auth/Storage/Realtime integration. The database tests use actual SQL
roles/RLS/RPCs on isolated Postgres, not mocked state transitions. Production
signed-in flows never use those fixtures.

## Hosted deployment evidence

- Supabase: all nine migrations applied to `flczhwwlvfnkqmtxpkmq`; local filenames
  now match the actual hosted migration versions. Baseline adoption discovered
  an existing index and a statistics view missing from the initial development
  reproduction; a corrective adoption migration preserves both, and the test
  harness now reproduces the index collision before applying the fix.
- `beta-gateway` version 1 is ACTIVE. A real unauthenticated capture request
  returned HTTP 401. The scheduled-maintenance request returned HTTP 200 with
  zero abandoned captures/orphans, proving the HTTP path as well as the cron SQL.
- Storage: `cutouts` is private; anonymous bottle SELECT is denied; the only
  Storage objects policy is the authenticated `beta_media_read` ownership/
  sharing/trade check. Server-only private tables intentionally have no client
  policies. Authenticated SECURITY DEFINER advisor notices are intentional
  reviewed RPC entry points with membership/party/admin checks; anonymous
  privileged-function and mutable-search-path warnings are cleared.
- Live database verification used temporary accounts **inside a rolled-back
  transaction**: member `beta_state`, private-bottle denial, mutual reservation,
  one receipt retaining ownership, and idempotent dual-receipt transfer passed.
  No sample collectors or bottles were left in the hosted database.
- Render: Free Singapore service `srv-dbqc5quc6qcc73esunig`; deploy
  `dep-dbqc5rmc6qcc73esuqag` is LIVE at commit `107af11`. Real `/health` returned
  HTTP 200, `ready`, model `u2netp`; an unsigned `/jobs` request returned HTTP 403. The initial deploy took about 68 seconds;
  application startup/model loading about 1.1 seconds. This is **not** a natural
  post-sleep wake measurement. Render reported about 76 MB idle memory against
  its 512 MB limit; local repeated inference peaked near 380 MB.
- The worker token is configured only on Render and as a database hash; it was
  not written to source. A founder invitation is bound to the confirmed email
  `mlvnpcrb@gmail.com`; the code is delivered privately, never committed.
- Independent review findings were fixed with targeted regressions for atomic
  cleanup, old-ticket adoption, server-only capture recovery, sign-out, account
  boundaries, paused-offer expiry/deletion rights, storage reservations and
  unarchiving quotas. Completed-trade reporting also has a regression.

## Remaining activation gates

- Join using the founder invitation and create a password in the app.
- Measure natural Render sleep/wake, real hosted photo upload/inference and
  interrupted-job recovery through the mobile client. Local inference, live
  service readiness and database protocol tests are different evidence.
- Configure/publish with the intended Expo account. Verify its actual Expo Go
  QR/link on phones with the developer's Mac off. No Expo token/password in Git.
- Exercise scheduled cleanup through HTTP and verify a private hosted database
  and storage backup/restore before first invitations.

## Physical-device acceptance matrix

Record device/OS/Expo Go version, revision, date and result for each row:

| Scenario | iPhone | Android |
|---|---|---|
| Camera and library permissions, capture/selection starts removal immediately | Pending | Pending |
| Real clear, dark and transparent fragrance bottles; quality check/retry/retake | Pending | Pending |
| Hosted cold start, worker restart, reopen unfinished capture | Pending | Pending |
| Real PNG save, sign-out/restart, second-device restoration | Pending | Pending |
| Offline cached shelf, reconnect pending upload | Pending | Pending |
| Keyboard, large text, scrolling and actual receipt confirmation controls | Pending | Pending |
| Two real accounts: meetup and shipped exchange, private address/tracking/chat | Pending | Pending |
| Single receipt/repeated taps, competing offers, cancellation/dispute/block | Pending | Pending |
| Notifications/realtime/disconnected and reconnected chat | Pending | Pending |
| Anonymous and another member cannot fetch private shelf/photo | Pending | Pending |

Start with five invited collectors only after these gates pass, record failures
and fixes, then increase to twenty. No payments, international shipping, push
notifications, social feeds, fragrance recognition or paid/store distribution
are part of this release.

## Deferred minor

The fragrance-name input currently allows 100 characters while the server
permits 80. The server safely rejects overlong names. Align the input limit
before the first five-person invitation group.
