"""Fragrantica HTML discovery and parsing. No browser impersonation or challenge bypass."""
import re
import math
import hashlib
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser
import httpx
from bs4 import BeautifulSoup
from .extraction import Extraction

BASE = 'https://www.fragrantica.com'
PERFUME = re.compile(r'^/perfume/[^/]+/[^/]+-(\d+)\.html$')
DESIGNER = re.compile(r'^/designers/[^/]+\.html$')


class SourceBlocked(RuntimeError):
    def __init__(self, message, kind='source_blocked', retry_after=None):
        super().__init__(message)
        self.kind = kind
        self.retry_after = retry_after


def retry_after_seconds(value):
    if not value:
        return None
    try:
        seconds = float(value)
    except ValueError:
        try:
            seconds = (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds()
        except (TypeError, ValueError, OverflowError):
            return None
    return max(0, seconds) if math.isfinite(seconds) else None


def canonical(url, parent=BASE):
    parts = urlsplit(urljoin(parent, url))
    if parts.scheme != 'https' or parts.hostname not in ('www.fragrantica.com', 'fragrantica.com') or parts.port not in (None, 443) or parts.username:
        raise ValueError('Only HTTPS Fragrantica URLs are accepted')
    return urlunsplit(('https', 'www.fragrantica.com', parts.path, parts.query, ''))


def discover(html, url):
    soup = BeautifulSoup(html, 'html.parser')
    found = {}
    for a in soup.select('a[href]'):
        try:
            link = canonical(a['href'], url)
        except ValueError:
            continue
        path = urlsplit(link).path
        if PERFUME.fullmatch(path):
            found[link.split('?')[0]] = 'perfume'
        elif DESIGNER.fullmatch(path):
            found[link.split('?')[0]] = 'listing'
        elif a.get('rel') and 'next' in a['rel'] and path == urlsplit(url).path:
            found[link] = 'listing'
    return found


def parse_perfume(html, url):
    url = canonical(url)
    match = PERFUME.fullmatch(urlsplit(url).path)
    soup = BeautifulSoup(html, 'html.parser')
    title = soup.select_one('h1[itemprop="name"]')
    if not match or not title:
        raise ValueError('Missing perfume identity: unexpected page or parser change')
    name = title.get_text(' ', strip=True)
    gender = None
    for suffix, label in [('for women and men', 'unisex'), ('for women', 'women'), ('for men', 'men')]:
        if suffix in name.lower():
            gender = label
            name = re.sub(re.escape(suffix), '', name, flags=re.I).strip()
            break
    brand = soup.select_one('[itemprop="brand"] [itemprop="name"], a.brand, span[itemprop="brand"]')
    if not brand:
        brand = soup.select_one('a[href^="/designers/"]')
    desc = soup.select_one('[itemprop="description"], .text-description')
    description = desc.get_text(' ', strip=True) if desc else None
    year = re.search(r'(?:launched|released) in (\d{4})', description or '', re.I)
    if not name:
        raise ValueError('Empty perfume name')
    states = {}
    data = {'name': name, 'brand': brand.get_text(' ', strip=True) if brand else None,
            'gender': gender, 'release_year': int(year[1]) if year else None,
            'description': description, 'notes_top': [], 'notes_middle': [], 'notes_base': [],
            'accords': [a.get_text(' ', strip=True) for a in soup.select('.accord-bar')],
            'perfumers': list(dict.fromkeys(a.get_text(' ', strip=True) for a in soup.select('a[href*="/noses/"]')))}
    for level, heading in [('top', 'Top'), ('middle', 'Middle'), ('base', 'Base')]:
        header = soup.find(['h3', 'h4'], string=re.compile(heading + r' Notes', re.I))
        container = header.find_next_sibling('div') if header else None
        if container:
            data['notes_' + level] = [a.get_text(' ', strip=True) for a in container.select('a[href*="/notes/"]') if a.get_text(strip=True)]
            if not data['notes_' + level]:
                states['notes_' + level] = 'uncertain'
    for prop, field, conversion in [('ratingValue', 'rating', float), ('ratingCount', 'votes', int)]:
        element = soup.select_one(f'[itemprop="{prop}"]')
        try:
            data[field] = conversion((element.get('content') or element.get_text(strip=True)).replace(',', '')) if element else None
            if data[field] is not None and (not math.isfinite(data[field]) or data[field] < 0 or (field == 'rating' and not 1 <= data[field] <= 5)):
                raise ValueError('Invalid numeric field')
        except ValueError:
            data[field] = None
            states[field] = 'uncertain'
    if data['release_year'] is not None and not 1700 <= data['release_year'] <= 2200:
        data['release_year'] = None
        states['release_year'] = 'uncertain'
    data['rating_scale'] = {'min': 1, 'max': 5}
    if data.get('rating') is None:
        states['rating_scale'] = 'missing'
    image = soup.select_one('img[itemprop="image"]')
    data['image_url'] = urljoin(url, image['src']) if image and image.get('src') else None
    for field, label in [('longevity', 'Perfume longevity'), ('sillage', 'Perfume sillage')]:
        text = soup.get_text(' ', strip=True)
        score = re.search(label + r':\s*([\d.]+)\s*out of\s*([\d.]+)', text, re.I)
        data[field] = {'value': float(score[1]), 'scale': float(score[2])} if score else None
    return int(match[1]), Extraction(data, states)


class Source:
    def __init__(self, delay=20, user_agent='FraggyAPI/0.1', adapter=None):
        from .sources import SOURCES
        self.adapter = adapter or SOURCES['fragrantica']
        self.delay = max(10, delay)
        self.last_request = 0.0
        self.client = httpx.Client(timeout=30, follow_redirects=False, headers={'User-Agent': user_agent})
        self.robots = None
        self.responses = []
        self.user_agent = user_agent

    def close(self):
        self.client.close()

    def _fetch(self, url):
        time.sleep(max(0, self.delay - (time.monotonic() - self.last_request)))
        self.last_request = time.monotonic()
        try:
            response = self.client.get(self.adapter.canonical(url))
        except httpx.ProxyError as exc:
            raise SourceBlocked('Environment proxy denied source access', kind='environment_proxy') from exc
        if response.status_code in (401, 403, 429):
            raise SourceBlocked(f'Source returned {response.status_code}; paused until next scheduled attempt',
                                kind='source_rate_limit' if response.status_code == 429 else 'source_access',
                                retry_after=retry_after_seconds(response.headers.get('retry-after')))
        if 300 <= response.status_code < 400:
            raise SourceBlocked('Redirect requires inspection before continuing', kind='source_redirect')
        response.raise_for_status()
        if any(marker in response.text.lower() for marker in ('cf-chl-', 'just a moment...', 'verify you are human')):
            raise SourceBlocked('Source challenge detected', kind='source_challenge')
        self.responses.append({'url': str(response.request.url), 'status': response.status_code,
                               'sha256': hashlib.sha256(response.content).hexdigest()})
        return response.text

    def get(self, url):
        url = self.adapter.canonical(url)
        if self.robots is None:
            text = self._fetch(self.adapter.base + '/robots.txt')
            if '<html' in text.lower() or '<!doctype html' in text.lower():
                raise SourceBlocked('Unexpected HTML instead of robots.txt')
            self.robots = RobotFileParser()
            self.robots.parse(text.splitlines())
            self.delay = max(self.delay, self.robots.crawl_delay(self.user_agent) or 0)
        if not self.robots.can_fetch(self.user_agent, url):
            raise SourceBlocked('robots.txt disallows this URL; use agreement-provided access', kind='robots_denied')
        return self._fetch(url)

    def sitemap_urls(self):
        return self.robots.site_maps() or [] if self.robots else []
