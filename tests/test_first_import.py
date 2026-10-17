import argparse
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from fraggy.api import create_app
from fraggy.db import database, Perfume, Job, CanonicalLink, CanonicalPerfume
from fraggy.first_import import (product_urls, api_url, attended_import, verify_records,
                                backup_sqlite, FirstImportError)
from fraggy.source import SourceBlocked
from fraggy.sync import run_sync

BASE='https://www.fragrantica.com'


def urls(count=10):
    return [BASE+f'/perfume/Test/Example-{index}.html' for index in range(100,100+count)]


class Pages:
    def __init__(self):self.calls=[]
    def get(self,url):
        self.calls.append(url)
        identity=int(url.rsplit('-',1)[1].split('.')[0])
        return f'''<h1 itemprop="name">Example {identity} EDP</h1><a class="brand">Test</a>
        <div itemprop="description">Launched in 2020.</div><span itemprop="ratingValue">4.25</span>'''


@pytest.fixture
def db(tmp_path):return database('sqlite:///'+str(tmp_path/'test.db'))


def test_first_import_ten_records_search_shelf_and_repeat_without_duplicates(db):
    source=Pages()
    with TestClient(create_app(db)) as client:
        result=attended_import(db,source,'fragrantica',urls(),client)
        assert result['success'] and len(result['verified_records'])==10
        assert len(source.calls)==10 and set(source.calls)==set(urls())
        first={item['record_id']:item['canonical_id'] for item in result['verified_records']}
        assert all(item['shelf_reference']['canonical_id']==item['canonical_id'] for item in result['verified_records'])
        assert all(not item['requires_review'] for item in result['verified_records'])
        with db() as session:
            unchanged={row.id:(deepcopy(row.data),row.updated_at) for row in session.scalars(select(Perfume))}
        repeated=attended_import(db,source,'fragrantica',urls(),client)
        assert repeated['success'] and {item['record_id']:item['canonical_id'] for item in repeated['verified_records']}==first
        with db() as session:
            assert session.scalar(select(func.count()).select_from(Perfume))==10
            assert session.scalar(select(func.count()).select_from(CanonicalPerfume))==10
            assert {row.id:(row.data,row.updated_at) for row in session.scalars(select(Perfume))}==unchanged
        assert result['live_source_validation']=='not_established_by_this_check'
        assert result['unattended_scraping_enabled'] is False


def test_targeted_workflow_does_not_consume_or_recover_unrelated_jobs(db):
    with db.begin() as session:
        session.add(Job(url=BASE+'/designers/',source='fragrantica',kind='listing',status='running'))
        session.add(Job(url=urls(2)[1],source='fragrantica',kind='perfume',status='pending'))
    pages=Pages()
    result=run_sync(db,pages,10,source_key='fragrantica',target_urls=urls(1))
    assert result['processed']==1 and pages.calls==urls(1)
    with db() as session:
        assert session.get(Job,BASE+'/designers/').status=='running'
        assert session.get(Job,urls(2)[1]).status=='pending'


@pytest.mark.parametrize('values,limit',[(urls(11),10),(urls(1),0),([],10),(['https://evil.test/perfume/Test/One-1.html'],10),([BASE+'/designers/'],10),([urls(1)[0]+'?token=secret'],10),(['http://www.fragrantica.com/perfume/Test/One-1.html'],10)])
def test_invalid_or_excess_product_urls_rejected_before_import(values,limit):
    with pytest.raises(FirstImportError):product_urls('fragrantica',values,limit)


def test_duplicate_url_lines_canonicalized_and_comments_allowed():
    assert product_urls('fragrantica',['# selected by operator','',urls(1)[0],urls(1)[0]])==urls(1)
    with pytest.raises(argparse.ArgumentTypeError):api_url('https://user:password@example.test')
    with pytest.raises(argparse.ArgumentTypeError):api_url('http://public.example.test')
    assert api_url('https://staging.example.test/')=='https://staging.example.test'


def test_block_stops_without_fake_verification_and_respects_retry(db):
    class Blocked:
        def __init__(self):self.calls=0
        def get(self,url):
            self.calls+=1
            raise SourceBlocked('Denied',kind='robots_denied',retry_after=7200)
    source=Blocked()
    with TestClient(create_app(db)) as client:
        result=attended_import(db,source,'fragrantica',urls(2),client)
        assert not result['success'] and result['sync']['status']=='blocked'
        assert result['verified_records']==[] and source.calls==1
        assert result['sync']['jobs'][0]['error_kind']=='robots_denied'
        repeated=attended_import(db,source,'fragrantica',urls(1),client)
        assert repeated['sync']['status']=='deferred' and source.calls==1
    with db() as session:assert session.scalar(select(func.count()).select_from(Perfume))==0


