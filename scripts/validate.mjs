import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import Ajv from 'ajv';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const json=async path=>JSON.parse(await readFile(path,'utf8'));
export async function validate(data='data') {
  const ajv=new Ajv({allErrors:true});
  const contracts={};
  for(const name of ['provision','source-document','relationship','district'])contracts[name]=ajv.compile(await json(`schemas/${name}.schema.json`));
  function check(name,value){assert(contracts[name](value),name+': '+JSON.stringify(contracts[name].errors));}
  const [provisions,sources,relationships,inventory]=await Promise.all(['provisions','sources','relationships','inventory'].map(n=>json(`${data}/${n}.json`)));
  const ids=new Map();
  for(const s of sources){check('source-document',s);const raw=await readFile('sources/snapshots/'+s.path);assert.equal(raw.length,s.bytes);assert.equal(sha(raw),s.sha256)}
  for(const p of provisions){check('provision',p);assert(!ids.has(p.id),'Duplicate '+p.id);ids.set(p.id,p);assert.equal(p.id,p.collectionId+':'+p.number);assert.equal(p.districtId,p.collectionId.startsWith('federal-')?'us':p.collectionId.split('-')[0]);const source=sources.find(x=>x.id===p.sourceDocumentId);assert(source,'Missing source');assert(p.editionId.endsWith(source.sha256.slice(0,16)));assert.equal(p.sourceUrl,source.url);assert(p.pageSpan[0]<=p.pageIndex&&p.pageSpan[1]>=p.pageIndex);assert(p.pageSpan[1]<source.pageCount);assert(p.status!=='active'||p.body.length+p.footnotes.length>0,'Empty active rule '+p.id);
    const anchors=new Set();
    for(const b of [...p.body,...p.history,...p.footnotes]){assert(!anchors.has(b.id),'Duplicate anchor '+p.id+'/'+b.id);if(b.parent)assert(anchors.has(b.parent),'Missing parent '+p.id+'/'+b.id);anchors.add(b.id);assert(b.pages.length>0);for(const page of b.pages)assert(page>=p.pageSpan[0]&&page<=p.pageSpan[1]);assert(!/[\uFFFD\u0000-\u0008]/u.test(b.text),'Unresolved extraction character');assert(!/^(\d+)$/.test(b.text),'Unexplained standalone page number');}
  }
  const linkIds=new Set();
  for(const r of relationships.links){check('relationship',r);assert(!linkIds.has(r.id),'Duplicate relationship');linkIds.add(r.id);const from=ids.get(r.from),to=ids.get(r.to);assert(from&&to,'Unresolved relationship');assert(r.editions.includes(from.editionId)&&r.editions.includes(to.editionId),'Stale mapping edition');assert.equal(from.sourceDocumentId,r.evidence.sourceDocumentId);assert(from.body.some(b=>b.text.includes(r.evidence.passage)&&b.pages.includes(r.evidence.pageIndex)),'Relationship passage not in source provision');}
  for(const i of inventory){assert(i.tocReconciled,'Unreconciled inventory');assert.equal(provisions.filter(p=>p.sourceDocumentId===i.source).length,i.provisions,'Inventory count mismatch')}
  for(const d of await json(`${data}/districts.json`))check('district',d);
  console.log(`Validated ${provisions.length} provisions, ${sources.length} PDF hashes, ${relationships.links.length} reviewed relationships, and both inventories.`);
  return {provisions,sources,relationships,inventory};
}
if(process.argv[1]===fileURLToPath(import.meta.url))await validate(process.argv[2]||'data');
