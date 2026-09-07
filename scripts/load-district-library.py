"""Load faithful source documents for every court, separate from canonical provisions.

PDF text is page transcription, not a rule adapter. No civil/criminal boundary or
currency approval is inferred. Raw snapshots, including HTML, remain replayable.
"""
import argparse
import hashlib
import json
import re
import shutil
import urllib.request
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from pypdf import PdfReader, __version__ as pypdf_version
PDF_EXTRACTOR = f'pypdf-{pypdf_version}-pages-v2'


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


class HtmlText(HTMLParser):
    """Extract visible text only; never serve captured court HTML as executable HTML."""
    def __init__(self):
        super().__init__()
        self.skip = 0
        self.output = []
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript'): self.skip += 1
        if not self.skip and tag in ('p', 'div', 'li', 'br', 'tr', 'h1', 'h2', 'h3', 'h4'): self.output.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript'): self.skip = max(0, self.skip-1)
        if not self.skip and tag in ('p', 'div', 'li', 'tr', 'h1', 'h2', 'h3', 'h4'): self.output.append('\n')
    def handle_data(self, data):
        if not self.skip: self.output.append(data)


def html_pages(raw, district):
    parser = HtmlText()
    parser.feed(raw.decode('utf-8', errors='strict'))
    text = '\n'.join(' '.join(line.split()) for line in ''.join(parser.output).splitlines() if line.strip())
    if district == 'ord':
        start = text.index('Local Rules of Civil Procedure')
        text = text[start:]
        assert 'LR 100' in text and len(text) > 100_000, 'Incomplete Oregon snapshot'
        pattern = r'(?m)^(LR \d+(?:\.\d+)? - [^\n]+)\n'
    else:
        start = text.index('\nLocal Civil Rules\n') + 1
        text = text[start:]
        text = text.split('\nSearch this site')[0]
        assert 'Local Civil Rule 83.' in text and len(text) > 70_000, 'Incomplete Michigan snapshot'
        pattern = r'(?m)^(Local Civil Rule \d+\. [^\n]+)\n'
    starts = [m.start() for m in re.finditer(pattern, text)]
    boundaries = sorted(set([0, *starts, len(text)]))
    return [{'number':i+1, 'text':text[a:b].strip()} for i,(a,b) in enumerate(zip(boundaries,boundaries[1:])) if text[a:b].strip()]


def extract_pdf(job):
    digest, path, output = job
    target = Path(output)/(digest+'.json')
    if target.exists():
        data = json.loads(target.read_text(encoding='utf-8'))
        if data.get('sourceSha256') == digest and data.get('extractor') == PDF_EXTRACTOR:
            return digest, len(data['pages']), sum(not p['text'].strip() for p in data['pages'])
    reader = PdfReader(path)
    pages = [{'number':i+1, 'text':page.extract_text() or ''} for i,page in enumerate(reader.pages)]
    write(target, {'sourceSha256':digest, 'extractor':PDF_EXTRACTOR, 'pages':pages})
    return digest, len(pages), sum(not p['text'].strip() for p in pages)


def main(args):
    assert pypdf_version == '6.10.0', 'Install the pinned requirements.txt before extraction'
    catalog = json.loads(Path('sources/district-catalog.json').read_text(encoding='utf-8'))
    assert len(catalog['districts']) == 94
    snapshots = Path('sources/district-snapshots')
    textroot = Path('data/source-library')
    snapshots.mkdir(parents=True, exist_ok=True)
    textroot.mkdir(parents=True, exist_ok=True)
    acquired_path = snapshots/'html-manifest.json'
    html_manifest = json.loads(acquired_path.read_text()) if acquired_path.exists() else {}
    records = []
    jobs = {}
    for row in catalog['districts']:
        record = {'id':row['id'], 'name':row['name'], 'discoveryUrl':row['discoveryUrl'], 'notes':row['notes'], 'documents':[]}
        for doc in sorted(row['documents'], key=lambda d:d['role']=='upcoming-edition'):
            if doc['format'] == 'pdf':
                v = doc['verification']
                digest = v['sha256']
                target = snapshots/(digest+'.pdf')
                origin = target if target.exists() else args.pdfs/(digest+'.pdf')
                raw = origin.read_bytes()
                assert len(raw) == v['bytes'] and hashlib.sha256(raw).hexdigest() == digest
                if not target.exists(): shutil.copyfile(origin, target)
                retrieved = v['checkedAt']
                jobs[digest] = (digest, str(target), str(textroot))
            else:
                prior = html_manifest.get(doc['url'])
                if prior:
                    digest, retrieved = prior['sha256'], prior['retrievedAt']
                    raw = (snapshots/(digest+'.html')).read_bytes()
                    assert hashlib.sha256(raw).hexdigest() == digest
                else:
                    if not args.acquire_html: raise ValueError('Missing HTML snapshot. Run with --acquire-html once.')
                    with urllib.request.urlopen(doc['url'], timeout=60) as response: raw = response.read()
                    digest = hashlib.sha256(raw).hexdigest()
                    retrieved = datetime.now(timezone.utc).isoformat()
                    (snapshots/(digest+'.html')).write_bytes(raw)
                    html_manifest[doc['url']] = {'sha256':digest, 'retrievedAt':retrieved, 'bytes':len(raw)}
                    write(acquired_path, html_manifest)
                pages = html_pages(raw, row['id'])
                write(textroot/(digest+'.json'), {'sourceSha256':digest, 'extractor':'html-visible-text-v1', 'pages':pages})
            record['documents'].append({
                'id':digest[:16], 'title':doc['label'], 'format':doc['format'], 'role':doc['role'],
                'sourceUrl':doc['url'], 'sha256':digest, 'bytes':len(raw), 'retrievedAt':retrieved,
                'snapshotPath':str(snapshots/(digest+'.'+doc['format'])).replace('\\','/'),
                'textPath':'data/source-library/'+digest+'.json',
                'pdfPath':'data/source-pdfs/'+digest+'.pdf' if doc['format']=='pdf' else None,
                'pageCount':doc.get('pageCount') if doc['format']=='pdf' else len(pages),
                'reviewStatus':'source-document-only',
            })
        records.append(record)
    with ProcessPoolExecutor(max_workers=4) as pool:
        for digest, count, blank in pool.map(extract_pdf, jobs.values()):
            for row in records:
                for doc in row['documents']:
                    if doc['sha256']==digest:
                        assert count == doc['pageCount'], 'PDF page count changed'
                        doc['blankTextPages'] = blank
            print(digest[:12], count, 'pages', flush=True)
    write(Path('data/source-library.json'), {'version':1, 'districts':records})
    districts = json.loads(Path('data/districts.json').read_text())
    existing = {d['id']:d for d in districts}
    for row in records:
        if row['id'] not in existing:
            districts.append({'id':row['id'], 'name':row['name'], 'collections':[], 'supported':True, 'readerMode':'source'})
    write(Path('data/districts.json'), districts)
    print('Loaded',len(records),'district source libraries. Canonical provisions unchanged.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdfs', type=Path, default=Path('candidate/district-pdfs'))
    parser.add_argument('--acquire-html', action='store_true')
    main(parser.parse_args())