def test_verification_rejects_api_for_different_database(db,tmp_path):
    result=run_sync(db,Pages(),1,source_key='fragrantica',target_urls=urls(1))
    other=database('sqlite:///'+str(tmp_path/'other.db'))
    with TestClient(create_app(other)) as client:
        with pytest.raises(Exception):verify_records(db,result['record_ids'],client)


def test_sqlite_backup_and_external_backup_acknowledgement(db,tmp_path):
    run_sync(db,Pages(),1,source_key='fragrantica',target_urls=urls(1))
    backup=backup_sqlite(str(db.kw['bind'].url),tmp_path/'backups')
    with sqlite3.connect(backup['path']) as connection:
        assert connection.execute('select count(*) from perfumes').fetchone()[0]==1
    with pytest.raises(FirstImportError):backup_sqlite('postgresql+psycopg://user@localhost/test',tmp_path)
    assert backup_sqlite('postgresql+psycopg://user@localhost/test',tmp_path,True)['operator_confirmed']


def test_cli_requires_authorization_and_writes_no_db_without_it(tmp_path):
    env={**os.environ,'DATABASE_URL':'sqlite:///'+str(tmp_path/'should-not-exist.db')}
    result=subprocess.run([sys.executable,'-m','fraggy.first_import','--source','fragrantica','--urls-file',str(tmp_path/'urls'),
        '--operator','test','--permission-reference','agreement','--api-base-url','http://127.0.0.1:8000'],env=env,text=True,capture_output=True)
    assert result.returncode==2 and '--authorized' in result.stderr
    assert not (tmp_path/'should-not-exist.db').exists()


def test_failed_api_verification_reports_committed_ids(db,tmp_path):
    other=database('sqlite:///'+str(tmp_path/'other.db'))
    with TestClient(create_app(other)) as client:
        report=attended_import(db,Pages(),'fragrantica',urls(1),client)
    assert not report['success'] and report['verification_error']
    assert len(report['sync']['record_ids'])==1 and report['verified_records']==[]


def test_staging_compose_has_no_worker_or_cloud_paths():
    import yaml
    config=yaml.safe_load(Path('compose.staging.yaml').read_text())
    assert list(config['services'])==['api']
    assert config['services']['api']['ports'][0].startswith('127.0.0.1:')
    assert '/workspace/' not in Path('compose.staging.yaml').read_text()


def test_package_inventory_excludes_local_credentials_and_data(tmp_path):
    from scripts.package_backend import REQUIRED, build, verify
    import zipfile
    root=tmp_path/'source'
    for name in REQUIRED:
        file=root/name;file.parent.mkdir(parents=True,exist_ok=True);file.write_text('fixture '+name)
    (root/'.env.staging').write_text('PRIVATE_TOKEN=must-not-export')
    (root/'var').mkdir();(root/'var'/'catalog.sqlite').write_text('private database')
    output=tmp_path/'package.zip'
    result=build(root,output)
    assert verify(output)['files_verified']==len(REQUIRED)
    with zipfile.ZipFile(output) as archive:
        assert not any(name.endswith('.env.staging') or '/var/' in name for name in archive.namelist())
    assert output.with_suffix('.sha256').exists() and result['sha256']
    with pytest.raises(ValueError,match='overwrite'):build(root,output)


def test_package_rejects_missing_migrations_and_tampered_content(tmp_path):
    from scripts.package_backend import REQUIRED, build, verify
    import zipfile
    root=tmp_path/'source'
    for name in REQUIRED:
        file=root/name;file.parent.mkdir(parents=True,exist_ok=True);file.write_text('fixture '+name)
    (root/'fraggy/db.py').unlink()
    with pytest.raises(ValueError,match='missing'):build(root,tmp_path/'missing.zip')
    (root/'fraggy/db.py').write_text('retained migration fixture')
    good=tmp_path/'good.zip';build(root,good)
    broken=tmp_path/'broken.zip'
    with zipfile.ZipFile(good) as original,zipfile.ZipFile(broken,'w') as archive:
        for name in original.namelist():
            archive.writestr(name,b'tampered' if name=='FraggyAPI/fraggy/db.py' else original.read(name))
    with pytest.raises(ValueError,match='Checksum mismatch'):verify(broken)
