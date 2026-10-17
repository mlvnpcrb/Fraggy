"""Sanitized, proxy-preserving diagnostics. Never attempts a direct/proxy-bypass route."""
import argparse
import json
import os
from pathlib import Path
import socket
from urllib.parse import urlsplit
import httpx
from fraggy.sources import SOURCES


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',default='var/validation/network.json')
    args=parser.parse_args()
    routes={}
    for key in ('HTTPS_PROXY','HTTP_PROXY','ALL_PROXY'):
        value=os.getenv(key)
        if value:
            parts=urlsplit(value)
            routes[key]={'scheme':parts.scheme,'hostname':parts.hostname,'port':parts.port,
                         'credentials_present':bool(parts.username or parts.password)}
    print(json.dumps({'proxy_routes':routes,'no_proxy_present':bool(os.getenv('NO_PROXY'))}))
    results=[]
    for key,url in [('control','https://pypi.org/simple/httpx/'),*[(key,adapter.base+'/robots.txt') for key,adapter in SOURCES.items()]]:
        try:socket.getaddrinfo(urlsplit(url).hostname,443);dns='resolved'
        except OSError:dns='unresolved_locally'
        result={'source':key,'url':url,'dns':dns}
        try:
            response=httpx.get(url,timeout=20,follow_redirects=False)
            result.update(status=response.status_code,server=response.headers.get('server'),
                          classification='http_response_not_catalog_validation')
        except httpx.ProxyError:
            result.update(classification='environment_proxy',error='HTTPS CONNECT denied before source response')
        except httpx.TransportError as exc:
            result.update(classification='transport',error=type(exc).__name__)
        results.append(result)
        print(json.dumps(result))
    path=Path(args.output);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(results,indent=2))


if __name__=='__main__':main()
