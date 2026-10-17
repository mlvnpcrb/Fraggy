"""Operator-side public-schema backup. No password in process arguments or receipts."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
from datetime import datetime, timezone
from sqlalchemy.engine import make_url


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    url = make_url(os.environ['DATABASE_URL'])
    if url.get_backend_name() != 'postgresql':
        raise SystemExit('PostgreSQL DATABASE_URL required')
    if url.query.get('sslmode') != 'verify-full' or not url.query.get('sslrootcert'):
        raise SystemExit('Verified TLS and a trusted Supabase CA file are required')
    target = args.output.resolve()
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    # Native libpq URI in child environment, never in command arguments or output.
    native = url.set(drivername='postgresql').render_as_string(hide_password=False)
    environment = {**os.environ, 'PGDATABASE': native}
    try:
        with target.open('xb') as output:
            target.chmod(0o600)
            result = subprocess.run(['pg_dump', '--format=custom', '--schema=public', '--no-owner', '--no-acl'],
                                    stdout=output, stderr=subprocess.PIPE, env=environment)
        if result.returncode:
            raise RuntimeError('pg_dump failed; check credentials, TLS and client/server versions')
        check = subprocess.run(['pg_restore', '--list', str(target)], capture_output=True)
        if check.returncode or target.stat().st_size == 0:
            raise RuntimeError('Backup archive inventory validation failed')
        with target.open('rb') as archive:
            digest = hashlib.file_digest(archive, 'sha256').hexdigest()
        receipt = {'completed_at': datetime.now(timezone.utc).isoformat(), 'scope': 'public schema',
                   'bytes': target.stat().st_size, 'sha256': digest,
                   'archive_inventory_verified': True, 'restore_tested': False}
        with target.with_suffix(target.suffix+'.json').open('x') as handle:
            os.chmod(handle.name, 0o600)
            json.dump(receipt, handle, indent=2)
        print('Backup completed and archive inventory checked; restore drill still required')
    except FileExistsError:
        raise SystemExit('Refusing to overwrite an existing backup or receipt')
    except Exception:
        # No raw subprocess diagnostics: they may contain connection secrets.
        raise SystemExit('Backup not confirmed; do not import. Inspect connection and tool configuration securely')


if __name__ == '__main__':
    main()
