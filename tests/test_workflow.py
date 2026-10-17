from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from fraggy.api import create_app
from fraggy.db import database, Perfume, Job
from fraggy.source import BASE, SourceBlocked, canonical, discover, parse_perfume
from fraggy.sync import run_sync, worker_lock

URL = BASE + '/perfume/Test/Example-123.html'
HTML = '''<h1 itemprop="name">Example for women and men</h1>
<a class="brand" href="/designers/Test.html">Test</a>
<div itemprop="description">Launched in 2020.</div>
<h4>Top Notes</h4><div><a href="/notes/Bergamot-1.html">Bergamot</a></div>
<span itemprop="ratingValue">4.25</span><span itemprop="ratingCount">1,234</span>
<div class="accord-bar">citrus</div><img itemprop="image" src="/image.jpg">
<p>Perfume longevity: <span>3</span> out of <span>5</span>.</p>'''


class FixtureSource:
    def __init__(self):
        self.html = HTML
    def get(self, url):
        if url.endswith('/designers/'):
            return '<a href="/designers/Test.html">Test</a>'
        if url.endswith('/designers/Test.html'):
            return f'<a href="{URL}">Example</a>'
        return self.html


@pytest.fixture
def db(tmp_path):
    return database('sqlite:///' + str(tmp_path / 'catalog.db'))


def test_parse_and_url_validation():
    identity, data = parse_perfume(HTML, URL)
    assert identity == 123
    assert data['notes_top'] == ['Bergamot']
    assert data['gender'] == 'unisex'
    assert data['votes'] == 1234
    assert data['longevity'] == {'value': 3, 'scale': 5}
    for url in ['https://evil.test/fragrantica.com/perfume/a', 'http://www.fragrantica.com/', 'https://www.fragrantica.com:999/a']:
        with pytest.raises(ValueError):
            canonical(url)
    with pytest.raises(ValueError):
        parse_perfume('<title>Challenge</title>', URL)
    assert discover('<a href="https://evil.test/perfume/a/b-1.html">bad</a>', BASE) == {}


def test_import_update_and_api(db):
    source = FixtureSource()
    result = run_sync(db, source, 10)
    assert result['processed'] == 3 and result['failed'] == 0
    with db.begin() as session:
        perfume = session.scalar(select(Perfume).where(Perfume.source == 'fragrantica', Perfume.source_id == '123'))
        old_updated = perfume.updated_at
        perfume_id = perfume.id
        perfume.last_checked_at = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    # An identical refresh preserves updated_at.
    run_sync(db, source, 10)
    with db.begin() as session:
        perfume = session.scalar(select(Perfume).where(Perfume.source == 'fragrantica', Perfume.source_id == '123'))
        assert perfume.updated_at == old_updated
        perfume.last_checked_at = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    source.html = HTML.replace('4.25', '4.50')
    run_sync(db, source, 10)
    with TestClient(create_app(db)) as client:
        assert client.get('/health').json() == {'status': 'ok'}
        response = client.get('/v1/perfumes?q=example&brand=test').json()
        assert response['total'] == 1
        assert response['items'][0]['rating'] == 4.5
        assert client.get(f'/v1/perfumes/{perfume_id}').status_code == 200
        assert client.get('/v1/perfumes/999').status_code == 404
        assert client.get('/v1/perfumes?limit=0').status_code == 422
        assert client.get('/v1/perfumes?q=%').json()['total'] == 0
        assert client.get('/v1/brands').json()['items'][0]['perfume_count'] == 1
        assert client.get('/v1/sync/status').json()['last_run']['status'] == 'completed'


def test_blocked_source_records_retry(db):
    class Blocked:
        def get(self, url):
            raise SourceBlocked('403')
    result = run_sync(db, Blocked(), 10)
    assert result['status'] == 'blocked' and result['failed'] == 1
    with db() as session:
        job = session.get(Job, BASE + '/designers/')
        assert job.status == 'pending' and job.attempts == 1
        assert job.available_at > datetime.now(timezone.utc).isoformat()


def test_resume_and_failure_preserves_catalog(db):
    source = FixtureSource()
    run_sync(db, source, 2)
    with db.begin() as session:
        job = session.get(Job, URL)
        assert job.status == 'pending'
        job.status = 'running'
    run_sync(db, source, 10)
    with db.begin() as session:
        session.scalar(select(Perfume).where(Perfume.source == 'fragrantica', Perfume.source_id == '123')).last_checked_at = '2000-01-01'
    source.html = '<html>Unexpected page</html>'
    result = run_sync(db, source, 10)
    assert result['failed'] == 1
    with db() as session:
        assert session.scalar(select(Perfume).where(Perfume.source == 'fragrantica', Perfume.source_id == '123')).data['rating'] == 4.25
        assert session.get(Job, URL).status == 'pending'


def test_single_worker_lock(tmp_path, monkeypatch):
    monkeypatch.setenv('SYNC_LOCK_PATH', str(tmp_path / 'sync.lock'))
    with worker_lock():
        with pytest.raises(RuntimeError):
            with worker_lock():
                pass


def test_source_respects_robots_and_stops_on_429(monkeypatch):
    import httpx
    from fraggy.source import Source
    monkeypatch.setattr('fraggy.source.time.sleep', lambda _: None)
    requests = []
    def handler(request):
        requests.append(request.url.path)
        if request.url.path == '/robots.txt':
            return httpx.Response(200, text='User-agent: *\nDisallow: /private/\n')
        return httpx.Response(429, text='Too many requests')
    source = Source()
    source.client.close()
    source.client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(SourceBlocked, match='robots'):
        source.get(BASE + '/private/test')
    assert requests == ['/robots.txt']
    with pytest.raises(SourceBlocked, match='429'):
        source.get(URL)
    assert requests == ['/robots.txt', '/perfume/Test/Example-123.html']
    source.close()
