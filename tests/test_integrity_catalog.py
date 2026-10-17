from copy import deepcopy
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from fraggy.api import create_app
from fraggy.catalog import match_record, manual_link, unlink, undo, reject_review, profile
from fraggy.db import database, Perfume, CanonicalLink, CanonicalPerfume, MatchReview, MatchEvent, now
from fraggy.extraction import Extraction, merge_extraction
from fraggy.sources import parse_product
from fraggy.source import parse_perfume
from fraggy.sync import run_sync
from test_workflow import FixtureSource, HTML, URL


@pytest.fixture
def db(tmp_path):
    return database('sqlite:///' + str(tmp_path / 'catalog.db'))


def add_record(session, source='parfumo', source_id='1', name='Example', brand='Maison Test',
               concentration='EDP', year=2020, rating=8):
    record = Perfume(source=source, source_id=source_id,
        source_url=f'https://example.test/{source}/{source_id}', name=name, brand=brand,
        data={'name': name, 'brand': brand, 'concentration': concentration, 'release_year': year,
              'rating': rating, 'rating_scale': {'min': 1, 'max': 10 if source == 'parfumo' else 5}},
        extraction={}, updated_at=now(), last_checked_at=now())
    session.add(record)
    session.flush()
    return record


def test_field_states_and_explicit_empty():
    before = {'notes_top': ['Rose'], 'brand': 'Test', 'description': 'Original', 'rating': 4.2}
    observation = Extraction({'notes_top': [], 'brand': None, 'description': '', 'rating': None},
                             {'notes_top': 'uncertain', 'description': 'empty', 'rating': 'uncertain'})
    values, evidence = merge_extraction(before, observation)
    assert values == {**before, 'description': ''}
    assert evidence['notes_top']['state'] == 'uncertain'
    assert evidence['brand']['state'] == 'missing'
    assert evidence['description']['state'] == 'empty'
    cleared, states = merge_extraction(values, Extraction({'notes_top': []}, {'notes_top': 'empty'}), evidence)
    assert cleared['notes_top'] == [] and states['notes_top']['last_success_at']
    assert before['notes_top'] == ['Rose']  # no input mutation


def test_partial_repeated_sync_preserves_values_and_api_contract(db):
    source = FixtureSource()
    run_sync(db, source, 10)
    with db.begin() as session:
        record = session.scalar(select(Perfume))
        identity, original, updated = record.id, deepcopy(record.data), record.updated_at
        record.last_checked_at = '2000-01-01'
    source.html = '<h1 itemprop="name">Example for women and men</h1><span itemprop="ratingValue">broken</span><h4>Top Notes</h4><div>Loading</div>'
    for _ in range(3):
        result = run_sync(db, source, 10)
        assert result['failed'] == 0
        with db.begin() as session:
            record = session.get(Perfume, identity)
            assert record.data == original
            assert record.brand == original['brand']
            assert record.updated_at == updated
            assert record.extraction['brand']['state'] == 'missing'
            assert record.extraction['rating']['state'] == 'uncertain'
            assert record.extraction['notes_top']['state'] == 'uncertain'
            record.last_checked_at = '2000-01-01'
    with TestClient(create_app(db)) as client:
        payload = client.get(f'/v1/perfumes/{identity}').json()
        assert set(payload) == set(original) | {'id', 'source', 'source_id', 'source_url', 'updated_at', 'last_checked_at'}
        assert client.get(f'/v1/perfumes/{identity}/extraction').json()['fields']['brand']['state'] == 'missing'
        assert client.get('/v1/perfumes/9999/extraction').status_code == 404


def test_jsonld_missing_vs_explicit_empty_and_uncertain():
    def parse(value):
        return parse_product('<script type="application/ld+json">' + json.dumps({'@type': 'Product', 'name': 'One', **value}) + '</script>', 'https://example.test/one')[1]
    missing = parse({})
    empty = parse({'offers': [], 'description': ''})
    broken = parse({'offers': 'broken', 'aggregateRating': {'ratingValue': 'no'}})
    assert missing.states['offers'] == 'missing'
    assert empty.states['offers'] == empty.states['description'] == 'empty'
    assert broken.states['offers'] == broken.states['rating'] == 'uncertain'
    merged, _ = merge_extraction({'offers': [{'price': '20'}], 'description': 'Original'}, missing)
    assert merged['offers'] == [{'price': '20'}] and merged['description'] == 'Original'
    merged, _ = merge_extraction(merged, empty)
    assert merged['offers'] == [] and merged['description'] == ''


