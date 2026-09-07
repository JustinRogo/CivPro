"""Build draft rule records from hash-bound district heading profiles.

This is distinct from editorially reconciled canonical ingestion. Original page
text is retained, including embedded notes. Output is staged unless explicitly
directed to data/parsed-districts. No legal currency or relationship is inferred.
"""
import argparse, hashlib, json, re
from pathlib import Path
import pypdfium2 as pdfium
from pypdf import PdfReader, __version__ as pypdf_version
from html.parser import HTMLParser

def read(path): return json.loads(Path(path).read_text(encoding='utf-8'))
def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
def digest(raw): return hashlib.sha256(raw).hexdigest()

def pattern(profile):
    return re.compile(r'^\s*'+profile['prefix']+r'\s*(?P<number>'+profile['numberPattern']+r')(?![\dA-Za-z]|[.\-]\d)(?P<tail>.*)$')

def headings(pages,profile,bookmarks):
    regex=pattern(profile);hits=[]
    for p in pages:
        if not profile['startPage']<=p['number']<=profile['endPage']:continue
        offset=0
        for line in p['text'].splitlines(keepends=True):
            m=regex.match(line.rstrip())
            if m:
                tail=m['tail'].lstrip('.: -–—\t');number=m['number']
                valid=(bool(tail) or profile.get('allowStandalone',True)) and (not tail or tail[0].isupper() or tail[0] in '[(')
                valid=valid and not re.search(r'\.{3}|(?:\. ){4}|_{4}',line)
                valid=valid and (not tail.startswith('(') or tail.startswith('(Fed.') or profile.get('allowParenthetical') or profile['districtId']=='wiwd')
                if profile.get('htmlHeadings') is not None:valid=valid and ' '.join(line.split()) in profile['htmlHeadings']
                if valid and number not in profile.get('ignoreNumbers',[]):hits.append({'number':number,'page':p['number'],'offset':offset,'heading':line.strip(),'tail':tail})
            offset+=len(line)
    chosen={}
    # Publisher bookmark destinations help reject earlier cross-references.
    for i,h in enumerate(hits):
        following=next((n['offset'] for n in hits[i+1:] if n['page']==h['page']),len(pages[h['page']-1]['text']))
        body_size=following-h['offset']-len(h['heading'])
        bm_pages=[p for p,title in bookmarks if regex.match(title) and regex.match(title)['number']==h['number'] and profile['startPage']<=p<=profile['endPage']]
        score=(100 if h['page'] in bm_pages else 0)+(10 if body_size>150 else 0)
        if h['number'] not in chosen or score>chosen[h['number']][0]:chosen[h['number']]=(score,h)
    return sorted((h for _,h in chosen.values()),key=lambda h:(h['page'],h['offset']))

def title_for(h,pages):
    tail=h['tail']
    tail=re.sub(r'^\((?:Fed\.[^)]*|FRCP[^)]*|Civil)\)\s*','',tail)
    if not tail:
        after=pages[h['page']-1]['text'][h['offset']:].splitlines()[1:]
        tail=next((l.strip() for l in after if l.strip() and not re.fullmatch(r'\d+',l.strip())), '')
    tail=tail.replace('Return to Top','').strip()
    if tail.startswith('('):return 'Rule '+h['number']
    # Keep a source heading, not the following prose of an inline rule.
    sentence=re.search(r'\.\s+(?=[A-Z][a-z])',tail)
    if sentence:tail=tail[:sentence.start()+1]
    return tail[:180] or 'Rule '+h['number']

