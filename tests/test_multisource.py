import json
import sqlite3
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from fraggy.api import create_app
from fraggy.db import database, Perfume, Job
from fraggy.source import SourceBlocked
from fraggy.sources import SOURCES, parse_product
from fraggy.sync import run_sync


def product(name='Example', rating=8):
    return '<script type="application/ld+json">' + json.dumps({'@graph': [
        {'@type': 'Organization', 'name': 'Shop'},
        {'@type': 'Product', 'name': name, 'brand': {'name': 'Example Brand'},
         'image': ['/bottle.jpg'], 'sku': '123',
         'aggregateRating': {'ratingValue': rating, 'bestRating': 10, 'ratingCount': 100},
         'offers': {'price': '120.00', 'priceCurrency': 'USD'}}]}) + '</script>'


PATHS = {
    'parfumo': '/Perfumes/Example/One', 'basenotes': '/fragrances/example.123',
    'wikiparfum': '/en/fragrances/example', 'osmoz': '/perfumes/example/one',
    'perfumecom': '/example/one/women-perfume/us/en/123',
    'fragrancex': '/products/example/one-perfume', 'luckyscent': '/product/123/example',
}


class Pages:
    def __init__(self, key):
        self.adapter = SOURCES[key]
        self.url = self.adapter.base + PATHS[key]
        self.rating = 8
    def get(self, url):
        if url == self.url:
            return product(rating=self.rating)
        return f'<a href="{self.url}">Example</a>'


@pytest.mark.parametrize('key', PATHS)
def test_each_adapter_discovers_imports_and_updates(tmp_path, key):
    db = database('sqlite:///' + str(tmp_path / 'test.db'))
    source = Pages(key)
    result = run_sync(db, source, 10, source_key=key)
    assert result['processed'] == 2 and result['failed'] == 0
    with db.begin() as session:
        perfume = session.scalar(select(Perfume))
        assert perfume.source == key
        assert perfume.data['rating_scale']['max'] == 10
        assert perfume.data['offers'][0]['priceCurrency'] == 'USD'
        assert perfume.data['notes_top'] == []
        perfume.last_checked_at = '2000-01-01'
    source.rating = 9
    run_sync(db, source, 10, source_key=key)
    with db() as session:
        rows = list(session.scalars(select(Perfume)))
        assert len(rows) == 1 and rows[0].data['rating'] == 9


def test_source_isolation_and_api(tmp_path):
    db = database('sqlite:///' + str(tmp_path / 'test.db'))
    for key in ('parfumo', 'basenotes'):
        run_sync(db, Pages(key), 10, source_key=key)
    with db.begin() as session:
        other = session.get(Job, SOURCES['basenotes'].base + '/directory/')
        other.status = 'running'
    run_sync(db, Pages('parfumo'), 10, source_key='parfumo')
    with db() as session:
        assert session.get(Job, other.url).status == 'running'
    with TestClient(create_app(db)) as client:
        assert client.get('/v1/perfumes').json()['total'] == 2
        items = client.get('/v1/perfumes?source=parfumo').json()['items']
        assert len(items) == 1 and items[0]['source'] == 'parfumo'
        assert items[0]['source_id']
        assert client.get('/v1/perfumes?source=unknown').status_code == 422
        assert len(client.get('/v1/sources').json()['items']) == 8
        assert client.get('/v1/sync/status?source=basenotes').json()['last_run']['source'] == 'basenotes'


def test_sitemap_discovery_and_domain_boundaries():
    for key, adapter in SOURCES.items():
        with pytest.raises(ValueError):
            adapter.canonical('https://evil.test/test')
        with pytest.raises(ValueError):
            adapter.canonical('https://user:secret@' + adapter.base.split('//')[1] + '/')
    adapter = SOURCES['parfumo']
    xml = '''<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://www.parfumo.com/Perfumes/Example/One</loc></url>
      <url><loc>https://evil.test/Perfumes/Example/One</loc></url></urlset>'''
    assert adapter.discover(xml, adapter.base) == {adapter.base + PATHS['parfumo']: 'perfume'}
    xml = '<sitemapindex><sitemap><loc>https://www.parfumo.com/maps/1.xml</loc></sitemap></sitemapindex>'
    assert adapter.discover(xml, adapter.base) == {adapter.base + '/maps/1.xml': 'sitemap'}
    with pytest.raises(ValueError):
        parse_product('<h1>Example</h1>', adapter.base)
    with pytest.raises(ValueError):
        parse_product(product() + product('Other'), adapter.base)


def test_source_block_does_not_stop_next_source(tmp_path):
    db = database('sqlite:///' + str(tmp_path / 'test.db'))
    class Blocked:
        def get(self, url):
            raise SourceBlocked('403')
    assert run_sync(db, Blocked(), 10, source_key='fragrantica')['status'] == 'blocked'
    assert run_sync(db, Pages('parfumo'), 10, source_key='parfumo')['processed'] == 2


def test_legacy_sqlite_migration_is_repeatable(tmp_path):
    path = tmp_path / 'legacy.db'
    with sqlite3.connect(path) as conn:
        conn.executescript('''
        CREATE TABLE perfumes (id INTEGER PRIMARY KEY, source_url VARCHAR(2048) UNIQUE NOT NULL,
        name VARCHAR(512) NOT NULL, brand VARCHAR(512), data JSON NOT NULL,
        updated_at VARCHAR(40) NOT NULL, last_checked_at VARCHAR(40) NOT NULL);
        INSERT INTO perfumes VALUES (123, 'https://www.fragrantica.com/perfume/Test/One-123.html',
        'Legacy', 'Test', '{}', '2020-01-01', '2020-01-01');
        CREATE TABLE jobs (url VARCHAR(2048) PRIMARY KEY, kind VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL, attempts INTEGER NOT NULL, available_at VARCHAR(40) NOT NULL, error TEXT);
        INSERT INTO jobs VALUES ('https://www.fragrantica.com/designers/', 'listing', 'pending', 0, '2020-01-01', NULL);
        CREATE TABLE sync_runs (id INTEGER PRIMARY KEY, started_at VARCHAR(40) NOT NULL,
        finished_at VARCHAR(40), status VARCHAR(30) NOT NULL, processed INTEGER NOT NULL, failed INTEGER NOT NULL, error TEXT);
        ''')
    for _ in range(2):
        db = database('sqlite:///' + str(path))
        with db() as session:
            old = session.get(Perfume, 123)
            assert old.name == 'Legacy' and old.source == 'fragrantica' and old.source_id == '123'
            assert session.get(Job, 'https://www.fragrantica.com/designers/').source == 'fragrantica'
    run_sync(db, Pages('parfumo'), 10, source_key='parfumo')
    with db() as session:
        assert len(list(session.scalars(select(Perfume)))) == 2
