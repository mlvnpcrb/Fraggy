"""Optional additive SQLite trigram indexes; existing LIKE predicates remain authoritative."""
import logging
from sqlalchemy import text
from sqlalchemy.exc import OperationalError


def initialize_search(engine):
    engine.fraggy_trigram = False
    if engine.dialect.name != 'sqlite':
        return
    try:
        with engine.begin() as connection:
            for table, columns in [('perfumes', ('name', 'brand')), ('canonical_perfumes', ('normalized_name', 'normalized_brand'))]:
                fts = table + '_fts'
                exists = connection.scalar(text("SELECT name FROM sqlite_master WHERE name=:name"), {'name':fts})
                connection.execute(text(f"CREATE VIRTUAL TABLE IF NOT EXISTS {fts} USING fts5({columns[0]}, {columns[1]}, content='{table}', content_rowid='rowid', tokenize='trigram')"))
                names = ', '.join(columns)
                new = ', '.join('new.'+column for column in columns)
                old = ', '.join('old.'+column for column in columns)
                connection.execute(text(f"CREATE TRIGGER IF NOT EXISTS {fts}_insert AFTER INSERT ON {table} BEGIN INSERT INTO {fts}(rowid, {names}) VALUES (new.rowid, {new}); END"))
                connection.execute(text(f"CREATE TRIGGER IF NOT EXISTS {fts}_delete AFTER DELETE ON {table} BEGIN INSERT INTO {fts}({fts}, rowid, {names}) VALUES ('delete', old.rowid, {old}); END"))
                connection.execute(text(f"CREATE TRIGGER IF NOT EXISTS {fts}_update AFTER UPDATE OF {names} ON {table} BEGIN INSERT INTO {fts}({fts}, rowid, {names}) VALUES ('delete', old.rowid, {old}); INSERT INTO {fts}(rowid, {names}) VALUES (new.rowid, {new}); END"))
                if not exists:
                    connection.execute(text(f"INSERT INTO {fts}({fts}) VALUES ('rebuild')"))
        engine.fraggy_trigram = True
    except OperationalError:
        # Older SQLite builds can retain the exact existing LIKE search behavior.
        logging.getLogger(__name__).warning('SQLite trigram search unavailable; retaining LIKE fallback')


def narrow_search(session, query, table):
    if not query or len(query) < 3 or any(ord(character) < 32 for character in query) or not getattr(session.get_bind(), 'fraggy_trigram', False):
        return None
    if table not in ('perfumes', 'canonical_perfumes'):
        raise ValueError('Unknown catalog search table')
    phrase = '"' + query.replace('"', '""') + '"'
    return text(f'{table}.rowid IN (SELECT rowid FROM {table}_fts WHERE {table}_fts MATCH :catalog_phrase)').bindparams(catalog_phrase=phrase)