def test_cross_source_duplicates_are_idempotent_and_preserve_sources(db):
    with db.begin() as session:
        first = add_record(session, name='Éxample Eau de Parfum', concentration='EDP')
        second = add_record(session, source='basenotes', name='EXAMPLE EDP', brand='maison-test', concentration='Eau de Parfum', rating=4)
        originals = [(deepcopy(record.data), record.source_id, record.source_url, record.updated_at, record.last_checked_at) for record in (first, second)]
        one, two = match_record(session, first), match_record(session, second)
        assert one == two
        count = session.scalar(select(func.count()).select_from(MatchEvent))
        for record in (first, second):
            assert match_record(session, record) == one
        assert session.scalar(select(func.count()).select_from(MatchEvent)) == count
        for record, original in zip((first, second), originals):
            assert (record.data, record.source_id, record.source_url, record.updated_at, record.last_checked_at) == original
    with TestClient(create_app(db)) as client:
        raw = client.get('/v1/perfumes').json()
        assert raw['total'] == 2 and 'extraction' not in raw['items'][0]
        canonical = client.get('/v1/perfumes?canonical=true').json()
        assert canonical['total'] == 1 and 'rating' not in canonical['items'][0]
        assert canonical == client.get('/v1/canonical-perfumes').json()
        assert client.get('/v1/canonical-perfumes?q=example&source=parfumo').json()['total'] == 1
        assert client.get('/v1/canonical-perfumes?q=Éxample&brand=maison-test').json()['total'] == 1
        assert client.get('/v1/canonical-perfumes?q=%').json()['total'] == 0
        records = client.get(f'/v1/canonical-perfumes/{one}/sources').json()
        assert records['total'] == 2
        assert {item['rating'] for item in records['items']} == {8, 4}
        assert client.get(f'/v1/canonical-perfumes/{one}/sources?limit=1&offset=1').json()['items'][0]['source'] == 'basenotes'
        assert client.get('/v1/canonical-perfumes/missing/sources').status_code == 404
        assert client.get('/v1/canonical-perfumes?limit=0').status_code == 422
        assert client.get('/v1/perfumes?canonical=true&source=unknown').status_code == 422


@pytest.mark.parametrize('concentration', ['EDT', 'Parfum', 'Elixir', 'Extrait de Parfum', 'EDP Elixir'])
def test_concentration_variants_never_merge(db, concentration):
    with db.begin() as session:
        first = add_record(session)
        second = add_record(session, source_id='2', concentration=concentration)
        a, b = match_record(session, first), match_record(session, second)
        assert a != b
        assert session.scalar(select(func.count()).select_from(MatchReview)) == 0
        with pytest.raises(ValueError, match='Conflicting'):
            manual_link(session, second.id, a, 'operator', 'Attempt incompatible merge')


def test_year_mismatch_and_conflicting_concentration_are_isolated(db):
    with db.begin() as session:
        first = add_record(session)
        second = add_record(session, source_id='2', year=2021)
        third = add_record(session, source_id='3', name='Example EDT', concentration='EDP')
        assert profile(third)['uncertain']
        ids = {match_record(session, record) for record in (first, second, third)}
        assert len(ids) == 3


def test_review_accept_reject_undo_and_manual_lock(db):
    with db.begin() as session:
        first = add_record(session)
        target = match_record(session, first)
        uncertain = add_record(session, source='basenotes', concentration=None, year=None)
        provisional = match_record(session, uncertain)
        assert provisional != target
        session.flush()
        review = session.scalar(select(MatchReview).where(MatchReview.perfume_id == uncertain.id))
        assert review.status == 'pending' and 0 < review.confidence < 1
        match_record(session, uncertain)
        assert session.scalar(select(func.count()).select_from(MatchReview)) == 1
        rejection = reject_review(session, review.id, 'operator', 'Need more evidence')
        match_record(session, uncertain)
        assert review.status == 'rejected'
        undo(session, rejection, 'operator', 'Evidence received')
        assert review.status == 'pending'
        event = manual_link(session, uncertain.id, target, 'operator', 'Verified from bottle', review.id)
        assert review.status == 'accepted'
        assert match_record(session, uncertain) == target
        detached = unlink(session, uncertain.id, 'operator', 'Correction')
        assert match_record(session, uncertain) is None
        with pytest.raises(ValueError, match='later decision'):
            undo(session, event, 'operator', 'Out of order')
        undo(session, detached, 'operator', 'Restore reviewed link')
        undo(session, event, 'operator', 'Undo mistaken approval')
        assert session.get(CanonicalLink, uncertain.id).canonical_id == provisional
        assert review.status == 'pending'
        with pytest.raises(ValueError, match='Active decision'):
            undo(session, event, 'operator', 'Double undo')


