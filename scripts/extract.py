"""Geometry-preserving extraction. No OCR or generated legal text."""
import json
from pathlib import Path
import pdfplumber

def extract(path):
    pages = []
    with pdfplumber.open(path) as pdf:
        for index, page in enumerate(pdf.pages):
            lines = []
            for line in page.extract_text_lines(x_tolerance=1):
                chars = line.pop('chars')
                line['font'] = chars[0]['fontname']
                line['size'] = round(max(c['size'] for c in chars), 2)
                line['bold'] = sum('Bold' in c['fontname'] or 'MNewCenturySchlbk' in c['fontname'] for c in chars) > len(chars) / 2
                line['pageIndex'] = index
                lines.append(line)
            pages.append(lines)
    return pages

if __name__ == '__main__':
    Path('tmp').mkdir(exist_ok=True)
    for source in json.loads(Path('sources/snapshots/manifest.json').read_text()):
        name = source['name']
        pages = extract(Path('sources/snapshots') / source['path'])
        Path(f'tmp/{name}-geometry.json').write_text(json.dumps(pages, ensure_ascii=False), encoding='utf-8')
        print(name, len(pages), 'pages extracted')
