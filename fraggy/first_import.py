"""Bounded, attended import. Uses existing source/queue/matching code, never a scheduler."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile
from urllib.parse import urlsplit
from uuid import uuid4
import httpx
from sqlalchemy.engine import make_url
from .db import database, Perfume, CanonicalLink, CanonicalPerfume
from .source import Source, PERFUME
from .sources import SOURCES
from .sync import run_sync, worker_lock


class FirstImportError(ValueError):
    pass


def product_urls(source_key, lines, limit=10):
    if source_key not in SOURCES or not 1 <= limit <= 10:
        raise FirstImportError('Choose a registered source and a limit from 1 to 10')
    adapter = SOURCES[source_key]
    urls = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        parts = urlsplit(line)
        if not parts.scheme or parts.query or parts.fragment:
            raise FirstImportError('Use absolute HTTPS product URLs without query parameters or fragments')
        try:
            url = adapter.canonical(line)
        except ValueError as exc:
            raise FirstImportError('URL is not on the selected HTTPS source') from exc
        pattern = PERFUME if source_key == 'fragrantica' else re.compile(adapter.paths, re.I)
        if not pattern.search(urlsplit(url).path):
            raise FirstImportError('A URL does not match the selected source product route')
        if url not in urls:
            urls.append(url)
    if not urls or len(urls) > limit:
        raise FirstImportError('The file must contain 1..limit unique product URLs; extra URLs are never silently imported')
    return urls


def api_url(value):
    parts = urlsplit(value)
    if (parts.username or parts.password or parts.query or parts.fragment
        or parts.scheme not in ('http', 'https') or not parts.hostname
        or (parts.scheme == 'http' and parts.hostname not in ('localhost', '127.0.0.1', '::1'))):
        raise argparse.ArgumentTypeError('Use HTTPS for the API, or HTTP on loopback; no embedded credentials')
    return value.rstrip('/')


def backup_sqlite(url, destination, postgres_backup_confirmed=False):
    parsed = make_url(url)
    if parsed.get_backend_name() != 'sqlite':
        if not postgres_backup_confirmed:
            raise FirstImportError('Confirm an external PostgreSQL backup with --database-backup-confirmed')
        return {'type': 'external', 'operator_confirmed': True}
    if not parsed.database or parsed.database == ':memory:' or not Path(parsed.database).exists():
        return {'type': 'sqlite', 'existing_database': False}
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / ('before-first-import-' + uuid4().hex + '.sqlite')
    with sqlite3.connect(Path(parsed.database).resolve().as_uri()+'?mode=ro', uri=True) as source:
        with sqlite3.connect(target) as backup:
            source.backup(backup)
    target.chmod(0o600)
    return {'type': 'sqlite', 'path': str(target)}


def fetch(client, path, params=None):
    response = client.get(path, params=params, headers={'Cache-Control': 'no-cache'})
    response.raise_for_status()
    return response.json()


def contains_record(client, path, identity, params=None):
    # Bounded API checks; never silently claim visibility after a pagination cutoff.
    for offset in range(0, 1000, 100):
        page = fetch(client, path, {**(params or {}), 'limit': 100, 'offset': offset})
        if any(item['id'] == identity for item in page['items']):
            return True
        if offset + len(page['items']) >= page['total'] or not page['items']:
            return False
    raise FirstImportError('Verification exceeded 1,000 results; narrow the catalog query and review manually')


def verify_records(factory, record_ids, client):
    verified = []
    for identity in record_ids:
        with factory() as session:
            record = session.get(Perfume, identity)
            link = session.get(CanonicalLink, identity)
            if record is None or link is None or link.canonical_id is None:
                raise FirstImportError('An imported record needs canonical association review')
            canonical = session.get(CanonicalPerfume, link.canonical_id)
            expected = {**record.data, 'id':record.id, 'source':record.source, 'source_id':record.source_id,
                        'source_url':record.source_url, 'updated_at':record.updated_at,
                        'last_checked_at':record.last_checked_at}
            canonical_id, name, source = canonical.id, canonical.normalized_name, record.source
        detail = fetch(client, '/v1/perfumes/' + str(identity))
        if detail != expected:
            raise FirstImportError('API data differs from imported data; check database configuration and freshness')
        if not contains_record(client, '/v1/canonical-perfumes', canonical_id, {'q':name[:200], 'source':source}):
            raise FirstImportError('Imported canonical identity is absent from search')
        if not contains_record(client, '/v1/canonical-perfumes/'+canonical_id+'/sources', identity):
            raise FirstImportError('Source provenance is absent from the canonical sources endpoint')
        canonical_detail = fetch(client, '/v1/canonical-perfumes/'+canonical_id)
        selection = canonical_detail['selection']
        if selection['canonical_id'] != canonical_id or not canonical_detail['active']:
            raise FirstImportError('Canonical shelf selection is inactive or inconsistent')
        verified.append({'record_id':identity, 'canonical_id':canonical_id, 'source':source,
                         'source_id':detail['source_id'], 'source_url':detail['source_url'],
                         'shelf_reference':{'canonical_id':canonical_id, 'source_record_id':identity},
                         'requires_review':selection['requires_review'],
                         'eligible_for_trading':selection['eligible_for_trading']})
    return verified


def attended_import(factory, source, source_key, urls, client):
    result = run_sync(factory, source, max_jobs=len(urls), source_key=source_key, target_urls=urls)
    verification_error = None
    try:
        verified = verify_records(factory, result['record_ids'], client)
    except Exception as exc:
        verified = []
        verification_error = str(exc) if isinstance(exc, FirstImportError) else type(exc).__name__
    return {'sync':result, 'verified_records':verified, 'verification_error':verification_error,
            'success':result['status'] == 'completed' and result['processed'] == len(urls) and bool(verified) and not verification_error,
            'live_source_validation':'not_established_by_this_check',
            'manual_source_comparison_required':True, 'unattended_scraping_enabled':False}


def write_report(path, report):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, prefix='.first-import-', delete=False) as handle:
        json.dump(report, handle, indent=2)
        temporary = handle.name
    os.replace(temporary, path)


def main():
    parser = argparse.ArgumentParser(description='Attended import of at most 10 explicit perfume URLs; no crawling or scheduler')
    parser.add_argument('--source', required=True, choices=list(SOURCES))
    parser.add_argument('--urls-file', type=Path, required=True)
    parser.add_argument('--limit', type=int, default=10)
    parser.add_argument('--authorized', action='store_true', required=True, help='Confirm permission for this source and use')
    parser.add_argument('--operator', required=True)
    parser.add_argument('--permission-reference', required=True, help='Non-secret agreement/permission reference, never a token')
    parser.add_argument('--api-base-url', type=api_url, required=True)
    parser.add_argument('--report', type=Path, default=Path('var/first-import.json'))
    parser.add_argument('--backup-dir', type=Path, default=Path('var/backups'))
    parser.add_argument('--database-backup-confirmed', action='store_true')
    args = parser.parse_args()
    report = {'source':args.source, 'operator':args.operator, 'permission_reference':args.permission_reference,
              'started_at':datetime.now(timezone.utc).isoformat(), 'success':False,
              'unattended_scraping_enabled':False, 'live_source_validation':'not_established_by_this_check'}
    source = None
    try:
        if not args.operator.strip() or not args.permission_reference.strip():
            raise FirstImportError('Operator and a non-secret permission reference are required')
        urls = product_urls(args.source, args.urls_file.read_text().splitlines(), args.limit)
        report['requested_urls'] = urls
        database_url = os.getenv('DATABASE_URL', 'sqlite:///var/fraggy.db')
        with worker_lock():
            report['backup'] = backup_sqlite(database_url, args.backup_dir, args.database_backup_confirmed)
            factory = database(database_url)
            source = Source(adapter=SOURCES[args.source],
                delay=float(os.getenv('SCRAPE_DELAY_SECONDS_' + args.source.upper(), os.getenv('SCRAPE_DELAY_SECONDS', '20'))),
                user_agent=os.getenv('SCRAPER_USER_AGENT', 'FraggyAPI/0.1'))
            token = os.getenv('FRAGGY_API_TOKEN')
            with httpx.Client(base_url=args.api_base_url, timeout=30, follow_redirects=False,
                              headers={'Authorization':'Bearer '+token} if token else {}) as client:
                # Fail before source access if the requested API is unavailable.
                if fetch(client, '/health').get('status') != 'ok':
                    raise FirstImportError('API health check failed')
                report.update(attended_import(factory, source, args.source, urls, client))
    except Exception as exc:
        report['success'] = False
        report['error_type'] = type(exc).__name__
        # Never echo database/proxy credentials or arbitrary transport exception messages.
        report['error'] = str(exc) if isinstance(exc, FirstImportError) else 'Operation failed; inspect sanitized queue errors and server logs'
    finally:
        if source is not None:
            report['http_observations'] = source.responses
            source.close()
        report['finished_at'] = datetime.now(timezone.utc).isoformat()
        write_report(args.report, report)
    print(json.dumps({'success':report['success'], 'report':str(args.report),
                      'verified_record_count':len(report.get('verified_records', [])),
                      'imported_record_count':len(report.get('sync', {}).get('record_ids', [])),
                      'live_source_validation':report['live_source_validation']}))
    raise SystemExit(0 if report['success'] else 1)


if __name__ == '__main__':
    main()
