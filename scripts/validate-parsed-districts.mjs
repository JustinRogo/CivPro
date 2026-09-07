import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function validateParsedDistricts(root='data/parsed-districts'){
  const index=await json(root+'/index.json'),profiles=(await json('sources/district-parse-profiles.json')).profiles;
  assert.equal(index.reviewStatus,'parsed-draft');assert.equal(index.districts.length,93);
  const validate=new Ajv().compile(await json('schemas/provision.schema.json'));
  const ids=new Set(),records=[],pageCache=new Map();
  for(const entry of index.districts){
    assert(!ids.has(entry.districtId));ids.add(entry.districtId);
    const row=await json(root+'/'+entry.districtId+'.json'),doc=row.sourceDocument,profile=profiles.find(p=>p.districtId===row.districtId);
    assert.equal(row.reviewStatus,'parsed-draft');assert.equal(doc.sha256,profile.sourceSha256);assert.notEqual(doc.role,'upcoming-edition');
    assert.equal(sha(await readFile(doc.snapshotPath)),doc.sha256);
    assert.equal(row.coverage.tocReconciled,false);assert.equal(row.coverage.editorialReviewComplete,false);assert.equal(row.coverage.currencyReviewed,false);
    if(!pageCache.has(doc.sha256))pageCache.set(doc.sha256,(await json(root+'/pages/'+doc.sha256+'.json')).pages);
    const pages=pageCache.get(doc.sha256);
    assert.equal(sha(JSON.stringify(pages)),row.transcriptionSha256,'Transcription hash mismatch');
    assert.equal(pages.length,doc.pageCount);assert.equal(row.provisions.length,entry.rules);assert(row.provisions.length>0);
    let cursor=[row.coverage.startPage,row.coverage.startOffset];
    const numbers=new Set();
    for(const [i,p] of row.provisions.entries()){
      assert(validate(p),JSON.stringify(validate.errors));assert(!numbers.has(p.number));numbers.add(p.number);
      assert.equal(p.id,row.collection.id+':'+p.number);assert.equal(p.districtId,row.districtId);assert.equal(p.collectionId,row.collection.id);
      assert.equal(p.sourceUrl,doc.sourceUrl);assert(p.editionId.endsWith(doc.sha256.slice(0,16)));
      const e=row.evidence[i];assert.equal(e.number,p.number);assert.equal(e.slices.length,p.body.length);
      assert(pages[e.page-1].text.slice(e.offset).trimStart().startsWith(e.heading));
      for(const [j,b] of p.body.entries()){
        const s=e.slices[j];
        while(cursor[0]<s.page){assert.equal(cursor[1],pages[cursor[0]-1].text.length);cursor=[cursor[0]+1,0]}
        assert.deepEqual([s.page,s.start],cursor,'Unaccounted text gap or overlap '+p.id);
        assert.equal(b.text,pages[s.page-1].text.slice(s.start,s.end),'Rule text does not match source transcription');
        assert.equal(sha(b.text),s.sha256);assert.deepEqual(b.pages,[s.page-1]);assert.equal(b.id,'page-'+s.page);
        cursor=[s.page,s.end];
      }
      assert.equal(p.pageSpan[0],e.slices[0].page-1);assert.equal(p.pageSpan[1],e.slices.at(-1).page-1);
    }
    while(cursor[0]<row.coverage.endPage){assert.equal(cursor[1],pages[cursor[0]-1].text.length);cursor=[cursor[0]+1,0]}
    assert.deepEqual(cursor,[row.coverage.endPage,row.coverage.endOffset]);records.push(row);
  }
  assert.equal(profiles.length,records.length);
  return records;
}
