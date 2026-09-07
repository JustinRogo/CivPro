import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sourceHref,sourceSelection,findSourcePages,packagePaths} from '../src/source-library.js';
import {parseRoute} from '../src/routes.js';
import {validateSourceLibrary} from '../scripts/validate-source-library.mjs';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const library=await json('data/source-library.json'),districts=await json('data/districts.json');
test('all 94 selectable districts have hash-verified snapshots and nonempty page text',async()=>{
  assert.equal(districts.filter(d=>d.supported&&d.id!=='us').length,94);
  assert.equal(districts.filter(d=>d.readerMode==='structured').length,93);
  assert.equal(await validateSourceLibrary(library,districts),96);
});
test('source routes preserve document identity and reject invalid pages and editions',()=>{
  const row=library.districts.find(d=>d.id==='mad'),doc=row.documents[0];
  const route=parseRoute(sourceHref(row.id,{document:doc.id,page:17,q:'"summary judgment"'}));
  assert.equal(route.districtId,'mad');assert.equal(route.collectionId,'mad-sources');
  assert.equal(sourceSelection(row,route.params).page,17);
  for(const page of ['0','-1','1.5','NaN',String(doc.pageCount+1)])assert.throws(()=>sourceSelection(row,new URLSearchParams({page})));
  assert.throws(()=>sourceSelection(row,new URLSearchParams({document:'missing'})));
});
test('Western Michigan defaults to its web edition; Oregon retains printable HTML',()=>{
  const michigan=library.districts.find(d=>d.id==='miwd');
  assert.equal(sourceSelection(michigan,new URLSearchParams()).document.role,'current-web-edition');
  const future=michigan.documents.find(d=>d.role==='upcoming-edition');
  assert.equal(sourceSelection(michigan,new URLSearchParams({document:future.id})).document.role,'upcoming-edition');
  assert.equal(library.districts.find(d=>d.id==='ord').documents[0].format,'html');
});
test('page search applies Boolean expressions and preserves original page numbers',()=>{
  const pages=[{number:1,text:'Summary judgment is available.'},{number:2,text:'Summary judgment requires notice.'},{number:3,text:'Pleading notices.'}];
  assert.deepEqual(findSourcePages(pages,'"summary judgment" AND NOT notice').map(x=>x.number),[1]);
  assert.deepEqual(findSourcePages(pages,'notice OR pleading').map(x=>x.number),[2,3]);
  assert.deepEqual(findSourcePages(pages,''),[]);
  assert.throws(()=>findSourcePages(pages,'AND'));
});
test('district packages include only their documents, with shared NY documents in both packages',()=>{
  const artifacts=[{path:'data/catalog.json'},{path:'data/editions/federal-frcp/edition/provisions.json'},...library.districts.flatMap(r=>r.documents.flatMap(d=>[d.textPath,d.pdfPath].filter(Boolean).map(path=>({path}))))];
  const paths=id=>packagePaths(artifacts,districts.find(d=>d.id===id),library.districts.find(d=>d.id===id));
  const mad=library.districts.find(d=>d.id==='mad').documents[0];
  assert(paths('mad').includes(mad.pdfPath));assert(paths('mad').includes(mad.textPath));
  assert(!paths('mad').some(p=>p.includes('editions/')));assert(!paths('us').includes(mad.textPath));
  assert(!paths('ctd').includes(mad.pdfPath));
  const ny=library.districts.find(d=>d.id==='nyed').documents[0];
  assert(paths('nyed').includes(ny.pdfPath));assert(paths('nysd').includes(ny.pdfPath));
});
