"""Temporary PostgreSQL integration. Socket-only, no public listener or retained data."""
import argparse
import subprocess
import time
from uuid import uuid4


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--image', default='fraggyapi-validation:local')
    args = parser.parse_args()
    key = uuid4().hex[:10]
    name, volume = 'fraggy-pg-' + key, 'fraggy-pg-socket-' + key
    web = 'fraggy-pg-web-' + key
    def docker(*command,input=None):
        return subprocess.run(['docker',*command],input=input,text=True,capture_output=True,check=True).stdout
    try:
        docker('volume','create',volume)
        # Trust is limited to an isolated throwaway Unix socket, with TCP disabled.
        docker('run','-d','--name',name,'--network','none','--mount',f'type=volume,source={volume},target=/var/run/postgresql',
               '-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16-alpine','-c',"listen_addresses=")
        for _ in range(100):
            if subprocess.run(['docker','exec',name,'pg_isready','-q','-U','postgres'],capture_output=True).returncode == 0:break
            time.sleep(0.2)
        else:raise RuntimeError('PostgreSQL did not start')
        code = '''
import json
from sqlalchemy import create_engine,text,select,func
from fastapi.testclient import TestClient
from fraggy.db import database,Perfume,CanonicalLink,MatchEvent,Job
from fraggy.api import create_app
from fraggy.sync import run_sync
url='postgresql+psycopg://postgres@/postgres?host=/pgsocket'
engine=create_engine(url)
legacy={'name':'Example','brand':'Test','concentration':'EDP','release_year':2020,'rating':4.25}
with engine.begin() as c:
 c.execute(text("CREATE TABLE perfumes (id INTEGER PRIMARY KEY, source_url VARCHAR(2048) UNIQUE NOT NULL, name VARCHAR(512) NOT NULL, brand VARCHAR(512), data JSON NOT NULL, updated_at VARCHAR(40) NOT NULL, last_checked_at VARCHAR(40) NOT NULL)"))
 c.execute(text("INSERT INTO perfumes VALUES (123, 'https://www.fragrantica.com/perfume/Test/Example-123.html', 'Example', 'Test', CAST(:data AS JSON), '2020-01-01', '2020-01-02')"),{'data':json.dumps(legacy)})
factory=database(url)
for _ in range(2):
 factory=database(url)
 with factory() as s:
  old=s.get(Perfume,123)
  assert old.source=='fragrantica' and old.source_id=='123' and old.extraction=={}
  assert old.data==legacy and old.updated_at=='2020-01-01' and old.last_checked_at=='2020-01-02'
class Fixture:
 def get(self,url):
  if url.endswith('/Brands'):return '<a href="/Perfumes/Test/Example">Example</a>'
  return '<script type="application/ld+json">'+json.dumps({'@type':'Product','name':'Example','brand':'Test','concentration':'EDP','releaseDate':'2020','aggregateRating':{'ratingValue':8,'bestRating':10,'worstRating':1}})+'</script>'
for _ in range(2):
 result=run_sync(factory,Fixture(),10,source_key='parfumo')
 assert result['failed']==0
from fraggy.catalog import match_record
with factory.begin() as s:
 for record in s.scalars(select(Perfume)):match_record(s,record)
 assert s.scalar(select(func.count()).select_from(Perfume))==2
 new=s.scalar(select(Perfume).where(Perfume.source=='parfumo'))
 assert new.id>123
 assert s.get(Perfume,123).data==legacy
 assert s.get(CanonicalLink,123).canonical_id==s.get(CanonicalLink,new.id).canonical_id
with TestClient(create_app(factory)) as client:
 assert client.get('/health').status_code==200
 result=client.get('/v1/perfumes?canonical=true').json()
 assert result['total']==1
 assert client.get('/v1/canonical-perfumes/'+result['items'][0]['id']+'/sources').json()['total']==2
with factory.kw['bind'].begin() as c:
 c.execute(text('CREATE ROLE fraggy_reader LOGIN'))
 c.execute(text('GRANT USAGE ON SCHEMA public TO fraggy_reader'))
 c.execute(text('GRANT SELECT ON ALL TABLES IN SCHEMA public TO fraggy_reader'))
print('PASS: PostgreSQL 16 legacy migration, preserved source data, ID sequence, repeated import, canonical matching and API')
'''
        print(docker('run','--rm','-i','--network','none','--mount',f'type=volume,source={volume},target=/pgsocket',
                     '--entrypoint','python',args.image,'-',input=code).strip())
        docker('run', '-d', '--name', web, '--read-only', '--network', 'none',
               '--mount', f'type=volume,source={volume},target=/pgsocket',
               '-e', 'DATABASE_URL=postgresql+psycopg://fraggy_reader@/postgres?host=/pgsocket',
               '-e', 'DATABASE_AUTO_MIGRATE=false', '-e', 'PORT=10000',
               '-e', 'PYTHONDONTWRITEBYTECODE=1', args.image)
        smoke = """
import json, urllib.request
base='http://127.0.0.1:10000'
def get(path):
 with urllib.request.urlopen(base+path, timeout=3) as response:return json.load(response)
assert get('/health')=={'status':'ok'}
result=get('/v1/canonical-perfumes')
assert result['total']==1
record=get('/v1/canonical-perfumes/'+result['items'][0]['id'])
assert record['selection']['canonical_id']==record['id']
assert get('/v1/canonical-perfumes/'+record['id']+'/sources')['total']==2
"""
        for _ in range(50):
            check = subprocess.run(['docker','exec',web,'python','-c',smoke],capture_output=True)
            if check.returncode == 0:break
            time.sleep(0.2)
        else:raise RuntimeError('Read-only web startup/health/search/shelf checks failed')
        print('PASS: read-only PostgreSQL role, read-only root filesystem, assigned PORT=10000, actual HTTP health/search/shelf/provenance')
    finally:
        subprocess.run(['docker','rm','-f','-v',web],capture_output=True)
        subprocess.run(['docker','rm','-f','-v',name],capture_output=True)
        subprocess.run(['docker','volume','rm',volume],capture_output=True)


if __name__=='__main__':main()
