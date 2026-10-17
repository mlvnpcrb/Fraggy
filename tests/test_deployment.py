import pytest
from sqlalchemy import event
from fastapi.testclient import TestClient
from fraggy.db import database
from fraggy.api import create_app


def test_explicit_migration_then_web_is_read_only(tmp_path, monkeypatch):
    url = 'sqlite:///'+str(tmp_path/'catalog.db')
    factory = database(url, initialize=True)
    factory.kw['bind'].dispose()
    monkeypatch.setenv('DATABASE_AUTO_MIGRATE', 'false')
    readonly = database(url)
    statements = []
    event.listen(readonly.kw['bind'], 'before_cursor_execute', lambda c, cur, sql, p, ctx, many: statements.append(sql))
    with TestClient(create_app(readonly)) as client:
        assert client.get('/health').json() == {'status':'ok'}
        assert client.get('/v1/canonical-perfumes').json()['total'] == 0
        assert client.post('/v1/sync').status_code == 404
    assert not any(s.lstrip().upper().startswith(('CREATE', 'ALTER', 'INSERT', 'UPDATE', 'DELETE')) for s in statements)


def test_missing_migration_fails_without_creating_tables(tmp_path):
    from sqlalchemy import create_engine, inspect
    url = 'sqlite:///'+str(tmp_path/'empty.db')
    with pytest.raises(RuntimeError, match='migration required'):
        database(url, initialize=False)
    assert inspect(create_engine(url)).get_table_names() == []


def test_port_and_single_api_process(monkeypatch):
    from fraggy import web
    calls = []
    monkeypatch.setenv('PORT', '10000')
    monkeypatch.setattr(web.uvicorn, 'run', lambda *a, **kw: calls.append((a, kw)))
    web.main()
    assert calls == [(('fraggy.api:app',), {'host':'0.0.0.0','port':10000,'workers':1})]


def test_frontend_cors(monkeypatch, tmp_path):
    monkeypatch.setenv('CORS_ORIGINS', 'https://fraggy-example.pages.dev')
    with TestClient(create_app(database('sqlite:///'+str(tmp_path/'db')))) as client:
        response = client.options('/v1/canonical-perfumes', headers={
            'Origin':'https://fraggy-example.pages.dev','Access-Control-Request-Method':'GET'})
        assert response.headers['access-control-allow-origin'] == 'https://fraggy-example.pages.dev'
        denied = client.options('/v1/canonical-perfumes', headers={
            'Origin':'https://untrusted.example','Access-Control-Request-Method':'GET'})
        assert 'access-control-allow-origin' not in denied.headers
