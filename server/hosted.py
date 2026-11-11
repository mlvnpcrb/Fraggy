"""Render entrypoint. Durable state and authorization live in Supabase."""
import asyncio
from contextlib import asynccontextmanager
from io import BytesIO
import os
import re
from urllib.parse import urlparse
import urllib.request
import json
import time
import resource

from fastapi import FastAPI, HTTPException, Request
from PIL import Image
from server.cutout import process_image, _session

GATEWAY = os.environ.get('FRAGGY_GATEWAY_URL', '')
TOKEN = os.environ.get('FRAGGY_WORKER_TOKEN', '')
slots = asyncio.Semaphore(1)
tasks: set[asyncio.Task] = set()

def gateway(action, **data):
    payload = json.dumps(dict(action=action, worker_token=TOKEN, **data)).encode()
    request = urllib.request.Request(GATEWAY, payload, {'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.load(response)
    if result.get('error'):
        raise RuntimeError(result['error'])
    return result

def storage_request(url, data=None):
    # Only the configured project's signed storage URLs are accepted.
    target, trusted = urlparse(url), urlparse(GATEWAY)
    if target.scheme != 'https' or target.hostname != trusted.hostname or not target.path.startswith('/storage/v1/'):
        raise ValueError('Invalid storage ticket.')
    request = urllib.request.Request(url, data, {'Content-Type': 'image/png'} if data else {}, method='PUT' if data else 'GET')
    with urllib.request.urlopen(request, timeout=35) as response:
        result = response.read(500001)
    if data is None and len(result) > 500000:
        raise ValueError('Original exceeds the beta photo limit.')
    return result

def compress_png(raw):
    with Image.open(BytesIO(raw)) as original:
        image = original.convert('RGBA')
    for size in (1200, 1000, 800, 600, 450, 320):
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        out = BytesIO()
        image.save(out, 'PNG', optimize=True)
        if len(out.getvalue()) <= 500000:
            return out.getvalue(), image.width, image.height
    raise ValueError('Cutout could not fit the free beta photo limit. Retake on a plain background.')

def run_job(job_id, ticket):
    job = gateway('worker-claim', job_id=job_id, ticket=ticket)
    if job.get('skipped'):
        return
    lease = job['lease_id']
    started = time.monotonic()
    try:
        original = storage_request(job['download_url'])
        output, width, height = compress_png(process_image(original))
        storage_request(job['upload_url'], output)
        gateway('worker-complete', job_id=job_id, lease_id=lease, width=width, height=height)
        print(json.dumps({'event':'cutout_ready','job_id':job_id,'seconds':round(time.monotonic()-started,2),'peak_mb':round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,1)}),flush=True)
    except Exception:
        print(json.dumps({'event':'cutout_failed','job_id':job_id}),flush=True)
        # Never log photo contents, addresses, signed URLs or credentials.
        gateway('worker-complete', job_id=job_id, lease_id=lease, error='Photo processing failed. Your original is saved; retry or retake against a plain background.')

async def process(job_id, ticket):
    async with slots:
        try:
            await asyncio.to_thread(run_job, job_id, ticket)
        except Exception:
            print('Job could not be claimed or completed; its lease permits recovery.', flush=True)

@asynccontextmanager
async def lifespan(app):
    if not re.fullmatch(r'https://[a-z0-9]+\.supabase\.co/functions/v1/beta-gateway', GATEWAY) or not TOKEN:
        raise RuntimeError('Configure FRAGGY_GATEWAY_URL and FRAGGY_WORKER_TOKEN.')
    await asyncio.to_thread(_session)
    yield

app = FastAPI(title='Fraggy hosted cutouts', lifespan=lifespan)

@app.get('/health')
def health():
    return {'status': 'ready', 'model': 'u2netp'}

@app.post('/jobs', status_code=202)
async def jobs(request: Request):
    if len(tasks) >= 20:
        raise HTTPException(429, 'Processor busy. Retry shortly.')
    raw = await request.body()
    if len(raw) > 512:
        raise HTTPException(413, 'Request too large.')
    try:
        data = json.loads(raw)
        job_id, ticket = data['job_id'], data['ticket']
        if not re.fullmatch(r'[a-f0-9-]{36}', job_id) or not re.fullmatch(r'[a-f0-9]{48}', ticket):
            raise ValueError()
        # Reject unauthenticated requests before occupying inference slots.
        authorized = await asyncio.to_thread(gateway, 'worker-authorize', job_id=job_id, ticket=ticket)
        if not authorized.get('ok'):
            raise ValueError()
    except Exception:
        raise HTTPException(403, 'Invalid dispatch.')
    task = asyncio.create_task(process(job_id, ticket))
    tasks.add(task)
    task.add_done_callback(tasks.discard)
    return {'queued': True}
