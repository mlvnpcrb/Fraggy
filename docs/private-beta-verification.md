# Private beta verification — 2026-11-11

## Release status

**Not ready for invitations.** The implementation and reproducible local checks
exist, but hosted activation, a published Expo Go preview and physical-device
acceptance are separate gates. Do not describe compiled bundles or a local QR
as a working remote beta.

## Evidence

| Boundary | Check | Result |
|---|---|---|
| TypeScript app | `npm run typecheck` | Pass |
| Existing collection/trade/native upload regressions | `npm test` | 25 tests pass |
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

## Hosted activation gates

- Apply reviewed migration history and deploy the gateway to the existing
  `flczhwwlvfnkqmtxpkmq` project, preserving existing records; check advisories.
- Confirm the founder email, generate a bound bootstrap invite and join.
- Confirm the Render workspace, deploy the Free service, configure its worker
  token, then measure natural cold start and restarted-job recovery.
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
