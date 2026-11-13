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
5. Publish the compatible Expo preview with `npm run beta:publish` for physical device verification; complete those checks before inviting beta collectors. The existing project publishing helper configures EAS; the Mac's Expo login is not available inside this workspace.

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

The hosted `complete_app_catalog` migration was applied successfully on 2026-11-12 UTC (version `20261112163422`). The matching `beta-gateway`, including both shared catalog modules, is ACTIVE at version 2. Hosted checks confirm the fragrance column, wishlist RLS with an authenticated owner-only SELECT policy, anonymous catalog denial, and member catalog admission. The existing Render Free processor deployment remains live; its Python implementation did not change.

The owner successfully published the baseline client at commit `c5d7ad4` to Expo group [47d7f965-4d1b-45a5-89a8-bef51942b866](https://expo.dev/accounts/mlvnpcrb/projects/fraggy/updates/47d7f965-4d1b-45a5-89a8-bef51942b866), runtime `exposdk:58.0.0`, for iOS and Android. This is publication evidence, not a physical-device pass.

The later public social redesign is described in [social-experience.md](social-experience.md). Its schema is deployed (`20261113002555`), but the social client requires a new Expo publication. This workspace is not signed in to Expo; use the already authenticated Mac:

```sh
cd ~/Downloads/fraggy-beta
git pull --ff-only origin feat/private-beta
npm ci --cache "$HOME/.npm-fraggy"
npm run beta:publish
```

Do not restore the old stashed package files over this configuration. Open the new update link printed by Expo and test its Expo Go QR on physical phones. Existing published updates still contain older client code. Authenticated hosted catalog/capture and real two-party trades remain device acceptance checks, not claimed passes.

Deployment verification: 61 automated tests, TypeScript checks, local database suites, and Web/iOS/Android exports passed. The hosted security advisor reports private tables with RLS and no client policies (intentional default denial), and authenticated SECURITY DEFINER RPCs (intentional guarded operations, requiring continued authorization tests). These advisories are not a blanket security certification. See [RLS advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [RPC advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

For future deployments, `npm run beta:deploy` provides an optional interactive backend-and-preview workflow. It requires CLI access to the existing Supabase project, rejects unexpected pending migrations, stops on backend or service verification failures, and writes a credential-free local deployment report. It never creates services or enables paid plans.

## Live Scento verification

### Optional Scento MCP connection for Codex

The project's `.codex/config.toml` registers the official `https://www.scento.com/mcp` Streamable HTTP server without authentication. A trusted local Codex project can load it after reopening/restarting the project's Codex session. Alternatively, register the same URL through Settings → MCP servers → Add server, with Streamable HTTP and no authentication. This only prepares the developer-tool connection; verify that Scento's tools actually appear and respond before calling it connected. Hosted sessions may not load local project MCP settings.

MCP lets the coding assistant consult Scento. Fraggy's mobile catalog integration continues to use the REST API through its authenticated gateway; adding MCP does not deploy that gateway or establish a live mobile API pass.

Run `npm run test:scento:live` on Node 22.14 or later with curl available. This uses Fraggy's actual shared catalog service and parser against the official REST API, with no API key or personal photographs. It checks Layton and Oud Wood search/detail identity, usable notes and an unknown-fragrance search. It normally makes five requests on a successful run (up to nine when matching needs additional pages) and writes timestamped status/latency evidence to the git-ignored `artifacts/scento-live-verification.json`. It exits nonzero on network failures, unexpected shapes or missing expected notes.

The verifier has independent fixture tests; passing those is not a live pass. A live upstream pass also does not establish authenticated gateway deployment or physical-device behavior. The current cloud run fails before reaching Scento: the supplied proxy returns CONNECT 403 for `www.scento.com`. The available environment tools can inspect but cannot change the allowlist. The task environment's allowed domains need that host before an in-workspace live pass is possible.

### Live response investigation · 2026-11-12

The user successfully fetched Layton search and profile JSON on their Mac. Field subsets are preserved in `src/features/catalog/fixtures/` with provenance. These responses confirm public search and the name-based Layton profile route return the expected fragrance and ten pyramid notes. They do not yet establish the entire five-request verifier, the authenticated gateway, or phone behavior.

Fraggy now keeps the website reference ID separate from the API lookup value: detail requests use the provider-returned perfume name, as supported by Scento's OpenAPI, instead of assuming the website SEO slug is an API alias. The returned reference ID, name and house must match the collector's selection, including when a response is cached or shared by concurrent requests. A different fragrance is rejected with custom entry available. The CLI prints each verification stage and reports unsupported reference paths to make any remaining live mismatch identifiable.

### Mixed search results · 2026-11-12

The user's next Mac verification completed Layton and then rejected `/brand/montale` while parsing Oud Wood search. Search normalization now excludes individual unusable reference rows, keeps valid perfume links and opaque pagination, and reports an omitted-result count. An all-unusable final page is an error, not a false claim that the fragrance does not exist. An all-unusable page with continuation can still lead to subsequent valid pages. Full profiles retain strict official-host and selected-identity validation. The synthetic regression includes the reported brand path; it is not represented as a complete captured Oud Wood response.

The live verifier follows at most three pages per known fragrance and requires the expected house as well as the name. The subsequent Mac run completed both known fragrance profiles, then showed that the unknown-query search returns suggestions. That observation supersedes the original empty-result assumption.

### Search suggestions verification · 2026-11-13

The user's Mac run reached the final unknown-query check after successfully validating Layton and Tom Ford Oud Wood profiles and notes. The previous verifier incorrectly required zero results for an arbitrary unknown query. Scento can return fuzzy suggestions, so verification now reports either empty results or the suggestion count, and checks that the unknown query was not an exact fragrance-name match. The app labels results as suggestions and retains explicit profile review and selection; a suggestion never automatically fills the bottle form. The subsequent user-provided Mac run passed the corrected full verifier; see the acceptance record below. The gateway is now deployed; authenticated end-to-end requests and physical-phone checks remain separate pending gates.

### Live provider acceptance record · received 2026-11-13

The user supplied terminal output from `npm run test:scento:live` after updating their Mac checkout to `a87ed12`. All live provider/shared-adapter checks passed:

- Parfums de Marly Layton: search identity and full profile matched, with 10 usable notes.
- Tom Ford Oud Wood: search identity and full profile matched, with 6 usable notes. Two search entries without usable fragrance links were excluded.
- Unknown query: returned 2 suggestions and no exact fragrance-name match. Suggestions were not treated as an exact identification.

The Mac generated `artifacts/scento-live-verification.json`; the report file remains on that Mac and was not independently downloaded into this workspace. The terminal output establishes the upstream checks above. It does not establish authenticated Fraggy gateway deployment, capture/notes persistence on a phone, or Expo publication. Those gates remain pending. No additional upstream rerun is required merely to repeat this successful evidence.
