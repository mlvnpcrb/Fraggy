# Online builds use PyPI. For isolated builders, supply a verified wheelhouse
# with --build-context wheelhouse=/path/to/wheels --build-arg DEPENDENCY_MODE=offline.
ARG DEPENDENCY_MODE=online
FROM python:3.12-slim AS base
WORKDIR /app
COPY requirements.lock .

FROM base AS online
RUN pip install --no-cache-dir -r requirements.lock

FROM base AS offline
RUN --mount=from=wheelhouse,target=/wheels pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.lock

FROM ${DEPENDENCY_MODE} AS runtime
COPY --chown=10001:10001 fraggy ./fraggy
RUN mkdir -p /app/var && useradd --uid 10001 --no-create-home fraggy && chown -R fraggy:fraggy /app/var
USER fraggy
EXPOSE 8000
CMD ["python", "-m", "fraggy.web"]
