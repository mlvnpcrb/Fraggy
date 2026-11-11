# syntax=docker/dockerfile:1
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 U2NET_HOME=/opt/models OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 NUMBA_NUM_THREADS=1
WORKDIR /app
COPY server/requirements-hosted.txt server/requirements-hosted.txt
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then export PIP_CERT=/run/secrets/proxy_ca; fi; \
    pip install --no-cache-dir -r server/requirements-hosted.txt
COPY server server
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then export REQUESTS_CA_BUNDLE=/run/secrets/proxy_ca SSL_CERT_FILE=/run/secrets/proxy_ca; fi; \
    FRAGGY_MODEL_DOWNLOAD=1 python -c "from server.cutout import _session; _session()"
CMD ["sh", "-c", "uvicorn server.hosted:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1 --no-access-log"]
