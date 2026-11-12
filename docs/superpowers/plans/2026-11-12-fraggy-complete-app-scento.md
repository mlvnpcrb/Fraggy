# Fraggy Complete App and Scento Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Complete Fraggy's collector journeys, adding Scento-assisted fragrance entry and a fully supported custom-entry path.

**Architecture:** Keep Expo SDK 58, React Navigation, Supabase, private media and the existing hosted cutout processor. Separate feature state and data access behind typed live/demo adapters. Catalog enrichment and cutout processing are independent: neither a missing catalog result nor a Scento outage may prevent custom entry.

**Tech Stack:** Existing React Native/TypeScript application, Supabase Postgres/Auth/Storage/Edge Functions, existing Python cutout service. Add TanStack Query v5 for scoped server-state caching, after checking SDK compatibility and pinning the chosen version in the lockfile.

**Spec:** Root `design.md`, `docs/private-beta-plan.md`, and the requirements and defaults below. This extends the earlier screen plan; it does not imply those screens already exist.

## Global constraints

- Preserve racing green, ivory, restrained lime, Manrope, continuous cabinet shelves and accessible touch targets from `design.md`.
- Preserve automatic background removal immediately after capture/selection. Never substitute a catalog image for a real captured bottle.
- No payments, paid service upgrades, international shipping or automatic fragrance recognition in this release.
- Both parties accept to reserve; only both receipt confirmations transfer ownership. Existing atomic server operations remain authoritative.
- Preserve native upload using Expo File and expo/fetch, account-scoped caches, private immutable image versions and worker leases.
- `admin/admin` accesses isolated labelled demo data; live authentication and founder authorization remain unchanged.

## Research and interpretation

Inspected 2026-11-12:

- https://www.scento.com/developers/perfume-api
- https://www.scento.com/api/perfume/v1/openapi.json
- https://www.scento.com/terms-of-service#perfume-api

Scento documents free read-only GET access with no key. Use `/search?q=...&kind=perfume&lang=en` and `/perfumes/{perfume}`. Lists use opaque continuation values. Profiles include note pyramids, family and concentration when available; null fields are valid. Catalog counts differ between documentation pages, so do not promise complete coverage.

The inspected OpenAPI does not document image upload recognition or bottle image fields. Interpret “base the picture on Scento” as pairing the collector's real photograph with a collector-confirmed catalog identity. Reference bottle images are deferred unless an official image API and reuse rights are verified. No scraping product pages or sending collector photographs to Scento.

Show linked attribution: “Fragrance details: Scento Perfume API, scento.com.” Preserve source URL and retrieval time. Cache requested answers reasonably; no wholesale catalog import or implied perfume-house endorsement. The public documentation publishes no fixed quota; Fraggy's own limits below are application defaults, not Scento guarantees.

## Review focus

1. Similar names, flankers and EDT/EDP variants must never be silently treated as the same fragrance.
2. Missing notes, an unavailable API or stale responses must not erase entered details or block custom save.
3. Restarting, switching accounts or replacing a cutout must preserve the correct draft without crossing account boundaries.
4. Catalog updates and collector edits must not silently change agreed trade snapshots.
5. Catalog metadata describes a fragrance, not bottle authenticity, fill level or condition.

## Product and screen decisions

- Four persistent tabs: Shelf, Discover, Trades, Profile. Capture is a separate prominent action above the tab bar.
- Shelf: named shelves, compact selector, local brand/name search, shared ledges, add position, accessible move/reorder controls and draft entry points.
- Capture flow: capture/select → save original locally → start cutout automatically → identify fragrance → inspect actual cutout → bottle details → save to selected shelf. Allow identification while processing, but saving requires a real ready cutout and inspection.
- Identification: show the user's image alongside text search. Search after 400 ms debounce and at least two characters. Show brand, name and available variant information, ten results per page, and an explicit “Use this fragrance” action.
- Always show “Add a custom fragrance.” Empty results say “No match found. Try another name or add it yourself.” Errors say “Scento is unavailable. Try again or enter details yourself.” Do not describe an outage as proof the fragrance does not exist.
- Matched entry prefills brand, name, concentration, family and supplied top/heart/base or unstructured notes. Do not infer a pyramid from a flat list or fabricate absent values. User reviews before applying; replacing a selection warns before replacing edited fragrance fields.
- Custom entry requires brand and fragrance name; concentration, family and notes are optional. A collector can change a match to custom or link a custom bottle later. Personal comments remain separate from fragrance notes.
- Bottle-specific size, remaining amount, condition, cap/box, trade availability and exchange methods are always collector-entered. Do not prefill them from catalog assumptions.
- Bottle detail shows real photography, condition, linked fragrance attribution or “Collector-entered details,” and a separate notes section. A catalog match never receives an authenticity badge.
- Wishlist: private saved catalog fragrances or custom brand/name entries. Show exact catalog-ID matches among available listings; custom entries use explicit text search rather than claiming exact equivalence. No new notification/push matching engine.
- Discover: bottle grid, search, filter sheet, active filters, listing detail, collector profile, proposal review and clear no-results states.
- Trades: conversation, shared next-step checklist, proposal/agreement/exchange/receipt/paused/completed views, manual shipping details, mutual cancellation, problems and reviews. Do not estimate a delivery date or auto-confirm receipt.
- Profile: privacy settings, “View as another collector” preview using actual viewer permissions, account settings, notification/activity inbox and support/report/block. Keep founder tools separate.
- Capture guidance: optional bottle outline and lighting tips. Cutout inspection offers ivory and dark backgrounds, zoom, retry and retake; failed processing retains the original.
- Activity center combines drafts, processing and actions needing attention, with links to their feature screens. Do not expose private chat or addresses through shared collection views.

