# Supabase Free PostgreSQL

No project has been created or connected. Live Supabase DNS, TLS, authentication,
custom pooled roles and migrations remain unverified. Official documentation was
proxy-blocked: https://supabase.com/docs/guides/database/connecting-to-postgres
and https://supabase.com/docs/guides/platform/ssl-enforcement . Confirm current
Free limits, pooler instructions and certificate download paths in the dashboard.

1. After deployment approval, create a **Free** project in a free organization.
   Use a strong unique admin password stored in a password manager; decline all
   paid upgrades, IPv4 add-ons, compute changes and paid backups. Review ₱0 total.
2. Choose **Connect → Session pooler**, using the displayed shared pooler hostname
   and port **5432**. This is the intended IPv4-compatible method for Render,
   avoids paying for direct-endpoint IPv4, and supports persistent SQLAlchemy
   sessions and PostgreSQL administrative tooling. Do not use transaction port
   6543 for this configuration. Direct endpoint IPv6 reachability from the
   selected Render region is unverified; it is not assumed or required.
3. Download the trusted project database root CA through Supabase's authenticated
   dashboard/documented channel. Save locally, e.g. `$HOME/fraggy-secrets/supabase-ca.crt`.
   Use `sslmode=verify-full&sslrootcert=ABSOLUTE_PATH` in every database URL.
   Confirm the pooler certificate validates against the provider's documented CA
   and hostname. If it does not, stop and correct the trust chain using provider
   instructions. Never use sslmode=disable, insecure TLS or hostname bypasses.
   Put the CA in Render's secret file path as documented in render-free.md.
4. Use an operator machine with PostgreSQL tools of the server's major version
   (or a compatible newer pg_dump). Securely configure `PGHOST`, `PGPORT=5432`,
   `PGUSER=postgres.PROJECT`, `PGDATABASE=postgres`, `PGSSLMODE=verify-full`,
   `PGSSLROOTCERT=/absolute/path/supabase-ca.crt`; use `psql -W` interactive
   password prompts or a mode-0600 pgpass file. Never paste passwords in commands
   or chat. Run the following **once**, reviewing existing role names first:

```sql
CREATE ROLE fraggy_owner LOGIN;
CREATE ROLE fraggy_reader LOGIN;
GRANT CONNECT ON DATABASE postgres TO fraggy_owner, fraggy_reader;
GRANT USAGE, CREATE ON SCHEMA public TO fraggy_owner;
GRANT USAGE ON SCHEMA public TO fraggy_reader;
```

Set passwords interactively with psql `\password fraggy_owner` and
`\password fraggy_reader`. Use only a fresh project or coordinate public-schema
permissions with existing applications. Do not revoke unrelated Supabase grants.

5. On the operator machine configure a secret DATABASE_URL (no shell history):
   `postgresql+psycopg://fraggy_owner.PROJECT:PERCENT_ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=verify-full&sslrootcert=/absolute/path/supabase-ca.crt`.
   Use the pooler username convention displayed for custom roles; confirm it
   authenticates. Administrator URLs must never be deployed to Render.
6. Create a backup and run explicit migrations as described below. The original
   additive migrations remain in fraggy/db.py. No Alembic replacement or migration
   rewrite was introduced. Only one operator may migrate/import at a time; local
   filesystem locks do not coordinate separate hosts. Stop other writers first.

```bash
.venv/bin/python -m scripts.backup_postgres --output "$HOME/fraggy-ops/backups/pre-migration.dump"
.venv/bin/python -m fraggy.migrate
```

7. Connected as **fraggy_owner**, grant read access only on Fraggy's actual tables:

```sql
GRANT SELECT ON perfumes, jobs, sync_runs, canonical_perfumes, canonical_links,
  match_reviews, match_events, brand_aliases TO fraggy_reader;
REVOKE ALL ON perfumes, jobs, sync_runs, canonical_perfumes, canonical_links,
  match_reviews, match_events, brand_aliases FROM anon, authenticated;
```

Do not give the frontend direct table access. Confirm neither `PUBLIC` nor a
membership inherited by fraggy_reader grants INSERT/UPDATE/DELETE/CREATE on the
Fraggy objects. Supabase defaults can evolve: audit effective permissions and
remove unintended grants on **these objects**, without changing unrelated apps.
Use the following reader checks in psql (must return true, false, false, false):

```sql
SELECT has_table_privilege(current_user, 'public.perfumes', 'SELECT'),
       has_table_privilege(current_user, 'public.perfumes', 'INSERT'),
       has_table_privilege(current_user, 'public.perfumes', 'UPDATE'),
       has_schema_privilege(current_user, 'public', 'CREATE');
```

Do not enable Supabase Data API access to these tables. Confirm anon/authenticated
lack effective access, including grants inherited from PUBLIC. If enabling RLS,
add and test an explicit reader policy; enabling RLS without it may return empty
results. Do not rely on Supabase service-role bypass credentials in the PWA.

8. Set DATABASE_URL to **fraggy_reader** credentials and DATABASE_AUTO_MIGRATE=false
   on the operator machine; verify the web's actual path without running DDL:

```bash
.venv/bin/python - <<'PY'
from sqlalchemy import text
from fraggy.db import database
factory = database(initialize=False)
with factory() as session:
    assert session.scalar(text('SELECT 1')) == 1
print('Connection and required schema verified')
PY
PORT=8000 .venv/bin/python -m fraggy.web
```

Check /health, canonical search and attribution using the commands in render-free.md.
These checks need real credentials and permitted outbound PostgreSQL TCP, independent
of HTTPS proxy access. Connection/migration failure is a blocker, not an invitation
to enable insecure TLS or automatic migrations. Repeat reader grants for future tables
as a reviewed migration step. Catalog imports use fraggy_owner on the operator only.
