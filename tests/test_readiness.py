from datetime import datetime, timezone, timedelta
import os
import subprocess
import sys
import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from fraggy.api import create_app
from fraggy.catalog import match_record, set_brand_alias, resolve_brand, unlink
from fraggy.db import database, Perfume, CanonicalLink, now, Job
from fraggy.source import Source, SourceBlocked, retry_after_seconds
from fraggy.sources import SOURCES
from fraggy.sync import run_sync, enqueue, worker_lock


@pytest.fixture
def db(tmp_path):
    return database('sqlite:///' + str(tmp_path / 'test.db'))


def record(session, source_id, brand, concentration='EDP'):
    row = Perfume(source='parfumo', source_id=source_id, source_url='https://example.test/'+source_id,
        name='Example', brand=brand, data={'name':'Example', 'brand':brand, 'concentration':concentration, 'release_year':2020},
        updated_at=now(), last_checked_at=now(), extraction={})
    session.add(row);session.flush()
    return row


def test_brand_aliases_are_explicit_idempotent_and_cycle_safe(db):
    with db.begin() as session:
        a = record(session, '1', 'Dolce & Gabbana')
        b = record(session, '2', 'Dolce and Gabbana')
        assert match_record(session, a) == match_record(session, b)
        decision = set_brand_alias(session, 'D&G', 'Dolce and Gabbana', 'operator', 'Verified brand identity')
        assert set_brand_alias(session, 'D&G', 'Dolce and Gabbana', 'operator', 'Same') == decision
        c = record(session, '3', 'D&G')
        assert match_record(session, c) == match_record(session, a)
        with pytest.raises(ValueError, match='cycle'):
            set_brand_alias(session, 'Dolce and Gabbana', 'D&G', 'operator', 'Invalid')
        set_brand_alias(session, 'D&G', 'D&G', 'operator', 'Undo alias')
        assert resolve_brand(session, 'D&G') == 'd and g'


def test_canonical_selection_and_retained_ids(db, monkeypatch):
    monkeypatch.setenv('API_CACHE_TTL_SECONDS','0')
    with db.begin() as session:
        row = record(session, '1', 'Test')
        identity = match_record(session, row)
        source_id = row.id
    with TestClient(create_app(db)) as client:
        detail = client.get('/v1/canonical-perfumes/'+identity).json()
        assert detail['selection'] == {'canonical_id':identity,'requires_review':False,'eligible_for_trading':True}
        assert detail['attribution'][0]['record_id'] == source_id
        assert 'rating' not in detail
        with db.begin() as session:
            unlink(session,source_id,'operator','Incorrect association')
        retained = client.get('/v1/canonical-perfumes/'+identity)
        assert retained.status_code == 200 and retained.json()['active'] is False
        assert retained.json()['selection']['requires_review']
        assert client.get('/v1/canonical-perfumes/unknown').status_code == 404


def test_etag_cache_expiry_auth_and_rate_limit(db, monkeypatch):
    clock = [100.0]
    monkeypatch.setattr('fraggy.http_policy.time.monotonic', lambda: clock[0])
    with TestClient(create_app(db)) as client:
        first = client.get('/v1/perfumes')
        assert first.status_code == 200 and first.headers['etag']
        assert client.get('/v1/perfumes',headers={'If-None-Match':first.headers['etag']}).status_code == 304
        with db.begin() as session: record(session,'1','Test')
        assert client.get('/v1/perfumes').json()['total'] == 0
        revalidated = client.get('/v1/perfumes',headers={'Cache-Control':'no-cache','If-None-Match':first.headers['etag']})
        assert revalidated.status_code == 200 and revalidated.json()['total'] == 1
        clock[0] += 6
        assert client.get('/v1/perfumes',headers={'If-None-Match':'W/'+revalidated.headers['etag']}).status_code == 304
        assert client.get('/v1/perfumes').json()['total'] == 1
        assert 'etag' not in client.get('/v1/perfumes',headers={'Authorization':'Bearer test'}).headers
    monkeypatch.setenv('API_RATE_LIMIT_PER_MINUTE','1')
    with TestClient(create_app(db)) as client:
        assert client.get('/v1/perfumes').status_code == 200
        response = client.get('/v1/perfumes')
        assert response.status_code == 429 and int(response.headers['retry-after']) > 0
        assert client.get('/health').status_code == 200
        clock[0] += 61
        assert client.get('/v1/perfumes').status_code == 200


