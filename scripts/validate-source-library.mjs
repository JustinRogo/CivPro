import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export async function validateSourceLibrary(library,districts){
  assert.equal(library.version,1);
  assert.equal(library.districts.length,94,'Expected all 94 district source libraries');
  const checked=new Set(),ids=new Set();
  for(const row of library.districts){
    assert(!ids.has(row.id),'Duplicate source district');ids.add(row.id);
    const district=districts.find(d=>d.id===row.id);
    assert(district?.supported,'Source district must be selectable');
    assert(row.documents.length&&row.documents.some(d=>d.role!=='upcoming-edition'),'Missing non-future source');
    for(const doc of row.documents){
      assert(['pdf','html'].includes(doc.format));
      assert.match(doc.sha256,/^[a-f0-9]{64}$/);
      assert.equal(doc.id,doc.sha256.slice(0,16));
      assert.equal(doc.textPath,`data/source-library/${doc.sha256}.json`);
      assert.equal(doc.snapshotPath,`sources/district-snapshots/${doc.sha256}.${doc.format}`);
      assert.equal(doc.pdfPath,doc.format==='pdf'?`data/source-pdfs/${doc.sha256}.pdf`:null);
      assert(new URL(doc.sourceUrl).hostname.endsWith('.uscourts.gov'));
      assert.equal(doc.reviewStatus,'source-document-only');
      if(checked.has(doc.sha256))continue;
      checked.add(doc.sha256);
      const raw=await readFile(doc.snapshotPath);
      assert.equal(raw.length,doc.bytes,'Source size mismatch');
      assert.equal(createHash('sha256').update(raw).digest('hex'),doc.sha256,'Source hash mismatch');
      if(doc.format==='pdf')assert.equal(raw.subarray(0,5).toString(),'%PDF-');
      const text=JSON.parse(await readFile(doc.textPath,'utf8'));
      assert.equal(text.sourceSha256,doc.sha256);
      assert.equal(text.pages.length,doc.pageCount);
      assert(text.pages.some(p=>p.text.trim()),'Empty source transcription');
      text.pages.forEach((p,i)=>{assert.equal(p.number,i+1);assert.equal(typeof p.text,'string')});
    }
  }
  for(const d of districts.filter(d=>d.id!=='us'))assert(ids.has(d.id),'Missing source library '+d.id);
  return checked.size;
}
