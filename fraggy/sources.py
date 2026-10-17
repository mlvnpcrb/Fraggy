"""Source adapters. Additional sites use strict Product JSON-LD until live HTML is validated."""
from dataclasses import dataclass
import hashlib
import json
import math
import re
from urllib.parse import urljoin, urlsplit, urlunsplit
from xml.etree import ElementTree
from bs4 import BeautifulSoup
from .source import discover as fragrantica_links, parse_perfume
from .extraction import Extraction


@dataclass(frozen=True)
class Adapter:
    key: str
    base: str
    priority: int
    paths: str
    seeds: tuple[str, ...] = ('/',)
    parser_status: str = 'experimental-jsonld'

    def canonical(self, url, parent=None):
        parts = urlsplit(urljoin(parent or self.base, url))
        host = urlsplit(self.base).hostname
        hosts = {host, host.removeprefix('www.'), 'www.' + host.removeprefix('www.')}
        if parts.scheme != 'https' or parts.hostname not in hosts or parts.port not in (None, 443) or parts.username or parts.password:
            raise ValueError(f'URL outside {self.key} source')
        return urlunsplit(('https', host, parts.path or '/', parts.query, ''))

    def discover(self, html, url):
        if html.lstrip().startswith('<?xml') or html.lstrip().startswith(('<urlset', '<sitemapindex')):
            root = ElementTree.fromstring(html)
            sitemap = root.tag.rsplit('}', 1)[-1] == 'sitemapindex'
            links = {}
            for element in root.iter():
                if element.tag.rsplit('}', 1)[-1] != 'loc' or not element.text:
                    continue
                try:
                    link = self.canonical(element.text.strip())
                except ValueError:
                    continue
                if sitemap:
                    links[link] = 'sitemap'
                elif self.key == 'fragrantica':
                    path = urlsplit(link).path
                    if re.fullmatch(r'/perfume/[^/]+/[^/]+-\d+\.html', path):
                        links[link.split('?')[0]] = 'perfume'
                    elif re.fullmatch(r'/designers/[^/]+\.html', path):
                        links[link] = 'listing'
                elif re.search(self.paths, urlsplit(link).path, re.I):
                    links[link.split('?')[0]] = 'perfume'
            return links
        if self.key == 'fragrantica':
            return fragrantica_links(html, url)
        soup = BeautifulSoup(html, 'html.parser')
        links = {}
        for anchor in soup.select('a[href]'):
            try:
                link = self.canonical(anchor['href'], url)
            except ValueError:
                continue
            if re.search(self.paths, urlsplit(link).path, re.I):
                links[link.split('?')[0]] = 'perfume'
            elif 'next' in anchor.get('rel', []) and urlsplit(link).path == urlsplit(url).path:
                links[link] = 'listing'
        return links

    def parse(self, html, url):
        if self.key == 'fragrantica':
            identity, data = parse_perfume(html, url)
            return str(identity), data
        return parse_product(html, self.canonical(url).split('?')[0])


def objects(value):
    if isinstance(value, list):
        for item in value:
            yield from objects(item)
    elif isinstance(value, dict):
        yield value
        if '@graph' in value:
            yield from objects(value['@graph'])


