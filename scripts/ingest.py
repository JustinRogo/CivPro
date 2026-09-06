"""Source-specific adapters over shared geometry extraction; output is always staged.

Only reviewed hashes may use this boundary profile. New bytes require a profile review.
All removals are headers, navigation, or explicit exclusions in the inventory.
"""
import argparse, hashlib, json, re
from pathlib import Path
from extract import extract

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')

def join(a, b):
    # Only remove discretionary line-end hyphens. Compound word breaks retain a
    # hyphen using a source-bound, reviewed vocabulary in normalization.json.
    if a.endswith('-') and b and b[0].isalpha():
        token = re.search(r'[A-Za-z]+-$', a)
        word = (token[0][:-1] if token else '') + b.split()[0].strip('.,;:')
        if word in KEEP_HYPHENS: return a + b
        return a[:-1] + b
    return a + (' ' if a else '') + b

KEEP_HYPHENS = set()

def blocks(lines, collection):
    body, history, footnotes = [], [], []
    stack, used = {}, set()
    current = None
    mode = 'paragraph'
    prev = None
    for line in lines:
        text = line['text'].strip()
        if not text: continue
        if line['size'] < 8.5 and collection.startswith('federal'):
            target = footnotes
            kind = 'footnote'
        else:
            if mode == 'history' and current and current['text'].endswith(')'): mode = 'paragraph'
            if re.match(r'^\(As (?:amended|added)|^\((?:Amended|Effective) ', text): mode = 'history'
            kind = mode
            target = history if kind == 'history' else body
        marker = re.match(r'^(?:\(([A-Za-z0-9]+)\)|(\d+)\.)\s*', text) if kind == 'paragraph' else None
        paragraph_start = marker is not None or current is None or current['type'] != kind
        if prev and kind == 'paragraph' and line['pageIndex'] == prev['pageIndex']:
            paragraph_start |= line['top'] - prev['bottom'] > (9 if collection.startswith('federal') else 5)
        if paragraph_start:
            path = []
            if marker:
                label = marker[1] or marker[2]
                if collection == 'federal-admiralty':
                    rank = 1 if label.isdigit() else 4 if label.isupper() else 3 if re.fullmatch('[ivx]+',label) else 2
                elif collection.startswith('ctd'):
                    rank = 2 if label.isdigit() else 3 if re.fullmatch('[ivx]+',label) and line['x0']>100 else 1
                else:
                    rank = 2 if label.isdigit() else 3 if label.isupper() else 4 if re.fullmatch('[ivx]+',label) and line['x0']>166 else 1
                stack = {k:v for k,v in stack.items() if k < rank}
                stack[rank] = label
                extra = re.match(r'\(([A-Za-z0-9]+)\)', text[marker.end():])
                if extra:
                    stack[rank+1] = extra[1]
                path = list(stack.values())
            anchor = '/'.join(path) if path else f'block-{len(body)+len(history)+len(footnotes)+1}'
            if anchor in used: anchor += f'~{len(body)+1}'
            used.add(anchor)
            current = {'id':anchor, 'path':path, 'type':kind, 'text':'', 'pages':[], 'parent':None}
            if len(path)>1:
                parent = next((b['id'] for b in reversed(body) if b['path'] == path[:-1]), None)
                current['parent'] = parent
            target.append(current)
        elif target and current not in target:
            current = {'id':f'{kind}-{len(target)+1}', 'path':[], 'type':kind, 'text':'', 'pages':[], 'parent':None}
            target.append(current)
        current['text'] = join(current['text'], text)
        if line['pageIndex'] not in current['pages']: current['pages'].append(line['pageIndex'])
        prev = line
    return body, history, footnotes

def provision(collection, number, title, lines, head, source, group):
    body, history, footnotes = blocks(lines, collection)
    status = 'reserved' if 'RESERVED' in title.upper() else 'abrogated' if 'ABROGATED' in title.upper() else 'cross-reference' if title.startswith('SEE LOCAL RULES') else 'active'
    if not title: title = f'Rule {number}'  # the source has no separate title (CT Rule 12)
    prefix = {'federal-frcp':'Fed. R. Civ. P.', 'federal-admiralty':'Supplemental Admiralty Rule', 'federal-social':'Supplemental Social Security Rule', 'federal-support':'Federal Appendix', 'ctd-civil':'D. Conn. L. Civ. R.', 'ctd-magistrate':'D. Conn. L. Mag. R.', 'ctd-support':'D. Conn. Civil Appendix'}[collection]
    page_indices = sorted({head['pageIndex']} | {line['pageIndex'] for line in lines})
    date_lines = [b for b in history if re.match(r'^\((Amended|Effective) ', b['text'])]
    dates = {'amendmentDate':None,'effectiveDate':None,'evidence':[]}
    for b in date_lines:
        m = re.match(r'^\((Amended|Effective) ([A-Za-z]+ \d{1,2}, \d{4})\)', b['text'])
        if m:
            from datetime import datetime
            dates['amendmentDate' if m[1]=='Amended' else 'effectiveDate'] = datetime.strptime(m[2], '%B %d, %Y').strftime('%Y-%m-%d')
            dates['evidence'].append({'wording':b['text'], 'pages':b['pages']})
    return {'id':collection+':'+number, 'collectionId':collection, 'districtId':'ctd' if collection.startswith('ctd') else 'us', 'number':number, 'citation':prefix+' '+number, 'title':title, 'status':status, 'group':group, 'body':body, 'history':history, 'footnotes':footnotes, 'editionId':collection+'-'+source['sha256'][:16], 'sourceDocumentId':source['id'], 'sourceUrl':source['url'], 'pageIndex':head['pageIndex'], 'pageSpan':[page_indices[0],page_indices[-1]], 'printedPage':str(head['pageIndex']-(18 if collection.startswith('federal') else 11)), 'dates':dates}

