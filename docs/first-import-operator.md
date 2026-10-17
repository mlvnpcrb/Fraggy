# First real import: outside Render, attended only

Do not execute a live import until the owner supplies approved product URLs and
source-specific permission details (permitted fields, use and access method).
Previously asserted authorization is not a substitute for this task's URL approval
requirement. No URLs have been approved for this release; real imports remain zero.
No Render worker/cron/service or unattended daily scrape is involved.

Use a durable Linux/macOS operator workstation or an explicitly approved staging
machine with permitted outbound HTTPS to the source and PostgreSQL TCP 5432 to
Supabase. A local virtual environment works independently of Codex or Docker:

```bash
cd /path/to/FraggyAPI
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
umask 077
mkdir -p "$HOME/fraggy-ops/backups" "$HOME/fraggy-ops/receipts"
# Enter the owner SQLAlchemy database URL securely; never paste into command history.
read -r -s -p 'Operator DATABASE_URL: ' DATABASE_URL; echo
export DATABASE_URL
export DATABASE_AUTO_MIGRATE=false
export SCRAPING_APPROVED_SOURCES=''
export LIVE_VALIDATED_SOURCES=''
export SYNC_LOCK_PATH="$HOME/fraggy-ops/import.lock"
export SCRAPE_DELAY_SECONDS=20
```

The URL must use the **owner** role and verified TLS, with the operator's local CA
path. The Render web uses the separate **reader** role on the same database. Keep
both scraping gates empty on both hosts. Use a meaningful SCRAPER_USER_AGENT with
an approved contact if required by the source. Do not impersonate browsers.

1. Stop other operator writes/imports. Only one importer across all hosts is allowed;
   flock coordinates this host, not a distributed PostgreSQL fleet.
2. Complete the migration and grant checks in supabase-free.md. Create a **fresh**
   confirmed backup with archive inventory, secondary copy and a successful restore
   drill per database-backup.md. Keep its hash and drill details in the operator log.

```bash
.venv/bin/python -m scripts.backup_postgres --output "$HOME/fraggy-ops/backups/pre-import-UNIQUE.dump"
```

3. Write 1–10 **approved absolute HTTPS product URLs** from one source into
   `inputs/first-import.urls`. No placeholders, discovery URL, query string or
   credentials. Blank lines and comments are permitted. Do not commit the list.
4. Check outbound HTTPS without bypasses using the existing diagnostic. Choose only
   the approved source key (run `--help` for options):

```bash
.venv/bin/python -m scripts.check_sources --help
.venv/bin/python -m scripts.check_sources --source fragrantica
```

   The CLI below also enforces robots.txt, per-source delay, verified HTTPS and
   stop conditions for CAPTCHA/challenge/403/429. Do not retry through proxy rotation,
   fake credentials, insecure TLS or robots bypasses. A diagnostic success alone
   does not validate product parsing. Observe source restrictions and permission.
5. With permission/reference and URLs now approved, execute **one attended command**
   below, replacing source, actor/reference, URL and UNIQUE. The PostgreSQL backup
   flag is an operator attestation, not an automatic backup check: only pass it
   after steps 1–2 have actually succeeded.

```bash
.venv/bin/python -m fraggy.first_import \
  --source fragrantica \
  --urls-file inputs/first-import.urls \
  --limit 10 \
  --authorized \
  --operator 'APPROVED-OPERATOR' \
  --permission-reference 'APPROVED-NONSECRET-AGREEMENT-REFERENCE' \
  --api-base-url 'https://YOUR-SERVICE.onrender.com' \
  --database-backup-confirmed \
  --report "$HOME/fraggy-ops/receipts/first-import-UNIQUE.json"
```

The existing CLI handles up to 10 explicit URLs only, without discovery or a scheduler.
API health must be warm and healthy first; the CLI's individual API timeout is 30s,
so wait for Render's cold start using the 90s health command before starting import.
Exit nonzero means the operation was not fully verified; committed records may still
exist. Never assume a failure means the database was untouched.

Read the durable JSON receipt even on failure: committed sync.record_ids, verified
records and shelf canonical references, job retry/error classes, successful HTTP
observations and hashes, sanitized failure information. Copy it to encrypted backup
storage. The backup receipt and first-import receipt are separate artifacts; record
both hashes in the same operator log. Don't use var/ on Render for either.

Compare each real source page manually against imported name, brand, concentration,
year, notes, perfumer and ratings before declaring the adapter live validated. The
CLI deliberately leaves live_source_validation=not_established_by_this_check. Technical
API verification does not certify complete extraction, data rights or source quality.
Seven generic adapters remain experimental. Missing fields must preserve prior data.
Images/reviews aren't downloaded; do not copy them without specific permission.

Repeat synchronization with the same approved URLs and a new backup and receipt
filename. Verify original source IDs, canonical IDs and total counts stay stable,
with no duplicates; changing observed content can legitimately update timestamps.
Do not reset terminal jobs or ignore Retry-After solely to force a successful report.
Report committed real imports and fully verified records separately from failures;
synthetic test fixtures must always be excluded. Keep both unattended gates empty
even after a successful attended import. This release authorizes no scheduling.
