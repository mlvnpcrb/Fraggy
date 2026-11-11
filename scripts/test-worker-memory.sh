#!/usr/bin/env bash
set -euo pipefail
# Build server/Dockerfile first. No runtime download/network or swap is allowed.
docker run --rm --memory=512m --memory-swap=512m --network=none \
  --mount "type=bind,src=$(pwd)/server/fixtures,dst=/fixtures,readonly" \
  "${FRAGGY_WORKER_IMAGE:-fraggy-worker-beta}" python -c '
import resource,time
from pathlib import Path
from server.cutout import _session,process_image
from server.hosted import compress_png
t=time.monotonic();_session();print("model_seconds",round(time.monotonic()-t,2))
for attempt in range(3):
 t=time.monotonic();raw,w,h=compress_png(process_image(Path("/fixtures/bottle-photo.png").read_bytes()))
 peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024
 print("attempt",attempt+1,"seconds",round(time.monotonic()-t,2),"peak_mb",round(peak,1),"png_bytes",len(raw),"dimensions",w,h)
 assert len(raw)<=500000 and w>30 and h>100 and peak<450
'
