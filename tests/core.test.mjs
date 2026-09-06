import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {routeFor,parseRoute} from '../src/routes.js';
import {compileQuery,citationQuery,searchDocuments} from '../src/search.js';
import {validateBookmarks,bookmarkKey} from '../src/state.js';
import {stagePackage,verify} from '../src/integrity.js';
const corpus=JSON.parse(await readFile('data/provisions.json','utf8'));
const rule=id=>corpus.find(p=>p.id===id);
const docs=corpus.map(p=>({...p,text:p.body.map(b=>b.text).join(' '),history:p.history.map(b=>b.text).join(' '),notes:p.footnotes.map(b=>b.text).join(' ')}));
test('complete named collections and grouped entries survive ingestion',()=>{
  assert.deepEqual(Object.entries(Object.groupBy(corpus,p=>p.collectionId)).map(([k,v])=>[k,v.length]),[['federal-frcp',98],['federal-admiralty',7],['federal-social',8],['federal-support',6],['ctd-civil',62],['ctd-magistrate',3],['ctd-support',8]]);
  assert.equal(rule('federal-frcp:16.1').title,'Multidistrict Litigation');
  assert.equal(rule('ctd-civil:13-15').status,'reserved');assert.equal(rule('ctd-civil:72-73').status,'cross-reference');
  assert.equal(rule('federal-frcp:84').status,'abrogated');assert.equal(rule('ctd-civil:83.8').status,'reserved');
  assert(corpus.every(p=>!p.collectionId.includes('criminal')));
});
test('Rule 56 remains separate, preserves amendment wording and spans pages',()=>{
  const f=rule('federal-frcp:56'),c=rule('ctd-civil:56');
  assert(f.body[0].text.includes('no genuine dispute as to any material fact'));
  assert(c.body.some(b=>b.text.includes('twelve (12) double-spaced pages')));
  assert(!f.body.some(b=>b.text.includes('twelve (12) double-spaced pages')));
  assert(c.body.find(b=>b.id==='a/3').pages.length===2);
  assert.equal(c.dates.amendmentDate,'2018-06-28');assert.equal(c.dates.effectiveDate,null);
  assert.equal(c.history[0].text,'(Amended June 28, 2018)');
});
test('complex anchors, source footnotes, and independent supplemental IDs',()=>{
  assert(rule('federal-frcp:26').body.some(b=>b.id==='b/1'&&b.text.includes('proportional')));
  assert(rule('federal-frcp:4').body.some(b=>b.id==='i'));
  assert(rule('ctd-civil:56').body.some(b=>b.id==='a/2/i'));
  assert(rule('federal-support:notes-140').footnotes[0].text.includes('House Document 117–110'));
  assert(rule('federal-social:1').id!==rule('federal-frcp:1').id);
  assert(rule('ctd-magistrate:72.1').body.some(b=>b.text.includes('civil and criminal proceedings')));
});
test('routes round-trip paragraph, edition, and shared district',()=>{
  const href=routeFor(rule('federal-frcp:26'),{district:'none',anchor:'b/1',edition:'saved-2025'}),r=parseRoute(href);
  assert.equal(r.collectionId,'federal-frcp');assert.equal(r.number,'26');assert.equal(r.anchor,'b/1');assert.equal(r.params.get('district'),'none');assert.equal(r.params.get('edition'),'saved-2025');
  assert.equal(parseRoute(routeFor(rule('ctd-civil:83.10'))).collectionId,'ctd-civil');
});
test('Boolean precedence, grouping, phrases, and word boundaries',()=>{
  assert(compileQuery('summary AND (judgment OR trial) NOT appeal')('summary judgment'));
  assert(!compileQuery('summary AND (judgment OR trial) NOT appeal')('summary judgment appeal'));
  assert(compileQuery('trial OR motion AND relief')('trial'));
  assert(!compileQuery('trial OR motion AND relief')('motion alone'));
  assert(!compileQuery('trial')('pretrial'));
  assert(compileQuery('"summary judgment"')('the summary judgment motion'));
  for(const q of ['"open','(summary','summary AND','summary )'])assert.throws(()=>compileQuery(q));
});
test('citation recognition and search scopes resolve collisions honestly',()=>{
  assert.equal(citationQuery('D. Conn. L. Civ. R. 56').collection,'ctd-civil');
  assert.equal(citationQuery('Rule 26(b)(1)').anchor,'b/1');
  assert.deepEqual(searchDocuments(docs,'FRCP 56').map(p=>p.id),['federal-frcp:56']);
  assert.deepEqual(searchDocuments(docs,'D. Conn. L. Civ. R. 56').map(p=>p.id),['ctd-civil:56']);
  assert(searchDocuments(docs,'56').length===2);
  assert(searchDocuments(docs,'56',{district:'none'}).every(p=>p.districtId==='us'));
  assert(searchDocuments(docs,'summary AND judgment',{scope:'district'}).every(p=>p.districtId==='ctd'));
  assert(searchDocuments(docs,'2018',{field:'history'}).some(p=>p.id==='ctd-civil:56'));
});
test('bookmark import rejects executable URLs and preserves edition identity',()=>{
  assert.throws(()=>validateBookmarks([{id:'x',editionId:'y',title:'bad',href:'javascript:alert(1)'}]));
  const p=rule('ctd-civil:56'),b={id:p.id,editionId:p.editionId,title:p.title,href:routeFor(p)};
  assert.equal(validateBookmarks([b]).length,1);assert.notEqual(bookmarkKey(p),bookmarkKey({...p,editionId:'other'}));
});
function fakeCaches({quota=false}={}){const stores=new Map();return {stores,open:async name=>{if(!stores.has(name))stores.set(name,new Map());return {put:async(k,v)=>{if(quota)throw Error('QuotaExceededError');stores.get(name).set(k,v)}}},delete:async name=>stores.delete(name)}}
const bytes=new TextEncoder().encode('verified text');
const artifact={path:'data/rule.json',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
test('offline integrity rejects tampering and wrong size',async()=>{
  await verify(bytes,artifact);await assert.rejects(verify(bytes,{...artifact,sha256:'0'.repeat(64)}),/Hash mismatch/);await assert.rejects(verify(bytes,{...artifact,bytes:1}),/Size mismatch/);
});
for(const failure of ['interrupted','corrupted','quota'])test(`failed ${failure} download leaves the previous complete generation active`,async()=>{
  const caches=fakeCaches({quota:failure==='quota'});let pointer='previous';caches.stores.set(pointer,new Map());let calls=0;
  const fetcher=async()=>{calls++;if(failure==='interrupted'&&calls===2)throw Error('Connection lost');return new Response(failure==='corrupted'?'wrong bytes':bytes)};
  await assert.rejects(stagePackage({cacheStorage:caches,fetcher,artifacts:[artifact,{...artifact,path:'data/search.json'}],base:'https://example.test/CivPro/',cacheName:'staging',promote:async name=>pointer=name}));
  assert.equal(pointer,'previous');assert(caches.stores.has('previous'));assert(!caches.stores.has('staging'));
});
test('complete verified package promotes only after the final write',async()=>{
  const caches=fakeCaches();let promoted=false,count=0;
  await stagePackage({cacheStorage:caches,fetcher:async()=>new Response(bytes),artifacts:[artifact],base:'https://example.test/CivPro/',cacheName:'staging',onProgress:()=>count++,promote:async name=>{assert.equal(count,1);assert.equal(caches.stores.get(name).size,1);promoted=true}});assert(promoted);
});
