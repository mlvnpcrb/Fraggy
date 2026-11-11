"""U2NetP CPU inference without importing optional matting/scientific stacks.

Normalization follows rembg's MIT-licensed U2netpSession/BaseSession algorithm:
https://github.com/danielgatis/rembg (Daniel Gatis and contributors).
The model and its checksum are pinned; runtime never downloads a model.
"""
from pathlib import Path
import hashlib
import os
import urllib.request

import numpy as np
import onnxruntime as ort
from PIL import Image

SHA256 = '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8'
MODEL_URL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx'

def session():
    root = Path(os.environ.get('U2NET_HOME', str(Path(__file__).parent / 'models')))
    model = root / 'u2netp.onnx'
    legacy = root / 'models' / 'u2netp' / 'u2netp.onnx'
    if not model.exists() and legacy.exists():
        model = legacy
    if not model.exists():
        if os.environ.get('FRAGGY_MODEL_DOWNLOAD') != '1':
            raise RuntimeError('Build the worker with its pinned U2NetP model before starting it.')
        root.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(MODEL_URL, timeout=120) as response:
            data = response.read(5000000)
        if hashlib.sha256(data).hexdigest() != SHA256:
            raise RuntimeError('Model checksum mismatch.')
        model.write_bytes(data)
    if hashlib.sha256(model.read_bytes()).hexdigest() != SHA256:
        raise RuntimeError('Model checksum mismatch.')
    options = ort.SessionOptions()
    options.enable_cpu_mem_arena = False
    options.enable_mem_pattern = False
    options.inter_op_num_threads = 1
    options.intra_op_num_threads = 1
    return ort.InferenceSession(str(model), sess_options=options, providers=['CPUExecutionProvider'])

def remove_background(image, model):
    pixels = np.asarray(image.convert('RGB').resize((320, 320), Image.Resampling.LANCZOS)).astype(np.float32)
    pixels /= max(float(pixels.max()), 1e-6)
    pixels = (pixels - np.array([.485, .456, .406], dtype=np.float32)) / np.array([.229, .224, .225], dtype=np.float32)
    tensor = np.expand_dims(pixels.transpose(2, 0, 1), 0)
    prediction = model.run([model.get_outputs()[0].name], {model.get_inputs()[0].name: tensor})[0][:, 0, :, :].squeeze()
    minimum, maximum = float(prediction.min()), float(prediction.max())
    if not np.isfinite(prediction).all() or maximum - minimum < 1e-6:
        raise ValueError('No foreground could be detected. Retake the bottle.')
    mask = Image.fromarray(((prediction - minimum) / (maximum - minimum) * 255).astype(np.uint8)).resize(image.size, Image.Resampling.LANCZOS)
    result = image.convert('RGBA')
    result.putalpha(mask)
    return result
