from io import BytesIO
from pathlib import Path
import asyncio

from fastapi.testclient import TestClient
from PIL import Image
import pytest
from server import hosted

def test_rejects_unsigned_jobs_before_inference(monkeypatch):
    def unauthorized(*args, **kwargs):
        return {'ok': False}
    monkeypatch.setattr(hosted, 'gateway', unauthorized)
    client = TestClient(hosted.app)
    response = client.post('/jobs', json={'job_id': '00000000-0000-4000-8000-000000000001', 'ticket': 'a' * 48})
    assert response.status_code == 403
    assert not hosted.tasks

def test_refuses_non_project_downloads(monkeypatch):
    monkeypatch.setattr(hosted, 'GATEWAY', 'https://project.supabase.co/functions/v1/beta-gateway')
    with pytest.raises(ValueError, match='storage ticket'):
        hosted.storage_request('https://another.example/private.jpg')
    with pytest.raises(ValueError, match='storage ticket'):
        hosted.storage_request('http://project.supabase.co/storage/v1/secret')

def test_success_uploads_real_transparent_png_and_completes_lease(monkeypatch):
    calls = []
    uploaded = []
    def gateway(action, **data):
        calls.append((action, data))
        if action == 'worker-claim':
            return {'lease_id': 'lease', 'download_url': 'original', 'upload_url': 'cutout'}
        return {'ok': True}
    def storage(url, data=None):
        if data is None:
            return Path('server/fixtures/bottle-photo.png').read_bytes()
        uploaded.append(data)
    monkeypatch.setattr(hosted, 'gateway', gateway)
    monkeypatch.setattr(hosted, 'storage_request', storage)
    hosted.run_job('job', 'ticket')
    result = Image.open(BytesIO(uploaded[0]))
    assert result.mode == 'RGBA'
    assert result.getchannel('A').getextrema()[0] == 0
    assert len(uploaded[0]) <= 500000
    assert calls[-1][0] == 'worker-complete'
    assert calls[-1][1]['lease_id'] == 'lease'
    assert calls[-1][1]['width'] == result.width
    assert 'error' not in calls[-1][1]

def test_skipped_claim_cannot_upload_or_complete(monkeypatch):
    calls = []
    def gateway(action, **data):
        calls.append(action)
        return {'skipped': True}
    monkeypatch.setattr(hosted, 'gateway', gateway)
    monkeypatch.setattr(hosted, 'storage_request', lambda *_: pytest.fail('No storage access after skipped claim'))
    hosted.run_job('job', 'ticket')
    assert calls == ['worker-claim']

def test_failure_retains_original_and_reports_failed_lease(monkeypatch):
    calls = []
    def gateway(action, **data):
        calls.append((action, data))
        return {'lease_id': 'lease', 'download_url': 'original', 'upload_url': 'cutout'}
    monkeypatch.setattr(hosted, 'gateway', gateway)
    monkeypatch.setattr(hosted, 'storage_request', lambda *_: b'corrupt')
    hosted.run_job('job', 'ticket')
    assert calls[-1][0] == 'worker-complete'
    assert 'Your original is saved' in calls[-1][1]['error']

def test_only_one_job_runs_inference_at_a_time(monkeypatch):
    active = 0
    maximum = 0
    import time
    def work(*_):
        nonlocal active, maximum
        active += 1
        maximum = max(maximum, active)
        time.sleep(.03)
        active -= 1
    monkeypatch.setattr(hosted, 'run_job', work)
    async def exercise():
        await asyncio.gather(*(hosted.process(str(i), 'ticket') for i in range(4)))
    asyncio.run(exercise())
    assert maximum == 1