def parse_product(html, url):
    """Only explicit Product entities count; headings alone never create records."""
    soup = BeautifulSoup(html, 'html.parser')
    products = []
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            value = json.loads(script.string or script.get_text())
        except (ValueError, TypeError):
            continue
        for obj in objects(value):
            types = obj.get('@type', [])
            types = types if isinstance(types, list) else [types]
            if any(str(t).rsplit('/', 1)[-1] == 'Product' for t in types) and obj.get('name'):
                products.append(obj)
    if len(products) != 1:
        raise ValueError('Expected one Product JSON-LD entity; source-specific parser needs validation')
    product = products[0]
    brand = product.get('brand')
    if isinstance(brand, dict):
        brand = brand.get('name')
    rating = product.get('aggregateRating') or {}
    if not isinstance(rating, dict):
        rating = {}
    def number(value, cast):
        try:
            result = cast(str(value).replace(',', ''))
            return result if math.isfinite(result) and result >= 0 else None
        except (ValueError, TypeError):
            return None
    images = product.get('image')
    image = images[0] if isinstance(images, list) and images else images
    if isinstance(image, dict):
        image = image.get('url') or image.get('contentUrl')
    offers = product.get('offers') or []
    offers = offers if isinstance(offers, list) else [offers]
    # Keep retailer offers and original rating scales attached to their source.
    offers = [{key: item.get(key) for key in ('sku', 'price', 'priceCurrency', 'availability', 'url', 'lowPrice', 'highPrice')} for item in offers if isinstance(item, dict)]
    data = {'name': str(product['name']), 'brand': brand if isinstance(brand, str) else None,
            'description': BeautifulSoup(str(product.get('description') or ''), 'html.parser').get_text(' ', strip=True) or None,
            'image_url': urljoin(url, image) if isinstance(image, str) else None,
            'rating': number(rating.get('ratingValue'), float),
            'rating_scale': {'min': number(rating.get('worstRating', 1), float), 'max': number(rating.get('bestRating', 5), float)},
            'votes': number(rating.get('ratingCount', rating.get('reviewCount')), int),
            'notes_top': [], 'notes_middle': [], 'notes_base': [], 'accords': [], 'perfumers': [],
            'gender': None, 'release_year': None, 'longevity': None, 'sillage': None,
            'offers': offers, 'sku': product.get('sku'), 'concentration': None, 'size': None,
            'parser': 'product-jsonld-v1'}
    states = {}
    if not data['name'].strip() or not isinstance(product['name'], str):
        raise ValueError('Invalid Product name')
    if 'description' in product and product['description'] is not None and not isinstance(product['description'], str):
        states['description'] = 'uncertain'
    if data['image_url'] and urlsplit(data['image_url']).scheme not in ('http', 'https'):
        states['image_url'] = 'uncertain'
    # Missing schema defaults are not evidence that a source field was empty.
    for key, raw_key in [('description', 'description'), ('brand', 'brand'), ('sku', 'sku')]:
        if raw_key in product and product[raw_key] == '':
            data[key], states[key] = '', 'empty'
        elif raw_key in product and data[key] is None:
            states[key] = 'uncertain'
    if 'offers' not in product or product['offers'] is None:
        states['offers'] = 'missing'
    elif product['offers'] == []:
        states['offers'] = 'empty'
    elif not offers or any(not any(value is not None for value in item.values()) for item in offers) or (isinstance(product['offers'], list) and len(offers) != len(product['offers'])):
        states['offers'] = 'uncertain'
    for field, raw_key in [('rating', 'ratingValue'), ('votes', 'ratingCount')]:
        if field == 'votes' and raw_key not in rating:
            raw_key = 'reviewCount'
        if raw_key in rating and data[field] is None:
            states[field] = 'uncertain'
    if data['rating'] is None or ('bestRating' not in rating or 'worstRating' not in rating):
        states['rating_scale'] = 'missing'
    elif data['rating_scale']['min'] is None or data['rating_scale']['max'] is None:
        states['rating_scale'] = 'uncertain'
        states['rating'] = 'uncertain'
    # Optional explicit identity fields; no inference from marketing descriptions.
    if isinstance(product.get('concentration'), str) and product['concentration'].strip():
        data['concentration'] = product['concentration'].strip()
    if isinstance(product.get('releaseDate'), str):
        match = re.fullmatch(r'(\d{4})(?:-\d{2}-\d{2})?', product['releaseDate'])
        if match and 1700 <= int(match[1]) <= 2200:
            data['release_year'] = int(match[1])
        else:
            states['release_year'] = 'uncertain'
    # Identity uses the canonical source URL, not a retailer SKU that may be reused.
    return hashlib.sha256(url.encode()).hexdigest(), Extraction(data, states)


SOURCES = {
    'fragrantica': Adapter('fragrantica', 'https://www.fragrantica.com', 1, r'^/perfume/', ('/designers/',), 'fixture-tested-html'),
    'parfumo': Adapter('parfumo', 'https://www.parfumo.com', 1, r'^/Perfumes/[^/]+/[^/]+/?$', ('/Brands',)),
    'basenotes': Adapter('basenotes', 'https://basenotes.com', 2, r'^/fragrances/[^/]+/?$', ('/directory/',)),
    'wikiparfum': Adapter('wikiparfum', 'https://www.wikiparfum.com', 2, r'^/en/fragrances/[^/]+/?$', ('/en/fragrances',)),
    'osmoz': Adapter('osmoz', 'https://www.osmoz.com', 3, r'^/perfumes/[^/]+/[^/]+', ('/perfumes',)),
    'perfumecom': Adapter('perfumecom', 'https://www.perfume.com', 3, r'^/[^/]+/[^/]+/(?:men-cologne|women-perfume)/[^/]+', ('/',)),
    'fragrancex': Adapter('fragrancex', 'https://www.fragrancex.com', 3, r'^/products/[^/]+/[^/]+', ('/',)),
    'luckyscent': Adapter('luckyscent', 'https://www.luckyscent.com', 3, r'^/product/\d+/', ('/',)),
}