@pytest.mark.parametrize('status,kind', [(301,'source_redirect'),(403,'source_access'),(429,'source_rate_limit')])
def test_access_diagnostics_and_retry_after(monkeypatch,status,kind):
    monkeypatch.setattr('fraggy.source.time.sleep', lambda _:None)
    source = Source(adapter=SOURCES['parfumo'])
    source.client.close()
    source.client = httpx.Client(transport=httpx.MockTransport(lambda request:httpx.Response(status,headers={'retry-after':'7200','location':'https://www.parfumo.com/elsewhere'})))
    try:
        with pytest.raises(SourceBlocked) as error:
            source._fetch('https://www.parfumo.com/robots.txt')
        assert error.value.kind == kind
        if status == 429: assert error.value.retry_after == 7200
    finally: source.close()
    assert retry_after_seconds('NaN') is None
    assert retry_after_seconds('invalid') is None


def test_retry_after_persists_and_terminal_jobs_do_not_reset(db):
    class Limited:
        def get(self,url):raise SourceBlocked('429',kind='source_rate_limit',retry_after=7200)
    run_sync(db,Limited(),1,source_key='parfumo')
    with db.begin() as session:
        job = session.get(Job,'https://www.parfumo.com/Brands')
        assert datetime.fromisoformat(job.available_at) > datetime.now(timezone.utc)+timedelta(seconds=7000)
        job.status,job.attempts = 'failed',5
        enqueue(session,job.url,'listing',refresh=True,source_key='parfumo')
        assert job.status == 'failed' and job.attempts == 5


def test_unattended_scraping_is_disabled_until_confirmed(tmp_path):
    env = {**os.environ,'DATABASE_URL':'sqlite:///'+str(tmp_path/'test.db'),
           'SCRAPING_APPROVED_SOURCES':'','LIVE_VALIDATED_SOURCES':''}
    command = subprocess.run([sys.executable,'-m','fraggy.sync','--daily','--sources','parfumo'],env=env,text=True,capture_output=True)
    assert command.returncode == 2 and 'requires each selected source' in command.stderr
    assert not (tmp_path/'test.db').exists()


def test_worker_lock_blocks_an_independent_process(tmp_path,monkeypatch):
    path = str(tmp_path/'worker.lock')
    monkeypatch.setenv('SYNC_LOCK_PATH',path)
    with worker_lock():
        process = subprocess.run([sys.executable,'-c','from fraggy.sync import worker_lock\nwith worker_lock(): pass'],text=True,capture_output=True)
    assert process.returncode != 0 and 'Another sync worker' in process.stderr


def test_trigram_index_preserves_literal_search_and_tracks_updates(db,monkeypatch):
    from sqlalchemy import or_
    monkeypatch.setenv('API_CACHE_TTL_SECONDS','0')
    assert db.kw['bind'].fraggy_trigram
    names=['N° 5 Eau de Parfum','Rose  &  Oud','ABC_100% perfume','Éclat d’Amour','Two "Quoted" Notes']
    with db.begin() as session:
        for index,name in enumerate(names):
            row=record(session,str(index),'Brand')
            row.name=name;row.data={**row.data,'name':name}
    with TestClient(create_app(db)) as client:
        for query in ['Parfum','Rose','  &  ','100%','ABC_','Éclat','Quoted','"Quoted"','N°','\x00xx']:
            escaped=query.replace('\\','\\\\').replace('%','\\%').replace('_','\\_')
            with db() as session:
                expected=len(list(session.scalars(select(Perfume).where(or_(Perfume.name.ilike('%'+escaped+'%',escape='\\'),Perfume.brand.ilike('%'+escaped+'%',escape='\\'))))))
            result=client.get('/v1/perfumes',params={'q':query})
            assert result.status_code==200 and result.json()['total']==expected
        with db.begin() as session:
            row=session.scalar(select(Perfume).where(Perfume.source_id=='0'))
            row.name='Renamed perfume'
        assert client.get('/v1/perfumes?q=Renamed').json()['total']==1
        assert client.get('/v1/perfumes?q=Parfum').json()['total']==0