def federal(pages, source):
    result, pending, heading = [], [], None
    collection, group = 'federal-frcp', 'General provisions'
    title_mode = False
    group_mode = False
    def finish():
        if heading: result.append(provision(heading['collection'],heading['number'],heading['title'],pending,heading['line'],source,heading['group']))
    for index in range(19,len(pages)):
        for line in pages[index]:
            t = line['text']
            if line['top']<88 or re.fullmatch(r'\(\d+\)',t): continue
            if index in [122,123]: continue
            if line['size']<8.5:
                # Page footnotes retained separately below, rather than assigned to
                # whichever unrelated rule happens to end that page.
                continue
            if t.startswith('SUPPLEMENTAL RULES FOR'):
                finish(); heading=None; pending=[]
                collection = 'federal-social' if 'SOCIAL' in t else 'federal-admiralty'
                group = 'Social Security' if 'SOCIAL' in t else 'Admiralty and asset forfeiture'
                group_mode=True; continue
            if t.startswith('TITLE '):
                group=t; group_mode=True; title_mode=False; continue
            m = re.match(r'^\[?Rule (\d+(?:\.\d+)?|[A-G])\.\s*(.*)',t)
            if m and line['bold']:
                finish(); pending=[]
                heading={'collection':collection,'number':m[1],'title':m[2], 'line':line, 'group':group}
                title_mode=True; group_mode=False; continue
            if group_mode:
                if t == t.upper():
                    if collection=='federal-frcp': group=join(group,t)
                    continue
                group_mode=False
            if heading:
                if title_mode and line['bold']:
                    heading['title']=join(heading['title'],t); continue
                title_mode=False
                pending.append(line)
    finish()
    # Federal appendix is abrogated as a whole; no invented individual forms.
    h=pages[123][1]
    result.append(provision('federal-support','forms','Appendix of Forms [Abrogated]', [x for x in pages[123] if x['text'].startswith('[Abrogated')],h,source,'Appendix'))
    # Preserve publisher footnotes as their own supporting material, page by page.
    for i in range(19,len(pages)):
        notes=[x for x in pages[i] if x['size']<8.5 and x['top']>88 and not re.fullmatch(r'\(\d+\)',x['text'])]
        if notes and i != 123: result.append(provision('federal-support',f'notes-{i+1}',f'Publisher footnotes · printed page {i-18}',notes,notes[0],source,'Publisher footnotes'))
    return result

def connecticut(pages, source):
    result=[]
    for start,end,collection in [(13,110,'ctd-civil'),(135,138,'ctd-magistrate')]:
        heading=None; pending=[]; title_mode=False
        def finish():
            if heading: result.append(provision(collection,heading['number'],heading['title'],pending,heading['line'],source,'Local civil rules' if collection=='ctd-civil' else 'Magistrate rules'))
        for index in range(start,end):
            for line in pages[index]:
                t=line['text']
                if (line['top']>710 and t.isdigit()) or t.startswith('LOCAL RULES '): continue
                m=re.fullmatch(r'RULE (\d+(?:\.\d+)?)(?:\s*[–-]\s*RULE\s*(\d+))?',t)
                if m:
                    finish(); pending=[]; title_mode=True
                    heading={'number':m[1]+('-'+m[2] if m[2] else ''),'title':'','line':line}; continue
                if heading:
                    if title_mode and (line['bold'] or t=='(RESERVED)') and not t.startswith('(') or title_mode and t=='(RESERVED)':
                        heading['title']=join(heading['title'],t); continue
                    title_mode=False
                    pending.append(line)
        finish()
    appendix=[(111,118,'26f','Form 26(f) Report of Parties’ Planning Meeting'),(118,120,'scheduling','Standing Order on Scheduling in Civil Cases'),(120,123,'trial-memoranda','Standing Order Regarding Trial Memoranda in Civil Cases'),(123,126,'rico','Standing Order in Civil RICO Cases'),(126,128,'removal','Standing Order on Removed Cases'),(128,129,'disclosure','Order Re: Disclosure Statement'),(129,132,'registry','Order Regarding Deposit and Investment of Registry Funds'),(132,135,'initial-discovery','Standing Order Re: Initial Discovery Disclosures')]
    for start,end,number,title in appendix:
        lines=[x for p in pages[start:end] for x in p if not (x['top']>710 and x['text'].isdigit()) and x['text']!='CIVIL STANDING ORDERS']
        # Keep the official heading in the body as well: complex forms are not rewritten.
        result.append(provision('ctd-support',number,title,lines,lines[0],source,'Forms and standing orders'))
    return result

