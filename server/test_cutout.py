from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

from server.cutout import InvalidPhoto, process_image


def test_rejects_corrupt_input():
    with pytest.raises(InvalidPhoto, match='photo'):
        process_image(b'not an image')


def test_rejects_oversized_upload_before_inference():
    with pytest.raises(InvalidPhoto, match='12 MB'):
        process_image(b'x' * (12 * 1024 * 1024 + 1))


def test_real_inference_returns_transparent_cropped_png():
    data = Path('server/fixtures/bottle-photo.png').read_bytes()
    original = Image.open(BytesIO(data))
    result = process_image(data)
    assert result.startswith(b'\x89PNG')
    output = Image.open(BytesIO(result))
    assert output.mode == 'RGBA'
    alpha = output.getchannel('A')
    assert alpha.getextrema()[0] == 0
    assert alpha.getextrema()[1] > 245
    assert output.width < original.width
    assert output.height < original.height
    assert output.width > 30 and output.height > 100
    assert alpha.getpixel((0, 0)) == 0
