from functools import lru_cache
from io import BytesIO
import os
from pathlib import Path
import threading

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 12 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 24_000_000
_inference_lock = threading.Lock()


class InvalidPhoto(ValueError):
    pass


def process_image(data: bytes) -> bytes:
    if len(data) > MAX_BYTES:
        raise InvalidPhoto('Choose a photo smaller than 12 MB.')
    try:
        with Image.open(BytesIO(data)) as source:
            if source.width * source.height > 24_000_000:
                raise InvalidPhoto('Choose a smaller photo (under 24 megapixels).')
            image = ImageOps.exif_transpose(source).convert('RGB')
            image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise InvalidPhoto('This photo could not be read. Try a JPEG or PNG.') from error

    from server.segmentation import remove_background
    with _inference_lock:
        cutout = remove_background(image, _session())
    alpha = cutout.getchannel('A')
    bounds = alpha.point(lambda value: 255 if value > 20 else 0).getbbox()
    if bounds is None:
        raise InvalidPhoto('No bottle was detected. Retake it against a plain background.')
    # A small transparent border keeps the cap and glass edges intact while
    # allowing the bottle's base to sit directly on the digital shelf.
    cropped = cutout.crop(bounds)
    canvas = Image.new('RGBA', (cropped.width + 12, cropped.height + 12))
    canvas.alpha_composite(cropped, (6, 6))
    output = BytesIO()
    canvas.save(output, format='PNG', optimize=True)
    return output.getvalue()


@lru_cache(maxsize=1)
def _session():
    os.environ.setdefault('U2NET_HOME', str(Path(__file__).parent / 'models'))
    os.environ.setdefault('OMP_NUM_THREADS', '2')
    from server.segmentation import session
    return session()
