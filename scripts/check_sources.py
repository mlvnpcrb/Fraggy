"""Read-only robots probes; does not run a crawl or bypass source controls."""
import argparse
import json
from fraggy.source import Source
from fraggy.sources import SOURCES


def main():
    parser = argparse.ArgumentParser(description='Read-only robots HTTPS probes; no product imports')
    parser.add_argument('--source', choices=list(SOURCES), help='Probe only this source; default all')
    args = parser.parse_args()
    selected = {args.source: SOURCES[args.source]} if args.source else SOURCES
    failed = False
    for key, adapter in selected.items():
        client = Source(adapter=adapter)
        try:
            robots = client._fetch(adapter.base + '/robots.txt')
            if '<html' in robots.lower() or '<!doctype html' in robots.lower():
                raise ValueError('HTML instead of robots policy')
            from urllib.robotparser import RobotFileParser
            policy = RobotFileParser()
            policy.parse(robots.splitlines())
            print(json.dumps({'source': key, 'robots_http': 'success',
                              'seed_allowed': {seed: policy.can_fetch(client.user_agent, adapter.base + seed) for seed in adapter.seeds},
                              'catalog_live_verified': False}))
        except Exception as exc:
            failed = True
            print(json.dumps({'source': key, 'error': str(exc), 'catalog_live_verified': False}))
        finally:
            client.close()
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
