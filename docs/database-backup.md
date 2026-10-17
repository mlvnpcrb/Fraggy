# Operator backups and restore

Use a durable operator disk, never Render's ephemeral filesystem. Protect backups
as sensitive data (private directory, mode 0600 files, encrypted disk and a second
encrypted offline copy). Never commit them. Free-tier managed backups are not assumed.
These are **public-schema** backups, not complete Supabase Auth/Storage/roles backups.
Use a dedicated project so that public-schema restoration cannot affect another app.

Install pg_dump and pg_restore matching the server major version or a compatible newer
client. Set DATABASE_URL securely to the owner session-pooler URI with verified TLS.
No password should appear in a command-line argument, shell history or receipt.
Before migrations/imports stop other writers, select a unique path, then:

```bash
umask 077
mkdir -p "$HOME/fraggy-ops/backups" "$HOME/fraggy-ops/receipts"
.venv/bin/python -m scripts.backup_postgres --output "$HOME/fraggy-ops/backups/pre-import-UNIQUE.dump"
pg_restore --list "$HOME/fraggy-ops/backups/pre-import-UNIQUE.dump"
```

The helper creates a custom archive plus `.dump.json` containing its SHA256, size,
UTC completion time and archive-inventory verification. Failed/truncated archives are
not confirmed; preserve diagnostics securely and use a new filename when retrying.
The helper refuses overwrites. An inventory check is not a successful restore test.
Compare the SHA256 after copying to secondary storage; keep the receipt with the dump.

## Restore drill before an import

Use an empty disposable database/project with the same PostgreSQL major and compatible
extensions, explicitly **Free** only. Creating an extra free project depends on current
project quotas; use a local throwaway PostgreSQL instance if unavailable. Never restore
a test over the live catalog. Configure native libpq PGHOST, PGPORT, PGUSER, PGDATABASE,
PGSSLMODE=verify-full and PGSSLROOTCERT (use a private mode-0600 pgpass file for password).
Do not use the SQLAlchemy +psycopg scheme with native PostgreSQL tools.

```bash
pg_restore --exit-on-error --single-transaction --no-owner --no-acl \
  --dbname="$PGDATABASE" "$HOME/fraggy-ops/backups/pre-import-UNIQUE.dump"
```

Set the Python DATABASE_URL to the restored database; run the read-only connectivity
check and API from supabase-free.md, compare source/canonical counts, IDs, provenance,
timestamps and shelf selections against the original snapshot. Record successful drill
time and file hash in a private operator log; this task has not executed a Supabase drill.

For an actual recovery obtain separate approval, stop all writers, restore into a new
empty replacement, reapply reader grants and verify before switching the web's database
secret. Avoid `--clean` against a populated project. Role passwords/grants are maintained
separately and aren't in no-owner/no-acl archives. Retain the original database and
backup until recovery is accepted. There is no automatic restore or destructive endpoint.