def test_corrected_variant_detaches_conflicting_manual_link(db):
    with db.begin() as session:
        first = add_record(session)
        target = match_record(session, first)
        second = add_record(session, source_id='2', concentration=None)
        match_record(session, second)
        manual_link(session, second.id, target, 'operator', 'Bottle checked')
        second.data = {**second.data, 'concentration': 'EDT'}
        assert match_record(session, second) is None
        assert session.get(CanonicalLink, second.id).method == 'manual-conflict'


def test_stale_reviews_and_auto_match_undo(db):
    with db.begin() as session:
        first = add_record(session)
        match_record(session, first)
        second = add_record(session, source_id='2', year=None)
        match_record(session, second)
        session.flush()
        review = session.scalar(select(MatchReview))
        second.data = {**second.data, 'release_year': 2020}
        match_record(session, second)
        assert review.status == 'stale'
        latest = session.scalar(select(MatchEvent).where(MatchEvent.perfume_id == second.id).order_by(MatchEvent.created_at.desc()))
        previous = latest.before['canonical_id']
        undo(session, latest.id, 'operator', 'Inspect match')
        assert session.get(CanonicalLink, second.id).canonical_id == previous


def test_complete_parser_failure_preserves_everything(db):
    source = FixtureSource()
    run_sync(db, source, 10)
    with db.begin() as session:
        record = session.scalar(select(Perfume))
        record.last_checked_at = '2000-01-01'
        prior = deepcopy((record.data, record.extraction, record.updated_at, record.last_checked_at))
        canonical_id = session.get(CanonicalLink, record.id).canonical_id
        record_id = record.id
    source.html = '<h1>Challenge</h1>'
    assert run_sync(db, source, 10)['failed'] == 1
    with db() as session:
        record = session.get(Perfume, record_id)
        assert (record.data, record.extraction, record.updated_at, record.last_checked_at) == prior
        assert session.get(CanonicalLink, record.id).canonical_id == canonical_id


def test_offer_partial_fields_are_preserved():
    previous = {'offers': [{'sku': 'A', 'price': '20', 'priceCurrency': 'USD', 'availability': 'InStock'}]}
    values, _ = merge_extraction(previous, Extraction({'offers': [{'sku': 'A', 'price': '22'}]}))
    assert values['offers'] == [{**previous['offers'][0], 'price': '22'}]


@pytest.mark.parametrize('value', ['NaN', 'Infinity', '-1', 'broken'])
def test_invalid_numeric_extraction_never_overwrites(value):
    _, data = parse_perfume(HTML.replace('4.25', value), URL)
    merged, evidence = merge_extraction({'rating': 4.25}, data)
    assert merged['rating'] == 4.25 and evidence['rating']['state'] == 'uncertain'


def test_upgrade_preserves_populated_multisource_database(db):
    with db.begin() as session:
        record = add_record(session)
        record_id = record.id
        canonical_id = match_record(session, record)
        old = deepcopy((record.data, record.source_id, record.source_url, record.updated_at, record.last_checked_at))
    for _ in range(3):
        recreated = database(str(db.kw['bind'].url))
        with recreated.begin() as session:
            record = session.get(Perfume, record_id)
            assert (record.data, record.source_id, record.source_url, record.updated_at, record.last_checked_at) == old
            assert match_record(session, record) == canonical_id
            assert session.scalar(select(func.count()).select_from(MatchEvent)) == 1


def test_previous_multisource_schema_additive_migration(tmp_path):
    import sqlite3
    path = tmp_path / 'old-multisource.db'
    values = {'name': 'Example', 'brand': 'Maison Test', 'concentration': 'EDP', 'release_year': 2020, 'rating': 8}
    with sqlite3.connect(path) as conn:
        conn.execute('''CREATE TABLE perfumes (id INTEGER PRIMARY KEY, source VARCHAR(40) NOT NULL,
        source_id VARCHAR(512) NOT NULL, source_url VARCHAR(2048) UNIQUE NOT NULL,
        name VARCHAR(512) NOT NULL, brand VARCHAR(512), data JSON NOT NULL,
        updated_at VARCHAR(40) NOT NULL, last_checked_at VARCHAR(40) NOT NULL)''')
        conn.execute('INSERT INTO perfumes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                     (456, 'parfumo', 'remote-123', 'https://www.parfumo.com/Perfumes/Test/Example',
                      'Example', 'Maison Test', json.dumps(values), '2020-01-01', '2020-01-02'))
    for _ in range(2):
        factory = database('sqlite:///' + str(path))
        with factory.begin() as session:
            record = session.get(Perfume, 456)
            assert record.source == 'parfumo' and record.source_id == 'remote-123'
            assert record.data == values and record.extraction == {}
            assert record.updated_at == '2020-01-01' and record.last_checked_at == '2020-01-02'
            match_record(session, record)
            assert session.scalar(select(func.count()).select_from(CanonicalPerfume)) == 1
            assert session.scalar(select(func.count()).select_from(MatchEvent)) == 1