def parse(profile,row,doc,pages,bookmarks):
    found=headings(pages,profile,bookmarks)
    if not found:raise ValueError('No rule headings for '+row['id'])
    end_page=profile['endPage'];end_offset=len(pages[end_page-1]['text'])
    if profile.get('endMarker'):
        end_offset=pages[end_page-1]['text'].index(profile['endMarker'])
    found=[h for h in found if (h['page'],h['offset'])<(end_page,end_offset)]
    cid=row['id']+'-civil';edition=cid+'-parsed-v1-'+doc['sha256'][:16]
    items=[];evidence=[]
    for i,h in enumerate(found):
        stop=found[i+1] if i+1<len(found) else {'page':end_page,'offset':end_offset}
        body=[];slices=[]
        for number in range(h['page'],stop['page']+1):
            start=h['offset'] if number==h['page'] else 0
            end=stop['offset'] if number==stop['page'] else len(pages[number-1]['text'])
            text=pages[number-1]['text'][start:end]
            if not text:continue
            body.append({'id':'page-'+str(number),'path':[],'type':'paragraph','text':text,'pages':[number-1],'parent':None})
            slices.append({'page':number,'start':start,'end':end,'sha256':digest(text.encode())})
        title=title_for(h,pages)
        status='reserved' if re.search(r'\bRESERVED\b',title,re.I) else 'abrogated' if re.search(r'\b(?:ABROGATED|DELETED|WITHDRAWN)\b',title,re.I) else 'active'
        items.append({'id':cid+':'+h['number'],'collectionId':cid,'districtId':row['id'],'number':h['number'],'citation':row['name']+' · Rule '+h['number'],'title':title,'status':status,'group':'Local rules · parsed draft','body':body,'history':[],'footnotes':[],'editionId':edition,'sourceDocumentId':'parsed-'+row['id']+'-'+doc['sha256'][:16],'sourceUrl':doc['sourceUrl'],'pageIndex':h['page']-1,'pageSpan':[h['page']-1,body[-1]['pages'][0]],'printedPage':'See original source','dates':{'amendmentDate':None,'effectiveDate':None,'evidence':[]}})
        evidence.append({'number':h['number'],'heading':h['heading'],'page':h['page'],'offset':h['offset'],'slices':slices})
    flags=[]
    if any(re.search(r'[\ufffd\ufffe\x00-\x08]',b['text']) for p in items for b in p['body']):flags.append('Source extraction contains unresolved characters; consult the original publication.')
    scope=profile['scope']+' Rule boundaries and transcription are drafts. Embedded notes, forms, and running headers may remain within rule text; subsection anchors and field-separated notes are not yet reviewed.'
    return {'version':1,'reviewStatus':'parsed-draft','districtId':row['id'],'sourceDocument':doc,'collection':{'id':cid,'name':row['name']+' Local Rules','shortName':'Local rules · draft','districtId':row['id'],'scopeNote':scope},'provisions':items,'evidence':evidence,'coverage':{'startPage':found[0]['page'],'startOffset':found[0]['offset'],'endPage':end_page,'endOffset':end_offset,'ruleCount':len(items),'tocReconciled':False,'editorialReviewComplete':False,'currencyReviewed':False,'flags':flags,'excluded':'Source material outside the recorded range remains available in the district source library.'}}

def main(args):
    assert str(pdfium.PYPDFIUM_INFO)=='5.11.0','Install requirements-structured.txt for reproducible extraction'
    assert pypdf_version=='6.10.0','Install requirements-structured.txt for reproducible heading selection'
    profiles=read('sources/district-parse-profiles.json')['profiles'];library=read('data/source-library.json')['districts'];reports=[]
    for profile in profiles:
        row=next(r for r in library if r['id']==profile['districtId']);doc=next(d for d in row['documents'] if d['id']==profile['documentId'])
        raw=Path(doc['snapshotPath']).read_bytes();assert digest(raw)==profile['sourceSha256']==doc['sha256']
        assert doc['role']!='upcoming-edition';cache=Path('tmp/parsed-pages',doc['sha256']+'.json')
        if row['id']=='ord':
            class Titles(HTMLParser):
                def __init__(self):super().__init__();self.active=False;self.text='';self.titles=[]
                def handle_starttag(self,tag,attrs):
                    if re.fullmatch(r'h[1-6]',tag):self.active=True;self.text=''
                def handle_endtag(self,tag):
                    if re.fullmatch(r'h[1-6]',tag) and self.active:self.titles.append(' '.join(self.text.split()));self.active=False
                def handle_data(self,data):
                    if self.active:self.text+=data
            titles=Titles();titles.feed(raw.decode('utf8'));profile['htmlHeadings']=titles.titles
        if args.cached_pages:
            data=read(cache);assert data['sourceSha256']==doc['sha256'];pages=data['pages']
        elif doc['format']=='html':pages=read(doc['textPath'])['pages']
        else:
            pdf=pdfium.PdfDocument(raw);pages=[]
            for i in range(len(pdf)):
                page=pdf[i];tp=page.get_textpage();pages.append({'number':i+1,'text':tp.get_text_range().replace('\r\n','\n').replace('\r','')});tp.close();page.close()
            pdf.close()
        bookmarks=[]
        if doc['format']=='pdf':
            pdf=PdfReader(doc['snapshotPath'])
            def walk(xs):
                for x in xs:
                    if isinstance(x,list):walk(x)
                    else:
                        try:bookmarks.append([pdf.get_destination_page_number(x)+1,x.title])
                        except (TypeError,ValueError):pass
            walk(pdf.outline)
        data=parse(profile,row,doc,pages,bookmarks)
        data['transcriptionSha256']=digest(json.dumps(pages,ensure_ascii=False,separators=(',',':')).encode())
        write(args.output/(row['id']+'.json'),data)
        write(args.output/'pages'/(doc['sha256']+'.json'),{'sourceSha256':doc['sha256'],'extractor':'html-visible-text-v1' if doc['format']=='html' else 'pypdfium2-5.11.0','pages':pages})
        reports.append({'districtId':row['id'],'rules':len(data['provisions']),'first':data['provisions'][0]['number'],'last':data['provisions'][-1]['number'],'coverage':data['coverage']})
        print(row['id'],len(data['provisions']),reports[-1]['first'],reports[-1]['last'],flush=True)
    write(args.output/'index.json',{'version':1,'reviewStatus':'parsed-draft','districts':reports})

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=Path('candidate/parsed-districts'))
    parser.add_argument('--cached-pages',action='store_true',help='Development only: reuse local extraction cache')
    main(parser.parse_args())
