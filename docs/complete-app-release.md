# Complete app and Scento integration

Implementation reference: [plan](superpowers/plans/2026-11-12-fraggy-complete-app-scento.md). UI authority: [design.md](../design.md). Existing beta limits and trade rules remain in force.

## What changed

- A mode gate opens the live app or an isolated, persistently labelled `admin/admin` demo. Live Auth modules initialize only after live mode is chosen. Demo state uses `fraggy.demo.v1`; demo photo selection uses a sample, never a user's substitute photograph.
- Capture preserves the original (native document file or browser IndexedDB bytes) before compression/upload and starts removal automatically. Identification, inspection and bottle details form a recoverable flow. A changed cutout requires fresh inspection.
- Scento search and profile lookup supply optional fragrance metadata, with explicit selection and attribution. Custom entry always remains available. No image recognition or catalog bottle-image API is assumed.
- Wishlist, activity, privacy preview, settings, support and proposal review routes connect the existing collection/trading operations. The shared cabinet retains one add position.
- Per-account feature queries replace whole-state eight-second polling. Realtime invalidates affected features; foreground/connectivity changes refresh data. Active capture jobs poll from five seconds up to thirty seconds. A sixty-second foreground reconciliation and tab/realtime reconnection refreshes catch permission-removal events that RLS can suppress.

## Code boundaries

Shared screens use `src/beta/context.tsx` and the lazy media runtime. `src/beta/api.ts` and live Provider remain live-only. Feature directories contain catalog contracts/UI, capture, account screens and trade review/guidance. Critical ownership/reservation/completion decisions stay in database functions.

Provider responses are normalized in `supabase/functions/_shared/catalog.ts`; the mobile UI never consumes raw provider folios. `catalogService.ts` enforces an official HTTPS upstream origin, ten-second timeout, bounded responses, shared request coalescing and cached fallback. Authentication/member admission and 30-lookups-per-minute limits run before catalog access.

The integration only caches requested entries: searches one hour, profiles seven days, maximum 1,000 records. Daily maintenance removes entries expired more than seven days ago. `SCENTO_ENABLED=false` on the Edge Function disables upstream lookup without disabling custom capture, saved snapshots or existing collections. No key is required by Scento's currently documented API.

## Deploy in this order

1. Run the local checks below. Review the additive `complete_app_catalog` migration. Export the existing hosted database before a production rollout; do not reset or seed the hosted project.
2. Apply the migration to the existing Fraggy Supabase project through the normal versioned migration process. It adds metadata, private wishlists/cache, feature reads and reviewed proposals; it preserves existing records and old RPCs.
3. Deploy `beta-gateway` with its two `_shared` dependencies. Preserve existing worker/maintenance secrets and its existing manual user/worker authorization. Do not change `verify_jwt` independently: this function authenticates different user and worker credential types inside the handler.
4. Check authenticated Scento search/detail using an invited test account, including a timeout/custom-entry fallback, and confirm unauthenticated lookup is rejected. Do not send collector photographs or personal information to Scento.
5. Publish the compatible Expo preview with `npm run beta:publish` only after physical device checks. The existing project publishing helper configures EAS; the Mac's Expo login is not available inside this workspace.

## Verification

```sh
npm ci --cache "$HOME/.npm-fraggy"
npm run typecheck
npm test
npm run test:db
npx expo export --platform web --output-dir /tmp/fraggy-complete-web
npm run test:browser
npx expo export --platform ios --platform android --output-dir /tmp/fraggy-complete-native
```

Database scripts only accept the isolated local `fraggy_beta_test` database on localhost; they reset its schemas. Never point them at production. Browser scripts serve a local export and use system Chromium (`/usr/bin/chromium`, configurable for the complete-flow script). Live browser smoke mocks Auth/database responses; the separate demo smoke asserts there are no Supabase/Scento requests. Neither verifies hosted/native integration.

Processor tests: run `python -m pytest server -q` in the project's Python environment with the pinned model available. No processor implementation changed in this release.

Required release gates still include physical iPhone/Android actual photography and PNG quality; VoiceOver/TalkBack, keyboard/permissions/reduced motion; natural processor cold start/recovery; a Mac-off Expo preview; real two-account local/shipped exchanges; and five collector sessions before expansion to twenty. Browser enlarged-text checks are layout stress tests, not proof of native Dynamic Type behavior.

Direct Scento requests from this cloud workspace were denied by its outbound network policy. Parser tests use the official documentation's example response shape. Do not describe these as captured live API fixtures or as proof of current API availability.

## Rollback

Disable catalog lookup using `SCENTO_ENABLED=false` if the provider changes. Preserve saved metadata, wishlist records and custom entry. The previous Edge Function remains compatible with the additive schema; restore its previous deployment if necessary. Roll back the mobile update through the existing Expo publishing workflow. Do not drop new columns/tables or delete member records to roll back a client.

A future incompatible metadata format must use an explicit schema migration and draft reader upgrade. Existing free-text condition/personal notes must never be reinterpreted as fragrance note pyramids. Provider details and collector overrides remain separate, and accepted trade snapshots never update when the catalog changes.

## Current deployment status

The code and migration are prepared locally. The hosted `apply_migration` tool returned an expired confirmation on 2026-11-12; this update was not applied. The corresponding gateway deployment and new Expo publication remain pending. Deploy the database and matching gateway before testing this client in live mode; the isolated demo runs locally without them.
