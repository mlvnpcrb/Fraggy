"""Isolated Docker smoke test. No public ports, live scraping, or retained deployment."""
import argparse
import json
import subprocess
import time
from uuid import uuid4


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--image', default='fraggyapi-validation:local')
    args = parser.parse_args()
    suffix = uuid4().hex[:12]
    container, volume = 'fraggy-test-' + suffix, 'fraggy-test-data-' + suffix

    def docker(*command, input=None):
        result = subprocess.run(['docker', *command], input=input, text=True, capture_output=True)
        if result.returncode:
            raise RuntimeError('Docker validation command failed: ' + result.stderr[-4000:])
        return result.stdout.strip()

    def python(code):
        return docker('exec', '-i', container, 'python', '-', input=code)

    def wait_healthy():
        for _ in range(60):
            try:
                assert json.loads(python("import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').read().decode())")) == {'status': 'ok'}
                return
            except (subprocess.CalledProcessError, AssertionError, RuntimeError):
                time.sleep(0.25)
        logs = subprocess.run(['docker', 'logs', container], text=True, capture_output=True)
        raise RuntimeError('API did not become healthy: ' + logs.stdout + logs.stderr)

    def start():
        docker('run', '-d', '--name', container, '--network', 'none', '--mount', f'type=volume,source={volume},target=/app/var', args.image)
        wait_healthy()

    verify = '''
import json, urllib.request
from sqlalchemy import select
from fraggy.db import database, Perfume, CanonicalLink, Job, Run, MatchEvent
with database()() as session:
    perfume = session.scalar(select(Perfume))
    link = session.get(CanonicalLink, perfume.id)
    result = {'id': perfume.id, 'source': perfume.source, 'source_id': perfume.source_id,
        'source_url': perfume.source_url, 'data': perfume.data, 'extraction': perfume.extraction,
        'updated_at': perfume.updated_at, 'last_checked_at': perfume.last_checked_at,
        'canonical': link.canonical_id,
        'jobs': [(j.url, j.status) for j in session.scalars(select(Job).order_by(Job.url))],
        'runs': [(r.id, r.status) for r in session.scalars(select(Run).order_by(Run.id))],
        'events': [e.id for e in session.scalars(select(MatchEvent))]}
    detail = json.load(urllib.request.urlopen('http://127.0.0.1:8000/v1/perfumes/' + str(perfume.id)))
    assert detail['rating'] == 4.25
    catalog = json.load(urllib.request.urlopen('http://127.0.0.1:8000/v1/perfumes?canonical=true'))
    assert catalog['total'] == 1
    sources = json.load(urllib.request.urlopen('http://127.0.0.1:8000/v1/canonical-perfumes/' + link.canonical_id + '/sources'))
    assert sources['total'] == 1 and sources['items'][0]['source_id'] == '123'
    print(json.dumps(result, sort_keys=True))
'''
    try:
        docker('volume', 'create', volume)
        start()
        python('''
from fraggy.sync import run_sync, worker_lock
from fraggy.db import database
class Fixture:
    def get(self, url):
        if url.endswith('/designers/'):
            return '<a href="/designers/Test.html">Test</a>'
        if url.endswith('/designers/Test.html'):
            return '<a href="/perfume/Test/Example-123.html">Example</a>'
        return '<h1 itemprop="name">Example EDP</h1><a class="brand">Test</a><div itemprop="description">Launched in 2020.</div><span itemprop="ratingValue">4.25</span>'
with worker_lock():
    result = run_sync(database(), Fixture(), 10)
assert result['processed'] == 3 and result['failed'] == 0
''')
        before = json.loads(python(verify))
        docker('restart', container)
        wait_healthy()
        assert json.loads(python(verify)) == before, 'Database changed after restart'
        docker('stop', container)
        docker('rm', container)
        start()
        after = json.loads(python(verify))
        assert before == after, 'Database changed after container recreation'
        docker('exec', container, 'python', '-m', 'fraggy.sync', '--help')
        python('''
import json,sys,httpx
from pathlib import Path
from unittest.mock import patch
from sqlalchemy import select,func
from fraggy import first_import
from fraggy.db import database,Perfume,CanonicalLink
paths=['https://www.fragrantica.com/perfume/Test/Fixture-'+str(number)+'.html' for number in range(1000,1010)]
Path('var/fixture-urls.txt').write_text(chr(10).join(paths))
class SyntheticSource:
 calls=[]
 def __init__(self,**kwargs):self.responses=[]
 def get(self,url):
  self.calls.append(url)
  number=url.rsplit('-',1)[1].split('.')[0]
  return '<h1 itemprop="name">Fixture '+number+' EDP</h1><a class="brand">Test</a><div itemprop="description">Launched in 2020.</div>'
 def close(self):pass
arguments=['first-import','--source','fragrantica','--urls-file','var/fixture-urls.txt','--limit','10','--authorized',
 '--operator','synthetic-test','--permission-reference','synthetic-fixture-only','--api-base-url','http://127.0.0.1:8000',
 '--report','var/fixture-first-import.json']
original=None
for _ in range(2):
 with patch.object(first_import,'Source',SyntheticSource),patch.object(sys,'argv',arguments):
  try:first_import.main()
  except SystemExit as result:assert result.code==0
 receipt=json.loads(Path('var/fixture-first-import.json').read_text())
 assert receipt['success'] and len(receipt['verified_records'])==10
 assert receipt['live_source_validation']=='not_established_by_this_check'
 assert receipt['http_observations']==[]
 with database()() as session:
  records=list(session.scalars(select(Perfume).where(Perfume.source_url.in_(paths)).order_by(Perfume.id)))
  state=[(row.id,row.updated_at,row.data,session.get(CanonicalLink,row.id).canonical_id) for row in records]
  assert len(records)==10
  if original is None:original=state
  else:assert state==original
assert len(SyntheticSource.calls)==20
print('PASS: synthetic first-import CLI through real local HTTP, ten-record cap, repeat deduplication and shelf references')
''')
        print('PASS: non-root Docker API startup, fixture worker import, canonical API, and source/queue/audit persistence after restart and container recreation')
    finally:
        subprocess.run(['docker', 'rm', '-f', container], capture_output=True)
        subprocess.run(['docker', 'volume', 'rm', volume], capture_output=True)


if __name__ == '__main__':
    main()
