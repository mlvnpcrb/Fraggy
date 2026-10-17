"""Bounded, per-process policy for public catalog reads. No forwarded-IP trust."""
from collections import OrderedDict
import hashlib
import json
import math
import os
import time


def etag_matches(header, etag):
    return any(token.strip().removeprefix(b'W/') in (b'*', etag) for token in (header or b'').split(b','))


class CatalogHTTPPolicy:
    def __init__(self, app, rate=None, ttl=None, capacity=256):
        self.app = app
        self.rate = int(os.getenv('API_RATE_LIMIT_PER_MINUTE', '120')) if rate is None else rate
        self.ttl = float(os.getenv('API_CACHE_TTL_SECONDS', '5')) if ttl is None else ttl
        if self.rate < 1 or not 0 <= self.ttl <= 60:
            raise ValueError('API rate must be positive and cache TTL must be 0..60 seconds')
        self.capacity = capacity
        self.clients = OrderedDict()
        self.cache = OrderedDict()

    async def __call__(self, scope, receive, send):
        path = scope.get('path', '')
        if scope['type'] != 'http' or not path.startswith('/v1/') or scope['method'] != 'GET':
            return await self.app(scope, receive, send)
        timestamp = time.monotonic()
        client = (scope.get('client') or ('unknown',))[0]
        tokens, last = self.clients.pop(client, (float(self.rate), timestamp))
        tokens = min(self.rate, tokens + (timestamp - last) * self.rate / 60)
        self.clients[client] = (tokens - 1 if tokens >= 1 else tokens, timestamp)
        if len(self.clients) > 10000:
            self.clients.popitem(last=False)
        if tokens < 1:
            retry = str(max(1, math.ceil((1 - tokens) * 60 / self.rate))).encode()
            body = json.dumps({'detail': 'Rate limit exceeded'}).encode()
            await send({'type': 'http.response.start', 'status': 429,
                        'headers': [(b'content-type', b'application/json'), (b'retry-after', retry), (b'cache-control', b'no-store')]})
            return await send({'type': 'http.response.body', 'body': body})
        cacheable = path.startswith(('/v1/perfumes', '/v1/canonical-perfumes', '/v1/brands')) and not path.endswith('/extraction')
        # Never share authenticated or credential-bearing responses, even if routes are public today.
        request_headers = dict(scope.get('headers', []))
        cacheable = cacheable and not (b'authorization' in request_headers or b'cookie' in request_headers)
        key = (path, scope.get('query_string', b''))
        directives = request_headers.get(b'cache-control', b'').lower()
        if b'no-store' in directives:
            cacheable = False
        cached = self.cache.get(key) if cacheable and self.ttl and b'no-cache' not in directives else None
        if cached and cached[0] > timestamp:
            self.cache.move_to_end(key)
            _, headers, body, etag = cached
            if etag_matches(request_headers.get(b'if-none-match'), etag):
                headers = [(k, v) for k, v in headers if k not in (b'content-length', b'content-type')]
                await send({'type': 'http.response.start', 'status': 304, 'headers': headers})
                return await send({'type': 'http.response.body', 'body': b''})
            await send({'type': 'http.response.start', 'status': 200, 'headers': headers})
            return await send({'type': 'http.response.body', 'body': body})
        messages = []
        async def capture(message):
            messages.append(message)
        await self.app(scope, receive, capture)
        start = next((message for message in messages if message['type'] == 'http.response.start'), None)
        if cacheable and start and start['status'] == 200:
            body = b''.join(message.get('body', b'') for message in messages if message['type'] == 'http.response.body')
            etag = ('"' + hashlib.sha256(body).hexdigest() + '"').encode()
            # Zero client max-age ensures the server's TTL is the single staleness bound.
            headers = list(start['headers']) + [(b'etag', etag), (b'cache-control', b'public, max-age=0, must-revalidate')]
            start['headers'] = headers
            if self.ttl and len(body) <= 1024 * 1024 and not any(k.lower() == b'set-cookie' for k, _ in headers):
                self.cache[key] = (timestamp + self.ttl, headers, body, etag)
                self.cache.move_to_end(key)
                while len(self.cache) > self.capacity:
                    self.cache.popitem(last=False)
            if etag_matches(request_headers.get(b'if-none-match'), etag):
                headers = [(k, v) for k, v in headers if k not in (b'content-length', b'content-type')]
                await send({'type': 'http.response.start', 'status': 304, 'headers': headers})
                return await send({'type': 'http.response.body', 'body': b''})
        for message in messages:
            await send(message)