## Interfaces and persistence

Create feature directories under `src/features/` for collection, capture, catalog, discovery, trades and account. Keep reusable visual components mode-independent. Adapt existing screens incrementally rather than replacing the backend.

Catalog service interfaces:

```ts
type CatalogRef = { provider: 'scento'; id: string; sourceUrl: string; fetchedAt: string };
type FragranceDetails = {
  brand: string; name: string; concentration: string | null;
  family: string | null; top: string[]; heart: string[]; base: string[];
  unstructuredNotes: string[];
};
type FragranceEntry = {
  source: 'scento' | 'custom'; reference: CatalogRef | null;
  details: FragranceDetails; overrides: Partial<FragranceDetails>;
};
searchFragrances(query: string, continuation?: string): Promise<CatalogSearchPage>;
getFragrance(id: string): Promise<CatalogFragrance>;
```

Define `CatalogSearchPage` as normalized perfume results plus nullable continuation; `CatalogFragrance` contains the validated reference/details. Keep provider payload parsing confined to the catalog adapter. Derive identity from the documented returned provider identifier or canonical detail link, never display-name slug guessing. Pin response fixtures during implementation before choosing the final extraction mapping.

- Add a versioned optional fragrance entry to BottleForm, saved drafts and bottle records; retain existing brand/name compatibility fields. Existing free-text `notes` remains personal comments and is not migrated into a scent pyramid.
- Preserve original provider details and user overrides separately; render overrides on top. Clearly label collector-modified fields. Changing identity to custom clears provider attribution; existing historic snapshots remain intact.
- Add private per-user wishlist records with RLS, catalog reference/custom identity and creation time; no public wishlist access in beta.
- Extend save/edit/finalize and trade snapshot operations with fragrance metadata. Relevant identity/notes edits follow existing proposal invalidation/version rules. Accepted snapshots are immutable and reserved bottles remain protected.
- Keep saved metadata as a snapshot: opening a bottle never automatically overwrites it with a newer provider answer. Explicit refresh offers a comparison before applying changes.
- Add versioned capture UI metadata: selected shelf, current step, fragrance entry and reviewed cutout path. Reprocessing invalidates only the cutout inspection acknowledgment. Read older drafts without dropping existing fields.
- Validate lengths and data shape server-side; derive attribution from allowlisted Scento hosts. Catalog cache is non-authoritative for bottle ownership and does not grant access to private collections.

## Implementation tasks

### Task 1: Feature boundaries and isolated data adapters

- [x] Add tests that demo mode never initializes live authentication or sends backend requests, including sign-out/account switching.
- [x] Introduce typed feature actions and live/demo adapters; move mode choice before live API imports. Preserve real saved sessions without loading them in demo mode.
- [x] Introduce account-scoped query keys and per-feature data hooks. Start by wrapping existing RPCs; do not split every backend endpoint in one change.
- [x] Replace unconditional whole-state eight-second polling with foreground refresh, relevant realtime invalidation and bounded active-job polling (5 seconds, backing off to 30 seconds). Stop timers in background. Retain visible reconnect/retry controls.
- [x] Verify TypeScript and existing session/cache tests; commit independently.

### Task 2: Catalog integration and versioned metadata