def test_source_identity_change_blocks_unsafe_undo(db):
    with db.begin() as session:
        first = add_record(session)
        target = match_record(session, first)
        second = add_record(session, source_id='2')
        match_record(session, second)
        manual_link(session, second.id, target, 'operator', 'Verified')
        second.data = {**second.data, 'concentration': 'EDT'}
        match_record(session, second)
        conflict = session.scalar(select(MatchEvent).where(MatchEvent.perfume_id == second.id).order_by(MatchEvent.created_at.desc()))
        assert session.scalar(select(MatchReview).where(MatchReview.perfume_id == second.id)).confidence == 0
        with pytest.raises(ValueError, match='Current source identity'):
            undo(session, conflict.id, 'operator', 'Do not restore incompatible variant')


def test_uncertain_new_arrays_keep_public_contract_shape():
    values, metadata = merge_extraction({}, Extraction({'notes_top': [], 'offers': []},
        {'notes_top': 'uncertain', 'offers': 'uncertain'}))
    assert values == {'notes_top': [], 'offers': []}
    assert metadata['notes_top']['state'] == 'uncertain'


def test_malformed_jsonld_fields_preserve_prior_accepted_values():
    html = '<script type="application/ld+json">' + json.dumps({'@type': 'Product', 'name': 'One',
        'description': {'unexpected': 'object'}, 'releaseDate': '9999-01-01', 'image': 'javascript:alert(1)'}) + '</script>'
    _, data = parse_product(html, 'https://example.test/one')
    old = {'description': 'Known description', 'release_year': 2020, 'image_url': 'https://example.test/image.jpg'}
    merged, states = merge_extraction(old, data)
    for key, value in old.items():
        assert merged[key] == value and states[key]['state'] == 'uncertain'


def test_operator_cli_review_round_trip(db, tmp_path):
    import os
    import subprocess
    import sys
    with db.begin() as session:
        add_record(session)
        add_record(session, source_id='2', year=None)
    environment = {**os.environ, 'DATABASE_URL': str(db.kw['bind'].url),
                   'SYNC_LOCK_PATH': str(tmp_path / 'operator.lock')}
    def cli(*arguments):
        return subprocess.run([sys.executable, '-m', 'fraggy.catalog', *arguments],
            env=environment, text=True, capture_output=True, check=True).stdout.strip()
    assert json.loads(cli('match')) == {'processed': 2}
    first = cli('reviews')
    cli('match')
    assert cli('reviews') == first
    review = json.loads(first)
    event_id = cli('accept', str(review['id']), '--actor', 'test', '--reason', 'Verified source')
    assert cli('reviews') == ''
    cli('undo', event_id, '--actor', 'test', '--reason', 'Reconsider match')
    assert json.loads(cli('reviews'))['id'] == review['id']


@pytest.mark.parametrize('years', [(None, None), (None, 2020), (2020, None)])
def test_bulk_matching_review_queue_stabilizes_independent_of_input_order(db, years):
    with db.begin() as session:
        records = [add_record(session, source_id=str(index), year=year) for index, year in enumerate(years)]
        for _ in range(2):
            for record in records:
                match_record(session, record)
        expected = [(review.id, review.perfume_id, review.canonical_id, review.status) for review in session.scalars(select(MatchReview).order_by(MatchReview.id))]
        events = session.scalar(select(func.count()).select_from(MatchEvent))
        assert len(expected) == 1
        for _ in range(3):
            for record in records:
                match_record(session, record)
        assert [(review.id, review.perfume_id, review.canonical_id, review.status) for review in session.scalars(select(MatchReview).order_by(MatchReview.id))] == expected
        assert session.scalar(select(func.count()).select_from(MatchEvent)) == events
