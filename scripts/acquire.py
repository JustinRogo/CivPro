"""Capture official bytes without modifying approved snapshots or canonical data."""
import argparse, hashlib, json, urllib.request
from datetime import datetime, timezone
from pathlib import Path

SOURCES = {
 'federal': {'url': 'https://www.uscourts.gov/sites/default/files/document/federal-rules-of-civil-procedure.pdf', 'publisher': 'United States Courts / U.S. Government Publishing Office'},
 'ctd': {'url': 'https://www.ctd.uscourts.gov/sites/default/files/Current-Revised-Local-Rules-9.4.26.pdf', 'publisher': 'United States District Court, District of Connecticut'}
}

def capture(output, import_dir=None):
    output.mkdir(parents=True, exist_ok=True)
    result = []
    for name, source in SOURCES.items():
        if import_dir:
            raw = (import_dir / f'{name}.pdf').read_bytes()
        else:
            with urllib.request.urlopen(source['url'], timeout=90) as response:
                raw = response.read()
        if not raw.startswith(b'%PDF-'): raise ValueError(f'{name}: response is not a PDF')
        digest = hashlib.sha256(raw).hexdigest()
        path = f'{name}-{digest}.pdf'
        (output / path).write_bytes(raw)
        result.append(dict(source, id=name+'-'+digest[:16], name=name, path=path, sha256=digest, bytes=len(raw), retrievedAt=datetime.now(timezone.utc).isoformat(), lastCurrencyReview=None))
    (output / 'manifest.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8', newline='\n')
    print('Captured', len(result), 'source snapshots in', output)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=Path('candidate/sources'))
    parser.add_argument('--import-dir', type=Path)
    args = parser.parse_args()
    capture(args.output, args.import_dir)
