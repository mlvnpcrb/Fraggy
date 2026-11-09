"""Run from the repo root: python -m uvicorn server.main:app --host 0.0.0.0 --port 8787."""
import base64
from io import BytesIO
import logging

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from starlette.concurrency import run_in_threadpool

from server.cutout import MAX_BYTES, InvalidPhoto, process_image

app = FastAPI(title='Fraggy bottle cutouts')
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r'https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?',
    allow_methods=['POST', 'GET'],
    allow_headers=['Content-Type'],
)


@app.get('/health')
def health():
    return {'service': 'fraggy-cutout', 'status': 'ok', 'model': 'u2netp'}


@app.post('/cutout')
async def cutout(file: UploadFile = File(...)):
    try:
        data = await file.read(MAX_BYTES + 1)
        output = await run_in_threadpool(process_image, data)
        with Image.open(BytesIO(output)) as image:
            width, height = image.size
        return {'image': 'data:image/png;base64,' + base64.b64encode(output).decode(), 'width': width, 'height': height}
    except InvalidPhoto as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        logging.getLogger('fraggy').exception('Background removal failed')
        raise HTTPException(status_code=503, detail='The cutout processor is not ready. Check its terminal, then retry.') from error
    finally:
        await file.close()
