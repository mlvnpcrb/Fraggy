"""Single-worker persistent queue. Run on one host, with a durable local lock path."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import fcntl
import os
from pathlib import Path
import time
from sqlalchemy import select
from .db import database, Perfume, Job, Run, now
from .source import Source, SourceBlocked
from .sources import SOURCES
from .extraction import merge_extraction
from .catalog import match_record


@contextmanager
def worker_lock():
    path = Path(os.getenv('SYNC_LOCK_PATH', 'var/sync.lock'))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Another sync worker holds the lock')
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def enqueue(session, url, kind, refresh=False, source_key='fragrantica'):
    url = SOURCES[source_key].canonical(url)
    job = session.get(Job, url)
    if job is None:
        session.add(Job(url=url, source=source_key, kind=kind, status='pending', available_at=now()))
    elif refresh and job.status == 'done':
        job.status, job.attempts, job.error, job.available_at = 'pending', 0, None, now()


def prepare(factory, refresh_days=7, source_key='fragrantica'):
    adapter = SOURCES[source_key]
    cutoff = (datetime.now(timezone.utc) - timedelta(days=refresh_days)).isoformat()
    with factory.begin() as session:
        # Recover jobs interrupted by a previous process; caller holds the worker lock.
        for job in session.scalars(select(Job).where(Job.status == 'running', Job.source == source_key)):
            job.status = 'pending'
        for seed in adapter.seeds:
            enqueue(session, adapter.base + seed, 'listing', refresh=True, source_key=source_key)
        for job in session.scalars(select(Job).where(Job.kind.in_(['listing', 'sitemap']), Job.status == 'done', Job.source == source_key)):
            enqueue(session, job.url, job.kind, refresh=True, source_key=source_key)
        for perfume in session.scalars(select(Perfume).where(Perfume.last_checked_at < cutoff, Perfume.source == source_key)):
            enqueue(session, perfume.source_url, 'perfume', refresh=True, source_key=source_key)


def run_sync(factory, source, max_jobs=1000, refresh_days=7, source_key='fragrantica', *, target_urls=None):
    adapter = SOURCES[source_key]
    if target_urls is None:
        prepare(factory, refresh_days, source_key)
    else:
        target_urls = list(dict.fromkeys(adapter.canonical(url) for url in target_urls))
        if not 1 <= len(target_urls) <= 10:
            raise ValueError('Targeted imports require 1..10 unique product URLs')
        with factory.begin() as session:
            for url in target_urls:
                existing = session.get(Job, url)
                if existing and existing.kind != 'perfume':
                    raise ValueError('Targeted URL conflicts with a discovery job')
                enqueue(session, url, 'perfume', refresh=True, source_key=source_key)
                if existing and existing.status == 'running':
                    existing.status = 'pending'
    record_ids = []
    with factory.begin() as session:
        run = Run(source=source_key, started_at=now(), status='running', processed=0, failed=0)
        session.add(run)
        session.flush()
        run_id = run.id
    blocked = False
    try:
        for _ in range(max_jobs):
            with factory.begin() as session:
                query = select(Job).where(Job.status == 'pending', Job.available_at <= now(), Job.source == source_key)
                if target_urls is not None:
                    query = query.where(Job.url.in_(target_urls))
                job = session.scalar(query.order_by(Job.available_at, Job.url).limit(1))
                if job is None:
                    break
                job.status = 'running'
                url, kind = job.url, job.kind
            try:
                html = source.get(url)
                if kind == 'perfume':
                    identity, data = adapter.parse(html, url)
                else:
                    links = adapter.discover(html, url)
                    for sitemap in getattr(source, 'sitemap_urls', lambda: [])():
                        try:
                            links.setdefault(adapter.canonical(sitemap), 'sitemap')
                        except ValueError:
                            continue
                    if not links:
                        raise ValueError('Listing has no discoverable links; inspect page/parser')
                with factory.begin() as session:
                    if kind != 'perfume':
                        for link, link_kind in links.items():
                            enqueue(session, link, link_kind, source_key=source_key)
                    else:
                        perfume = session.scalar(select(Perfume).where(Perfume.source == source_key, Perfume.source_id == identity))
                        merged, metadata = merge_extraction(perfume.data if perfume else {}, data, perfume.extraction if perfume else {})
                        if perfume is None:
                            perfume = Perfume(source=source_key, source_id=identity, source_url=url, name=merged['name'], brand=merged.get('brand'), data=merged, extraction=metadata, updated_at=now(), last_checked_at=now())
                            session.add(perfume)
                        else:
                            if perfume.data != merged:
                                perfume.data, perfume.updated_at = merged, now()
                            perfume.source_url, perfume.name, perfume.brand = url, merged['name'], merged.get('brand')
                            perfume.extraction = metadata
                            perfume.last_checked_at = now()
                        session.flush()
                        match_record(session, perfume)
                    session.get(Job, url).status = 'done'
                    session.get(Run, run_id).processed += 1
                if kind == 'perfume':
                    record_ids.append(perfume.id)
            except Exception as exc:
                with factory.begin() as session:
                    job = session.get(Job, url)
                    job.attempts += 1
                    job.error = f'{getattr(exc, "kind", type(exc).__name__)}: {exc}'[:2000]
                    job.status = 'failed' if job.attempts >= 5 else 'pending'
                    delay_seconds = max(min(86400, 300 * 2 ** job.attempts), getattr(exc, 'retry_after', None) or 0)
                    job.available_at = (datetime.now(timezone.utc) + timedelta(seconds=min(delay_seconds, 31536000))).isoformat()
                    run = session.get(Run, run_id)
                    run.failed += 1
                    run.error = job.error
                if isinstance(exc, SourceBlocked):
                    blocked = True
                    break
    finally:
        with factory.begin() as session:
            run = session.get(Run, run_id)
            run.finished_at = now()
            waiting = session.scalar(select(Job.url).where(Job.source == source_key, Job.status == 'pending').limit(1))
            run.status = 'blocked' if blocked else ('partial' if run.failed else ('deferred' if not run.processed and waiting else 'completed'))
    with factory() as session:
        run = session.get(Run, run_id)
        result = {'id': run_id, 'source': source_key, 'status': run.status, 'processed': run.processed, 'failed': run.failed}
        if target_urls is not None:
            result['record_ids'] = list(dict.fromkeys(record_ids))
            jobs = session.scalars(select(Job).where(Job.source == source_key, Job.url.in_(target_urls)).order_by(Job.url))
            result['jobs'] = [{'url': job.url, 'status': job.status, 'attempts': job.attempts,
                               'available_at': job.available_at, 'error_kind': job.error.split(':', 1)[0] if job.error else None} for job in jobs]
        return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--daily', action='store_true', help='Run immediately, then every 24 hours')
    parser.add_argument('--max-jobs', type=int, default=100, help='Maximum jobs per source per run')
    parser.add_argument('--refresh-days', type=int, default=7)
    parser.add_argument('--retry-failed', action='store_true', help='Explicitly reset terminal failures for selected sources after diagnosis')
    parser.add_argument('--sources', default=os.getenv('SYNC_SOURCES', 'all'), help='Comma-separated source keys or all; listed by /v1/sources')
    args = parser.parse_args()
    keys = list(SOURCES) if args.sources == 'all' else list(dict.fromkeys(args.sources.split(',')))
    if not keys or any(key not in SOURCES for key in keys):
        parser.error('Unknown source; choose: ' + ','.join(SOURCES))
    keys.sort(key=lambda key: SOURCES[key].priority)
    if args.max_jobs < 1 or args.refresh_days < 1:
        parser.error('Job limit and refresh interval must be positive')
    if args.daily:
        approved = set(filter(None, os.getenv('SCRAPING_APPROVED_SOURCES', '').split(',')))
        validated = set(filter(None, os.getenv('LIVE_VALIDATED_SOURCES', '').split(',')))
        if not set(keys) <= approved & validated:
            parser.error('Daily scraping requires each selected source in SCRAPING_APPROVED_SOURCES and LIVE_VALIDATED_SOURCES; leave disabled until permissions and live validation are confirmed')
    factory = database()
    if args.retry_failed:
        with worker_lock(), factory.begin() as session:
            for job in session.scalars(select(Job).where(Job.source.in_(keys), Job.status == 'failed')):
                job.status, job.attempts, job.error, job.available_at = 'pending', 0, None, now()
    while True:
        cycle_started = time.monotonic()
        results = []
        with worker_lock():
            for key in keys:
                source = Source(delay=float(os.getenv('SCRAPE_DELAY_SECONDS_' + key.upper(), os.getenv('SCRAPE_DELAY_SECONDS', '20'))),
                                user_agent=os.getenv('SCRAPER_USER_AGENT', 'FraggyAPI/0.1'), adapter=SOURCES[key])
                try:
                    result = run_sync(factory, source, args.max_jobs, args.refresh_days, key)
                    results.append(result)
                    print(result, flush=True)
                finally:
                    source.close()
        if not args.daily:
            raise SystemExit(0 if all(result['status'] == 'completed' for result in results) else 1)
        time.sleep(max(0, 86400 - (time.monotonic() - cycle_started)))


if __name__ == '__main__':
    main()
