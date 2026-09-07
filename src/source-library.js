import {compileQuery,normalize} from './search.js';

export const sourceHref=(district,{document,page=1,q=''}={})=>'#/district/'+encodeURIComponent(district)+'/sources?'+new URLSearchParams({district,...(document?{document}:{}),page:String(page),...(q?{q}:{})});

export function sourceSelection(library,params){
  const requested=params.get('document');
  const document=requested?library.documents.find(d=>d.id===requested):library.documents.find(d=>d.role!=='upcoming-edition');
  if(!document)throw Error('The source edition in this link is unavailable. Open the district library to choose a stored edition.');
  const page=Number(params.get('page')||1);
  if(!Number.isInteger(page)||page<1||page>document.pageCount)throw Error('This source page is outside the stored document.');
  return {document,page};
}

export function findSourcePages(pages,query){
  if(!query.trim())return [];
  const predicate=compileQuery(query);
  const terms=query.match(/[\p{L}\p{N}]+/gu)||[];
  return pages.filter(p=>predicate(normalize(p.text))).map(p=>{
    const text=p.text.replace(/\s+/g,' ');
    const offsets=terms.filter(t=>!['AND','OR','NOT'].includes(t)).map(t=>normalize(text).indexOf(normalize(t))).filter(i=>i>=0);
    const at=Math.max(0,(offsets.length?Math.min(...offsets):0)-60);
    return {number:p.number,snippet:(at?'…':'')+text.slice(at,at+260)+(at+260<text.length?'…':'')};
  });
}

// Source artifacts belong only to the selected district's offline package.
export function packagePaths(artifacts,district,library){
  const own=new Set((library?.documents||[]).flatMap(d=>[d.textPath,d.pdfPath].filter(Boolean)));
  return artifacts.filter(a=>{
    if(a.path.startsWith('data/source-library/')||a.path.startsWith('data/source-pdfs/'))return own.has(a.path);
    if(a.path.startsWith('data/editions/'))return district.collections.some(c=>a.path.startsWith('data/editions/'+c+'/'));
    return true;
  }).map(a=>a.path);
}
