> Render/Supabase target: see [render-supabase-verification.md](render-supabase-verification.md)
> and [first-import-operator.md](first-import-operator.md). No live import was run
> in this phase; approved URLs and permission details are required before one.

# Extraction integrity and canonical catalog

## Field observations

Source `data` retains its existing schema and legacy API payloads. A separate `extraction` JSON column records, per field:

| State | Meaning | Refresh behavior |
| --- | --- | --- |
| `missing` | No usable evidence was found, or the parser does not support this field | Preserve previous value |
| `uncertain` | Present but malformed, ambiguous, or not confidently parsed | Preserve previous value |
| `empty` | Source explicitly supplies a known empty value, such as JSON-LD `offers: []` | Accept the explicit empty value |
| `extracted` | Successfully parsed value | Accept the value |

Each observation records `observed_at` and, when known, `last_success_at`. Missing/uncertain observations do not erase the latter. Legacy data has no retrospective extraction evidence: its metadata starts as `{}` and its values stay intact. New rows retain null/empty-array placeholders so existing response shapes remain compatible; metadata distinguishes these placeholders from observed emptiness. For HTML, an absent note selector or empty/loading note container never establishes an explicit empty value. Plain dictionary observations default conservatively: nulls, empty strings and empty lists count as missing unless the parser explicitly marks them empty.

Offer refreshes preserve missing subfields when an offer can be matched by SKU/URL (or an unambiguous single-offer page). Unidentified multi-offer changes cannot be reconciled safely across variants; they remain source data, not canonical identity evidence. Malformed numeric fields and complete parser failures preserve stored values. Successful partial checks advance `last_checked_at`, but unchanged accepted data leaves `updated_at` alone. Complete parser failures change neither source timestamps nor canonical membership.

## Canonical identities

`perfumes` remains the original source-record table. New tables are `canonical_perfumes`, `canonical_links`, `match_reviews`, and `match_events`. Existing source IDs/URLs, ratings/scales, data and timestamps are not rewritten by canonical matching. One source record has at most one active canonical membership. Empty historical canonical entities remain for audit/reversal and are excluded from canonical search when no records link to them.

The version-1 normalizer case-folds, removes combining accents, normalizes punctuation/spacing, strips a full brand prefix/suffix from the perfume name, and recognizes concentration labels in explicit fields or names. Flanker words such as Intense remain in the normalized name. EDT, EDP, Parfum, Extrait, Elixir, and EDC stay distinct; compound labels are separate. Conflicting explicit/title concentrations are uncertain. Release years must be valid integers between 1700 and 2200.

Only an exact **complete** normalized brand/name/concentration/year fingerprint shares a canonical entity automatically. Unknown concentration/year is never a wildcard. Partial or conflicting identity gets a source-specific provisional entity; compatible same-brand/name candidates produce a review suggestion. Known concentration/year mismatches are excluded from automatic matching and rejected by manual link operations. This prioritizes avoiding false merges over deduplicating every fragrance. Brand aliases, transliteration, fuzzy name matching and reformulation modeling are not implemented.

Scores are deterministic rule scores, not calibrated probabilities: exact full identities score 1.0; provisional isolation scores 0; candidate suggestions use name/brand agreement plus available concentration/year evidence and remain below 1.0. Manual decisions score 1.0 to indicate operator approval, not source certainty. Original ratings never enter identity scoring.

Repeated matching of the same inputs reuses canonical fingerprints, reviews and memberships without duplicate decisions. Incoming identity corrections can move an automatic link, with an audit event. Manual links/unlinks are locked against ordinary automatic reassignment. If later source evidence conflicts with a locked concentration/year, matching detaches the record and queues a zero-confidence review. Correct the source identity through a supported import/parser change before approving that candidate.

## Operator review and reversal

These are local operator commands; there are no public mutation endpoints. Stop a running worker before invoking them: they share its filesystem lock. All changes use database transactions. Back up the database before upgrading or bulk review work.

```sh
# Populate canonical entities for pre-existing source records; safe to repeat.
python -m fraggy.catalog match
# List pending suggestions with source record IDs, candidate IDs and rule scores.
python -m fraggy.catalog reviews
python -m fraggy.catalog reviews --status rejected
# Review against source evidence, then accept or reject.
python -m fraggy.catalog accept REVIEW_ID --actor your-name --reason 'Verified concentration and year'
python -m fraggy.catalog reject REVIEW_ID --actor your-name --reason 'Different release'
# Explicitly link a checked source record, or keep it unlinked against rematching.
python -m fraggy.catalog link RECORD_ID CANONICAL_ID --actor your-name --reason 'Verified bottle identity'
python -m fraggy.catalog unlink RECORD_ID --actor your-name --reason 'Incorrect association'
# Mutation commands print an event ID. Reverse that event when needed.
python -m fraggy.catalog undo EVENT_ID --actor your-name --reason 'Reversing mistaken decision'
```

