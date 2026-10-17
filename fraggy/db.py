import os
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import create_engine, String, JSON, Text, inspect, text, ForeignKey, UniqueConstraint, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


def now():
    return datetime.now(timezone.utc).isoformat()


class Base(DeclarativeBase):
    pass


class Perfume(Base):
    __tablename__ = 'perfumes'
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(40), default='fragrantica', index=True)
    source_id: Mapped[str] = mapped_column(String(512))
    source_url: Mapped[str] = mapped_column(String(2048), unique=True)
    name: Mapped[str] = mapped_column(String(512), index=True)
    brand: Mapped[str | None] = mapped_column(String(512), index=True)
    data: Mapped[dict] = mapped_column(JSON)
    extraction: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[str] = mapped_column(String(40))
    last_checked_at: Mapped[str] = mapped_column(String(40), index=True)


class Job(Base):
    __tablename__ = 'jobs'
    url: Mapped[str] = mapped_column(String(2048), primary_key=True)
    source: Mapped[str] = mapped_column(String(40), default='fragrantica', index=True)
    kind: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default='pending', index=True)
    attempts: Mapped[int] = mapped_column(default=0)
    available_at: Mapped[str] = mapped_column(String(40), default=now)
    error: Mapped[str | None] = mapped_column(Text)


class Run(Base):
    __tablename__ = 'sync_runs'
    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(40), default='fragrantica', index=True)
    started_at: Mapped[str] = mapped_column(String(40), default=now)
    finished_at: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(30), default='running')
    processed: Mapped[int] = mapped_column(default=0)
    failed: Mapped[int] = mapped_column(default=0)
    error: Mapped[str | None] = mapped_column(Text)


def database(url=None, *, initialize=None):
    url = url or os.getenv('DATABASE_URL', 'sqlite:///var/fraggy.db')
    if initialize is None:
        initialize = os.getenv('DATABASE_AUTO_MIGRATE', 'true').lower() == 'true'
    if initialize and url.startswith('sqlite:///'):
        Path(url.removeprefix('sqlite:///')).parent.mkdir(parents=True, exist_ok=True)
    options = {'pool_pre_ping': True}
    if not url.startswith('sqlite:'):
        options.update(pool_size=3, max_overflow=2, pool_timeout=15, pool_recycle=300)
    engine = create_engine(url, connect_args={'check_same_thread': False} if url.startswith('sqlite:') else {}, **options)
    if engine.dialect.name == 'sqlite':
        @event.listens_for(engine, 'connect')
        def configure_sqlite(connection, _):
            connection.execute('PRAGMA foreign_keys=ON')
            connection.execute('PRAGMA busy_timeout=5000')
    if not initialize:
        # Web deployments use a previously migrated schema and need no DDL rights.
        schema = inspect(engine)
        for table in Base.metadata.sorted_tables:
            if not schema.has_table(table.name):
                raise RuntimeError('Database migration required; run python -m fraggy.migrate offline')
            present = {column['name'] for column in schema.get_columns(table.name)}
            if not set(table.columns.keys()) <= present:
                raise RuntimeError('Database migration required; run python -m fraggy.migrate offline')
        engine.fraggy_trigram = False
        return sessionmaker(engine, expire_on_commit=False)
    # Additive migration: retain legacy perfume IDs and all queued work.
    existing = inspect(engine)
    with engine.begin() as connection:
        for table in ('perfumes', 'jobs', 'sync_runs'):
            if existing.has_table(table):
                columns = {column['name'] for column in existing.get_columns(table)}
                if table == 'perfumes' and engine.dialect.name == 'postgresql':
                    id_column = next(column for column in existing.get_columns(table) if column['name'] == 'id')
                    if not id_column.get('default') and not id_column.get('identity'):
                        connection.execute(text('CREATE SEQUENCE IF NOT EXISTS fraggy_perfume_id_seq'))
                        connection.execute(text("SELECT setval('fraggy_perfume_id_seq', COALESCE((SELECT MAX(id) FROM perfumes), 0) + 1, false)"))
                        connection.execute(text("ALTER TABLE perfumes ALTER COLUMN id SET DEFAULT nextval('fraggy_perfume_id_seq')"))
                if 'source' not in columns:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN source VARCHAR(40) NOT NULL DEFAULT 'fragrantica'"))
                if table == 'perfumes' and 'extraction' not in columns:
                    connection.execute(text("ALTER TABLE perfumes ADD COLUMN extraction JSON NOT NULL DEFAULT '{}'"))
                if table == 'perfumes' and 'source_id' not in columns:
                    connection.execute(text('ALTER TABLE perfumes ADD COLUMN source_id VARCHAR(512)'))
                    connection.execute(text('UPDATE perfumes SET source_id = CAST(id AS VARCHAR(512))'))
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS ix_perfumes_source_identity ON perfumes (source, source_id)'))
    from .search import initialize_search
    initialize_search(engine)
    return sessionmaker(engine, expire_on_commit=False)


class CanonicalPerfume(Base):
    __tablename__ = 'canonical_perfumes'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    match_key: Mapped[str] = mapped_column(String(128), unique=True)
    name: Mapped[str] = mapped_column(String(512))
    brand: Mapped[str | None] = mapped_column(String(512))
    normalized_name: Mapped[str] = mapped_column(String(512), index=True)
    normalized_brand: Mapped[str] = mapped_column(String(512), index=True)
    concentration: Mapped[str | None] = mapped_column(String(80))
    release_year: Mapped[int | None]
    provisional: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[str] = mapped_column(String(40), default=now)


class CanonicalLink(Base):
    __tablename__ = 'canonical_links'
    perfume_id: Mapped[int] = mapped_column(ForeignKey('perfumes.id'), primary_key=True)
    canonical_id: Mapped[str | None] = mapped_column(ForeignKey('canonical_perfumes.id'), index=True)
    confidence: Mapped[float] = mapped_column(default=0.0)
    method: Mapped[str] = mapped_column(String(40))
    locked: Mapped[bool] = mapped_column(default=False)
    fingerprint: Mapped[str] = mapped_column(String(64))
    updated_at: Mapped[str] = mapped_column(String(40), default=now)


class MatchReview(Base):
    __tablename__ = 'match_reviews'
    __table_args__ = (UniqueConstraint('perfume_id', 'canonical_id', 'fingerprint'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    perfume_id: Mapped[int] = mapped_column(ForeignKey('perfumes.id'), index=True)
    canonical_id: Mapped[str] = mapped_column(ForeignKey('canonical_perfumes.id'))
    fingerprint: Mapped[str] = mapped_column(String(64))
    confidence: Mapped[float]
    status: Mapped[str] = mapped_column(String(30), default='pending')
    reason: Mapped[str] = mapped_column(Text)


class MatchEvent(Base):
    __tablename__ = 'match_events'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    perfume_id: Mapped[int] = mapped_column(ForeignKey('perfumes.id'), index=True)
    before: Mapped[dict | None] = mapped_column(JSON)
    after: Mapped[dict | None] = mapped_column(JSON)
    review_changes: Mapped[list] = mapped_column(JSON, default=list)
    actor: Mapped[str] = mapped_column(String(200))
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40), default=now)
    undone_at: Mapped[str | None] = mapped_column(String(40))


class BrandAlias(Base):
    """Append-only operator decisions; latest row for an alias is effective."""
    __tablename__ = 'brand_aliases'
    id: Mapped[int] = mapped_column(primary_key=True)
    alias: Mapped[str] = mapped_column(String(512), index=True)
    canonical_brand: Mapped[str] = mapped_column(String(512))
    actor: Mapped[str] = mapped_column(String(200))
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40), default=now)
