# Migration inventory

Fraggy's existing migrations are implemented inline in `fraggy/db.py`, in `database()`, together with the retained SQLAlchemy models. There was no separate SQL migration directory in the original 55-test export; none is required or silently omitted from this bundle.

The implementation and schema are unchanged in the portable first-import iteration. It preserves:

- Legacy source labeling and original source-ID backfill.
- Extraction-evidence column addition without rewriting accepted values.
- PostgreSQL legacy ID-sequence initialization.
- Separate canonical, membership, review and match-audit tables.
- Append-only brand-alias decisions.
- Unique source identity indexes and existing SQLite pragmas.

`fraggy/search.py` retains additive SQLite FTS5 trigram tables/triggers and its fallback. `tests/test_multisource.py`, `tests/test_integrity_catalog.py`, and `scripts/validate_postgres.py` exercise legacy upgrades and repeated startup. Existing source API payloads and source-specific ratings remain intact.

The new first-import workflow adds no database columns or schema migrations. It backs up an existing SQLite database before initialization/import. For PostgreSQL it requires an operator-confirmed provider backup or equivalent snapshot. A receipt is stored as JSON outside the database. Never run migrations concurrently for the first initialization; back up before upgrading a populated database.
