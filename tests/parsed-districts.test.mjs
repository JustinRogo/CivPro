import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateParsedDistricts} from '../scripts/validate-parsed-districts.mjs';
import {citationQuery,searchDocuments} from '../src/search.js';
const rows=await validateParsedDistricts();
const row=id=>rows.find(r=>r.districtId===id);
test('93 district rule collections preserve every source slice in their declared ranges',()=>{
  assert.equal(rows.length,93);assert.equal(rows.reduce((n,r)=>n+r.provisions.length,0),6313);
  assert(rows.every(r=>r.provisions.length&&r.reviewStatus==='parsed-draft'&&!r.coverage.tocReconciled));
});
test('civil-to-criminal transitions and shared-page boundaries do not leak into final rules',()=>{
  for(const [id,number,end] of [['mad','83.6.11',131],['mdd','113',45],['ndd','72.1',59],['ohsd','83.6',42],['njd','601.7',112],['almd','83.5',35],['alsd','105',63]]){
    const r=row(id),last=r.provisions.at(-1);assert.equal(last.number,number);assert.equal(last.pageSpan[1]+1,end);
    assert(!last.body.some(b=>/^(?:PART \d: LOCAL CRIMINAL RULES|PART C: CRIMINAL RULES|LOCAL CRIMINAL RULES|CRIMINAL RULES|II\. CRIMINAL)$/m.test(b.text)));
  }
  assert(!row('med').provisions.some(p=>p.number==='101'),'An inline reference is not a rule heading');
  assert(!row('moed').provisions.some(p=>p.number==='16'),'A patent-rule reference must not become a rule');
});
test('source rule numbers retain hyphens, multiple decimals and letters; ordinary words remain text queries',()=>{
  for(const q of ['Rule 56-1','83.6.11','83M','HC.1','A.1'])assert(citationQuery(q));
  assert.equal(citationQuery('discovery'),null);
  for(const [id,num] of [['cand','56-1'],['mad','83.6.11'],['prd','83M'],['casd','HC.1'],['ord','7-1']])assert(row(id).provisions.some(p=>p.number===num),id+' '+num);
});
test('district citation search returns parsed rules without inventing subsection anchors',()=>{
  const docs=row('mad').provisions.map(p=>({...p,text:p.body.map(b=>b.text).join('\n'),history:'',notes:''}));
  const hits=searchDocuments(docs,'Rule 56.1(a)',{district:'mad',scope:'district'});
  assert.equal(hits.length,1);assert.equal(hits[0].number,'56.1');assert.equal(hits[0].anchor,null);
  assert(hits[0].title.includes('SUMMARY JUDGMENT'));
});
test('parsed district registry and source-only future editions remain separate',async()=>{
  const districts=JSON.parse(await readFile('data/districts.json','utf8'));
  for(const r of rows)assert(districts.find(d=>d.id===r.districtId).collections.includes(r.collection.id));
  assert.equal(row('miwd').sourceDocument.role,'current-web-edition');
  assert.equal(row('ord').sourceDocument.format,'html');
  assert.deepEqual(row('nyed').provisions.map(p=>p.number),row('nysd').provisions.map(p=>p.number));
});