Events retain before/after membership snapshots, actor/reason, timestamps and associated review-status changes. Undo restores the exact earlier membership and review status without deleting source data. A later membership change, changed review, conflicting current concentration/year, or already-undone event blocks unsafe reversal. Undo newer decisions first. Undoing an automatic decision does not blacklist its fingerprint: the next matching pass may recreate it; use a manual unlink to persistently suppress an association. Historical provisional entities and audit rows are retained rather than destructively merged or deleted.

## Migration and API compatibility

Startup applies additive migrations only: legacy source labels/IDs retain the previous migration behavior, extraction metadata defaults to `{}`, and new canonical tables are created separately. Backfilling canonical memberships is an explicit CLI operation; new successful syncs do it in the same transaction as source saving. SQLite upgrades from both the original single-source schema and the previous multi-source schema are tested, including repeated startup, preserved IDs/data/timestamps, and repeat matching. PostgreSQL 16 legacy migration, repeated fixture import, ID generation, matching and API paths are integration-tested in an isolated socket-only container. Provider-specific authentication/TLS remains unverified. Initialize once before launching multiple services and retain a backup for rollback; old application versions can ignore the added tables/column.

The default `/v1/perfumes`, detail, brand, health and source/status contracts stay source-specific. Optional `canonical=true` changes the requested result entity type, not the default. Canonical results have name/brand/concentration/year/provisional state and associated source count; they deliberately have no aggregate rating. Fetch `/v1/canonical-perfumes/{id}/sources` to retrieve all associated source records (with pagination) and their separate ratings/scales, IDs, URLs and timestamps. `/v1/perfumes/{id}/extraction` exposes observation evidence separately. Canonical searching uses normalized names/brands; source searching retains its original behavior.

## PWA selection and stable references

`GET /v1/canonical-perfumes/{id}` now retrieves a retained canonical entity even if no records remain linked. Its `selection.canonical_id` is the stable UUID to store in a shelf; `requires_review` and `eligible_for_trading` reflect current active/provisional status. Attribution includes source-record IDs, source keys, original IDs and URLs. The entity has no aggregate rating.

Information corrections can change which canonical group a source belongs to. Historical canonical entities/UUIDs are retained, not silently redirected to a different concentration or year. A saved historical selection can become inactive and require user/operator review. Shelf/trade ownership and authenticated transaction APIs belong to the Fraggy app; no public mutations or unsafe automatic trade execution have been added. A trade service must revalidate identity in its own transaction instead of trusting a cached read.

## Brand normalization and explicit aliases

Brand normalization now treats ampersand and the word `and` consistently, in addition to Unicode accent, case and spacing normalization. Other semantic aliases require an operator decision:

```sh
python -m fraggy.catalog brand-alias 'D&G' 'Dolce and Gabbana' --actor your-name --reason 'Verified designer identity'
python -m fraggy.catalog match
# To undo the alias, append a self-mapping; previous decisions remain in history:
python -m fraggy.catalog brand-alias 'D&G' 'D&G' --actor your-name --reason 'Reverse alias'
```

`brand_aliases` is an append-only audit table; the latest mapping is effective. Repeating the same decision is idempotent. Cycles are rejected, chains are bounded, aliases change no source brand strings, and subsequent matching records any membership changes in its existing audit history. Manual association locks and concentration/year safeguards remain effective. Canonical search resolves explicit brand filters through these aliases.

## Read/search and scheduler readiness

Additive SQLite trigram indexes/triggers accelerate candidate selection while preserving existing literal LIKE semantics. Indexes backfill once and follow subsequent name/brand changes. Short queries and unsupported SQLite versions use the original predicate. No large production-catalog performance claim is made from small fixtures. Canonical source counts use a single grouped query.

GET caching and per-process socket-client rate limits are documented in README.md. Status and extraction evidence are uncached. A deployment gateway must provide shared limits for multiple processes or hosts. The 55-test suite includes literal punctuation/Unicode search compatibility, cache expiry/ETags, credential bypass, rate errors, retained canonical IDs and cross-process locks.

PostgreSQL 16 integration is now verified for legacy migration, ID-sequence initialization, repeated synthetic imports, canonical matching and API responses. It does not prove live source access. Additive migrations include the alias audit table and SQLite indexes. Scheduled worker startup is explicitly gated and opt-in; no unattended scraping was enabled.

## Portable attended import

The exported backend now provides `python -m fraggy.first_import` for an explicitly authorized, attended batch of at most ten product URLs. It reuses the existing queue/extraction/matching pipeline, adds no schema migrations and preserves unrelated jobs, records and review decisions. It checks source detail, canonical search, attribution and active shelf references against the actual API, then writes a receipt. A partial failure keeps committed IDs visible in that receipt.

Current portable test suite: 73 passing tests, including all 55 original tests unchanged. Source pages used in offline/Docker integration are synthetic. The host's one real-source attempt remains proxy-blocked with zero imported records. See [external-staging.md](external-staging.md) for the current workflow, environment variables and remaining live-validation requirements. Historical Codex-specific setup paths elsewhere in these documents are not runtime dependencies.
