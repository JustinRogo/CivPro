"""Discover public rules-page links for manual catalog review (no corpus changes)."""
import argparse
import concurrent.futures
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.href = None
        self.label = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.href = dict(attrs).get('href')
            self.label = []

    def handle_data(self, data):
        if self.href is not None:
            self.label.append(data)

    def handle_endtag(self, tag):
        if tag == 'a' and self.href:
            self.links.append((self.href, ' '.join(' '.join(self.label).split())))
            self.href = None


def get_links(url):
    request = urllib.request.Request(url)
    with urllib.request.urlopen(request, timeout=25) as response:
        raw = response.read(8_000_000)
        final = response.url
    if raw.startswith(b'%PDF-'):
        return final, [{'url': final, 'label': 'PDF document'}]
    parser = Links()
    parser.feed(raw.decode('utf-8', errors='replace'))
    seen = set()
    links = []
    for href, label in parser.links:
        target = urllib.parse.urljoin(final, href).split('#')[0]
        if target in seen or not target.startswith(('https://', 'http://')):
            continue
        seen.add(target)
        if re.search(r'rule|\.pdf(?:\?|$)', target + ' ' + label, re.I):
            links.append({'url': target, 'label': label})
    return final, links


def discover(district):
    result = dict(district, pages=[])
    queue = [district['discoveryUrl']]
    seen = set()
    while queue and len(seen) < 5:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        try:
            final, links = get_links(url)
            result['pages'].append({'url': url, 'resolvedUrl': final, 'links': links})
            candidates = [x for x in links if re.search(r'local.{0,12}rules|rules.{0,12}(civil|practice)|civil.{0,12}rules', x['label'] + ' ' + x['url'], re.I)
                          and not re.search(r'\.pdf|propos|archiv|amend|criminal|bankrupt|patent', x['url'] + ' ' + x['label'], re.I)
                          and urllib.parse.urlparse(x['url']).hostname.removeprefix('www.') == urllib.parse.urlparse(final).hostname.removeprefix('www.')]
            queue.extend(x['url'] for x in candidates[:3])
        except Exception as error:
            result['pages'].append({'url': url, 'error': str(error)})
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    catalog = json.loads(args.input.read_text(encoding='utf-8'))
    districts = catalog if isinstance(catalog, list) else catalog['districts']
    args.output.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for result in pool.map(discover, districts):
            (args.output / (result['id'] + '.json')).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
            print(result['id'], sum(len(p.get('links', [])) for p in result['pages']), flush=True)
