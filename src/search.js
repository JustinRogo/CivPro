export const normalize = s => String(s).normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'");
export function citationQuery(query) {
  const q=query.trim();
  const m=q.match(/^(?:(FRCP|Fed\.?\s*R\.?\s*Civ\.?\s*P\.?|D\.?\s*Conn\.?\s*L\.?\s*Civ\.?\s*R\.?)\s*|Rule\s+)?((?:\d+[a-z]?|[A-Z]|HC)(?:[.\-]\d+[a-z]?)*)(\s*(?:\([a-zA-Z0-9]+\))*)$/i);
  if(!m)return null;
  return {number:m[2],collection:m[1] ? /^D/i.test(m[1])?'ctd-civil':'federal-frcp':null,anchor:[...m[3].matchAll(/\((\w+)\)/g)].map(x=>x[1]).join('/')};
}
export function compileQuery(query) {
  if((query.match(/"/g)||[]).length%2)throw Error('Close the quotation mark to search an exact phrase.');
  const tokens=query.match(/"[^"]*"|\(|\)|[^\s()]+/g)||[];
  let i=0;
  const atom=()=>{
    const t=tokens[i++];
    if(!t)throw Error('A search term is missing.');
    if(t==='NOT'){const a=atom();return s=>!a(s)}
    if(t==='('){const a=or();if(tokens[i++]!==')')throw Error('Close the parenthesis.');return a}
    if(['AND','OR',')'].includes(t))throw Error('Unexpected '+t+'.');
    const term=normalize(t.replace(/^"|"$/g,''));
    if(!term)throw Error('Enter a word inside the quotation marks.');
    const pattern=new RegExp('(?:^|[^\\p{L}\\p{N}])'+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+')+'(?=$|[^\\p{L}\\p{N}])','u');
    return s=>pattern.test(s);
  };
  const and=()=>{let a=atom();while(i<tokens.length && !['OR',')'].includes(tokens[i])){if(tokens[i]==='AND')i++;const b=atom(),prev=a;a=s=>prev(s)&&b(s)}return a};
  const or=()=>{let a=and();while(tokens[i]==='OR'){i++;const b=and(),prev=a;a=s=>prev(s)||b(s)}return a};
  if(!tokens.length)return ()=>false;
  const result=or();if(i<tokens.length)throw Error('Unexpected closing parenthesis.');return result;
}
export function searchDocuments(documents, query, {scope='combined',district='ctd',collection='',field='text',support=false}={}) {
  const citation=['text','citation'].includes(field)?citationQuery(query):null, predicate=citation?null:compileQuery(query);
  const hits=[];
  for(const d of documents){
    const federal=d.districtId==='us';
    if(scope==='federal'&&!federal || scope==='district'&&federal || !federal&&(district==='none'||d.districtId!==district))continue;
    if(collection&&d.collectionId!==collection)continue;
    if(!support&&d.collectionId.endsWith('-support'))continue;
    const hay=field==='title'?d.title:field==='citation'?d.citation:field==='history'?d.history:field==='notes'?d.notes:field==='all'?[d.citation,d.title,d.text,d.history,d.notes].join(' '):[d.citation,d.title,d.text].join(' ');
    if(citation ? d.number!==citation.number || citation.collection&&d.collectionId!==citation.collection : !predicate(normalize(hay)))continue;
    const terms=query.replace(/"|\b(?:AND|OR|NOT)\b/g,' ').trim().split(/\s+/);
    const at=Math.max(0,...terms.map(t=>normalize(hay).indexOf(normalize(t))).filter(n=>n>=0).slice(0,1));
    const start=Math.max(0,at-65);
    hits.push({...d, text:undefined, history:undefined, notes:undefined,snippet:(start?'…':'')+hay.slice(start,start+240)+(hay.length>start+240?'…':''), score:citation?100:terms.reduce((n,t)=>n+(normalize(d.title).includes(normalize(t))?10:1),0),anchor:d.editionId.includes('-parsed-v1-')?null:citation?.anchor||null});
  }
  return hits.sort((a,b)=>b.score-a.score||a.collectionId.localeCompare(b.collectionId)||a.number.localeCompare(b.number,undefined,{numeric:true}));
}
