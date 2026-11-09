from fastapi.testclient import TestClient
from server.main import app

client = TestClient(app)


def test_corrupt_upload_returns_actionable_error():
    response = client.post('/cutout', files={'file': ('bad.jpg', b'bad', 'image/jpeg')})
    assert response.status_code == 422
    assert 'photo' in response.json()['detail']


def test_endpoint_runs_real_removal():
    from pathlib import Path
    response = client.post('/cutout', files={'file': ('bottle.png', Path('server/fixtures/bottle-photo.png').read_bytes(), 'image/png')})
    assert response.status_code == 200
    assert response.json()['image'].startswith('data:image/png;base64,')
    assert response.json()['width'] > 30
    assert response.json()['height'] > 100