def run(sources, output):
    global KEEP_HYPHENS
    profile=json.loads(Path('sources/profile.json').read_text())
    KEEP_HYPHENS=set(profile['keepHyphens'])
    snapshots=json.loads((sources/'manifest.json').read_text())
    all_rules=[]; inventory=[]
    for source in snapshots:
        raw=(sources/source['path']).read_bytes()
        digest=hashlib.sha256(raw).hexdigest()
        if digest!=source['sha256'] or len(raw)!=source['bytes']: raise ValueError('Source integrity mismatch')
        if profile['hashes'][source['name']]!=digest: raise ValueError('Unreviewed source bytes: review adapter boundaries before ingestion')
        cache=Path(f'tmp/{source["name"]}-geometry.json')
        # Cached geometry is a development aid only; replay always extracts source bytes.
        pages=extract(sources/source['path'])
        rules=(federal if source['name']=='federal' else connecticut)(pages,source)
        all_rules.extend(rules)
        source['pageCount']=len(pages)
        source['editionLabel']='Amended through December 1, 2025' if source['name']=='federal' else 'Snapshot September 6, 2026 · individual amendment dates'
        source['publicationDate']=None
        source['effectiveDate']=None
        source['editionEvidence']={'pageIndex':3,'wording':'as amended to December 1, 2025'} if source['name']=='federal' else {'pageIndex':0,'wording':'If a Rule was amended after December 2009, the date of amendment is located on the page of the Rule.'}
        # Reconcile heading identities against the independent front-matter TOC.
        toc='\n'.join(x['text'] for p in pages[15:18] if source['name']=='federal' for x in p) if source['name']=='federal' else '\n'.join(x['text'] for p in pages[1:9] for x in p)
        if source['name']=='federal':
            expected=[m[1] for m in re.finditer(r'\bRule (\d+(?:\.\d+)?|[A-G])\.',toc)]
            actual=[r['number'] for r in rules if r['collectionId']!='federal-support']
        else:
            toc=toc.split('LOCAL RULES OF CRIMINAL PROCEDURE')[0]
            expected=[m[1]+('-'+m[2] if m[2] else '') for m in re.finditer(r'\bRULE (\d+(?:\.\d+)?)(?:\s*[–-]\s*RULE\s*(\d+))?',toc)]
            actual=[r['number'] for r in rules if r['collectionId']!='ctd-support']
        if expected!=actual: raise ValueError(f'TOC mismatch {source["name"]}: expected {expected}; actual {actual}')
        inventory.append({'source':source['id'],'pageCount':len(pages),'tocReconciled':True,'provisions':len(rules),'identities':actual,'includedPageRanges':[[19,121],[123,141]] if source['name']=='federal' else [[13,109],[111,137]],'exclusions':[{'pages':[0,18],'reason':'Publisher front matter and table of contents; retained in PDF snapshot'},{'pages':[122,122],'reason':'Blank page'}] if source['name']=='federal' else [{'pages':[0,12],'reason':'Front matter, contents, judicial roster'},{'pages':[110,110],'reason':'Civil appendix contents, reconciled with eight supporting materials'},{'pages':[138,138],'reason':'Blank page'},{'pages':[139,167],'reason':'Criminal rules; excluded from civil reader/search'},{'pages':[168,173],'reason':'Criminal-only standing order on discovery'}]})
    ids=[r['id'] for r in all_rules]
    if len(ids)!=len(set(ids)): raise ValueError('Duplicate provision IDs')
    write(output/'provisions.json',all_rules)
    write(output/'sources.json',snapshots)
    write(output/'inventory.json',inventory)
    print('Staged',len(all_rules),'provisions; both tables of contents reconciled')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--sources',type=Path,default=Path('sources/snapshots'))
    parser.add_argument('--output',type=Path,default=Path('candidate/data'))
    args=parser.parse_args(); run(args.sources,args.output)