- [ ] Capture real search/profile response fixtures; test variants, pagination, null notes, malformed payload, timeout, throttling and stale-response cancellation.
- [x] Add authenticated `catalog-search` and `catalog-detail` gateway actions. Construct allowlisted upstream URLs; accept no arbitrary URL. Never forward JWTs, photos or collector identifiers upstream.
- [x] Cache searches for one hour and profiles for seven days; coalesce identical requests. Set a 10-second upstream timeout, limit each member to 30 lookups/minute, respect Retry-After and avoid automatic retry loops. Cached responses remain visibly usable when upstream fails.
- [x] Store bounded server-side cache entries with expiry and daily cleanup; cap at 1,000 entries, evicting oldest entries. Persist only requested records, not a mirrored catalog.
- [x] Generate versioned migrations with Supabase CLI for optional fragrance metadata, private wishlists and the private cache. Review grants/RLS and update snapshot/finalize/edit functions without deleting existing records.
- [x] Test old bottles/drafts, source preservation, custom entries, cross-member access denial and proposal/snapshot invariants; commit independently.

### Task 3: Complete capture and shelf journey

- [x] Test that capture saves its original before compression, starts removal without asking, resumes after restart and retains edits through catalog failure.
- [x] Build identification/search/custom entry, capture guidance, progress, cutout inspection, progressive bottle form and shelf placement using design.md.
- [x] Run catalog enrichment independently of processing. A successful catalog match cannot mark processing ready; a successful cutout cannot imply a confirmed fragrance identity.
- [x] Add shelf search, accessible arrangement and activity/draft links. Preserve original/cutout recovery and account-generation guards.
- [x] Verify native File upload regression tests, draft migration and idempotent finalization; commit independently.

### Task 4: Discovery, wishlist and trade journeys

- [x] Test that only trade-available permitted listings match wishlists; custom entries never silently merge with catalog identities.
- [x] Complete discovery/filter/detail/profile/proposal screens and add wishlist controls to catalog selection, bottle detail and Profile.
- [x] Complete trade checklist, chat, exchange, receipt, cancellation/problem and review screens using existing server actions.
- [x] Test two accounts, competing proposals, repeated taps, one/both receipts, blocking and disconnect/reconnect. No optimistic ownership transfer or offline receipt queue.
- [x] Commit independently after trade and privacy regressions pass.

### Task 5: Settings, operations and release verification

- [x] Complete privacy preview, settings, notification/activity states and founder tools without adding a permission bypass.
- [x] Separate connectivity, authentication, validation and processing errors; add plain-language recovery actions. Record sanitized job/action IDs, stage durations and failures without photos, addresses, tokens or signed URLs.
- [x] Update design.md and deployment/rollback documentation. Document Scento attribution, cache limits, feature-disable switch and custom-entry fallback.
- [x] Run TypeScript, existing Vitest/Python/database regressions and Expo exports. Test Playwright layouts at 360×800, 390×844 and 430×932, enlarged text and keyboard navigation.
- [ ] On physical iPhone and Android, verify actual capture/PNG, permissions, keyboard, assistive technology, restart, offline viewing and recovery. Verify a Mac-off published preview; browser mocks are insufficient.
- [ ] Pilot with five collectors before twenty. Target four of five completing capture/find/propose without coaching; all five understand demo status and both-party receipts. Publish only verified flows; document outstanding device checks honestly.

## Acceptance and rollout

- A catalog match populates supported details only after explicit selection and survives save/restart/another device.
- A fragrance missing from Scento, missing notes, a timeout or disabled integration still permits fully custom entry and real cutout save.
- Search selections distinguish variants, late responses cannot change a newer selection, and changing identity never silently overwrites personal comments.
- Saved bottles and accepted trade snapshots remain usable if Scento changes or disappears.
- Existing shelves remain private and existing records survive additive migrations. No anonymous/private-cache exposure and no demo/live leakage.
- Deploy additive backend compatibility first, then client updates. Disable catalog lookup independently if necessary; retain snapshots and custom entry. Roll back the client without dropping new columns or user records.
- Keep usage within established free-tier limits; no additional service or paid tier is authorized by this plan.

**Deferred:** photo-based fragrance recognition/OCR, catalog bottle-image replacement, public wishlists, automatic push matching, wear diaries, statistics and shelf themes.

## Execution status · 2026-11-12

Code and automated checks are implemented. Official Scento documentation examples substitute for live fixtures because this environment denies direct provider requests. Device, collector-pilot, backend deployment and new Expo publication gates remain pending. See [release notes](../../complete-app-release.md). A coordinated feature commit replaces the planned separate task commits because the shared navigator, context and compatible backend changes are reviewed together.
