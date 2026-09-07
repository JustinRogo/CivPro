"""Verify catalog PDF URLs; stage bytes and evidence without changing approved data."""
import argparse
import concurrent.futures
import hashlib
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def verify(document, output):
    result = {'url': document['url'], 'checkedAt': datetime.now(timezone.utc).isoformat()}
    try:
        request = urllib.request.Request(document['url'])
        with urllib.request.urlopen(request, timeout=45) as response:
            raw = response.read(40_000_001)
            result.update(httpStatus=response.status, resolvedUrl=response.url, contentType=response.headers.get('Content-Type'))
        if len(raw) > 40_000_000:
            raise ValueError('Response exceeds 40 MB limit')
        if not raw.startswith(b'%PDF-'):
            raise ValueError('Response does not have a PDF signature')
        digest = hashlib.sha256(raw).hexdigest()
        name = digest + '.pdf'
        (output / name).write_bytes(raw)
        result.update(status='pdf-verified', sha256=digest, bytes=len(raw), path=name)
    except Exception as error:
        result.update(status='retrieval-failed', error=str(error))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', type=Path, default=Path('sources/district-catalog.json'))
    parser.add_argument('--output', type=Path, default=Path('candidate/district-pdfs'))
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text(encoding='utf-8'))
    rows = catalog if isinstance(catalog, list) else catalog['districts']
    documents = {doc['url']: doc for row in rows for doc in row['documents'] if doc.get('format', 'pdf') == 'pdf'}
    args.output.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda doc: verify(doc, args.output), documents.values()))
    (args.output / 'verification.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
    print('Verified:', sum(r['status'] == 'pdf-verified' for r in results), '/', len(results))
    for result in results:
        if result['status'] != 'pdf-verified':
            print(result['url'], result['error'])
