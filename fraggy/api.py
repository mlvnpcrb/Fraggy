from contextlib import asynccontextmanager
import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func, or_, text
from .db import database, Perfume, Run, Job, CanonicalPerfume, CanonicalLink
from .sources import SOURCES
from .catalog import normalize, resolve_brand
from .http_policy import CatalogHTTPPolicy
from .search import narrow_search


def create_app(factory=None):
    @asynccontextmanager
    async def lifespan(app):
        app.state.db = factory or database()
        yield

    app = FastAPI(title='FraggyAPI', version='0.1.0', lifespan=lifespan)
    app.add_middleware(CatalogHTTPPolicy)
    origins = [origin.strip() for origin in os.getenv('CORS_ORIGINS', '').split(',') if origin.strip()]
    if origins:
        app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=['GET'], allow_headers=['*'])

    def serialize(perfume):
        return {**perfume.data, 'id': perfume.id, 'source': perfume.source, 'source_id': perfume.source_id, 'source_url': perfume.source_url,
                'updated_at': perfume.updated_at, 'last_checked_at': perfume.last_checked_at}

    @app.get('/health')
    def health():
        with app.state.db() as session:
            session.execute(text('SELECT 1'))
        return {'status': 'ok'}

    @app.get('/v1/sources')
    def sources():
        with app.state.db() as session:
            items = []
            for source in SOURCES.values():
                run = session.scalar(select(Run).where(Run.source == source.key).order_by(Run.id.desc()).limit(1))
                items.append({'key': source.key, 'url': source.base, 'priority': source.priority,
                              'parser_status': source.parser_status, 'live_verified': False,
                              'last_run_status': run.status if run else None,
                              'last_run_at': run.started_at if run else None})
            return {'items': items}

    def canonical_results(session, q, brand, source, limit, offset):
        conditions = [CanonicalPerfume.id.in_(select(CanonicalLink.canonical_id).where(CanonicalLink.canonical_id.is_not(None)))]
        if q:
            escaped = normalize(q)
            conditions.append(or_(CanonicalPerfume.normalized_name.contains(escaped), CanonicalPerfume.normalized_brand.contains(escaped)) if escaped else CanonicalPerfume.id == '')
        if brand:
            conditions.append(CanonicalPerfume.normalized_brand == resolve_brand(session, brand))
        if source:
            if source not in SOURCES:
                raise HTTPException(422, 'Unknown source')
            conditions.append(CanonicalPerfume.id.in_(select(CanonicalLink.canonical_id).join(Perfume, Perfume.id == CanonicalLink.perfume_id).where(Perfume.source == source)))
        index = narrow_search(session, normalize(q), 'canonical_perfumes') if q else None
        if index is not None:
            conditions.append(index)
        total = session.scalar(select(func.count()).select_from(CanonicalPerfume).where(*conditions))
        rows = session.scalars(select(CanonicalPerfume).where(*conditions).order_by(CanonicalPerfume.name, CanonicalPerfume.id).offset(offset).limit(limit))
        records = list(rows)
        counts = dict(session.execute(select(CanonicalLink.canonical_id, func.count()).where(
            CanonicalLink.canonical_id.in_([row.id for row in records])).group_by(CanonicalLink.canonical_id)).all()) if records else {}
        items = [{'id': row.id, 'name': row.name, 'brand': row.brand, 'concentration': row.concentration,
                  'release_year': row.release_year, 'provisional': row.provisional,
                  'source_record_count': counts.get(row.id, 0)} for row in records]
        return {'items': items, 'total': total, 'limit': limit, 'offset': offset}

    @app.get('/v1/canonical-perfumes')
    def canonical_perfumes(q: str | None = Query(None, max_length=200), brand: str | None = Query(None, max_length=200),
                           source: str | None = None, limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0)):
        with app.state.db() as session:
            return canonical_results(session, q, brand, source, limit, offset)

    @app.get('/v1/canonical-perfumes/{canonical_id}')
    def canonical_detail(canonical_id: str):
        with app.state.db() as session:
            row = session.get(CanonicalPerfume, canonical_id)
            if row is None:
                raise HTTPException(404, 'Canonical perfume not found')
            members = session.execute(select(Perfume.id, Perfume.source, Perfume.source_id, Perfume.source_url).join(
                CanonicalLink, CanonicalLink.perfume_id == Perfume.id).where(CanonicalLink.canonical_id == row.id).order_by(Perfume.id)).all()
            return {'id': row.id, 'name': row.name, 'brand': row.brand, 'concentration': row.concentration,
                    'release_year': row.release_year, 'provisional': row.provisional, 'created_at': row.created_at,
                    'active': bool(members), 'source_record_count': len(members),
                    'attribution': [{'record_id': record_id, 'source': source, 'source_id': source_id, 'url': url}
                                    for record_id, source, source_id, url in members],
                    'selection': {'canonical_id': row.id, 'requires_review': row.provisional or not members,
                                  'eligible_for_trading': bool(members) and not row.provisional}}

    @app.get('/v1/canonical-perfumes/{canonical_id}/sources')
    def canonical_sources(canonical_id: str, limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0)):
        with app.state.db() as session:
            if session.get(CanonicalPerfume, canonical_id) is None:
                raise HTTPException(404, 'Canonical perfume not found')
            total = session.scalar(select(func.count()).select_from(CanonicalLink).where(CanonicalLink.canonical_id == canonical_id))
            rows = session.execute(select(Perfume, CanonicalLink).join(CanonicalLink, CanonicalLink.perfume_id == Perfume.id).where(CanonicalLink.canonical_id == canonical_id).order_by(Perfume.id).limit(limit).offset(offset))
            return {'items': [{**serialize(record), 'match': {'confidence': link.confidence, 'method': link.method, 'locked': link.locked}} for record, link in rows],
                    'total': total, 'limit': limit, 'offset': offset}

    @app.get('/v1/perfumes/{perfume_id}/extraction')
    def extraction(perfume_id: int):
        with app.state.db() as session:
            record = session.get(Perfume, perfume_id)
            if record is None:
                raise HTTPException(404, 'Perfume not found')
            return {'id': record.id, 'fields': record.extraction}

    @app.get('/v1/perfumes')
    def perfumes(q: str | None = Query(None, max_length=200), brand: str | None = Query(None, max_length=200),
                 source: str | None = None, limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0), canonical: bool = False):
        if canonical:
            with app.state.db() as session:
                return canonical_results(session, q, brand, source, limit, offset)
        conditions = []
        if source:
            if source not in SOURCES:
                raise HTTPException(422, 'Unknown source')
            conditions.append(Perfume.source == source)
        if q:
            escaped = q.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
            conditions.append(or_(Perfume.name.ilike(f'%{escaped}%', escape='\\'), Perfume.brand.ilike(f'%{escaped}%', escape='\\')))
        if brand:
            conditions.append(func.lower(Perfume.brand) == brand.lower())
        with app.state.db() as session:
            index = narrow_search(session, q, 'perfumes')
            if index is not None:
                conditions.append(index)
            total = session.scalar(select(func.count()).select_from(Perfume).where(*conditions))
            rows = session.scalars(select(Perfume).where(*conditions).order_by(Perfume.name, Perfume.id).offset(offset).limit(limit))
            return {'items': [serialize(row) for row in rows], 'total': total, 'limit': limit, 'offset': offset}

    @app.get('/v1/perfumes/{perfume_id}')
    def perfume(perfume_id: int):
        with app.state.db() as session:
            row = session.get(Perfume, perfume_id)
            if row is None:
                raise HTTPException(404, 'Perfume not found')
            return serialize(row)

    @app.get('/v1/brands')
    def brands(limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
        with app.state.db() as session:
            rows = session.execute(select(Perfume.brand, func.count()).where(Perfume.brand.is_not(None)).group_by(Perfume.brand).order_by(Perfume.brand).offset(offset).limit(limit))
            return {'items': [{'name': brand, 'perfume_count': count} for brand, count in rows], 'limit': limit, 'offset': offset}

    @app.get('/v1/sync/status')
    def sync_status(source: str | None = None):
        with app.state.db() as session:
            if source is not None and source not in SOURCES:
                raise HTTPException(422, 'Unknown source')
            runs = select(Run)
            jobs = select(Job.status, func.count())
            if source:
                runs = runs.where(Run.source == source)
                jobs = jobs.where(Job.source == source)
            run = session.scalar(runs.order_by(Run.id.desc()).limit(1))
            counts = dict(session.execute(jobs.group_by(Job.status)).all())
            return {'last_run': None if run is None else {'id': run.id, 'source': run.source, 'status': run.status, 'started_at': run.started_at,
                    'finished_at': run.finished_at, 'processed': run.processed, 'failed': run.failed}, 'jobs': counts}

    return app


app = create_app()
