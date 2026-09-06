// One-time, explicit initial import. No refresh workflow runs this command.
import {cp,writeFile} from 'node:fs/promises';
import {json} from './validate.mjs';
for(const name of ['provisions','sources','inventory'])await cp('candidate/data/'+name+'.json','data/'+name+'.json');
const rules=await json('data/provisions.json');
const specs=[
  ['ctd-civil:56','federal-frcp:56','a/2/i','Federal Rule of Civil Procedure 56(c).',63],
  ['ctd-civil:26','federal-frcp:26','e','In accordance with Fed.R.Civ.P. 26(b)',41],
  ['ctd-civil:26','federal-frcp:16','f/2','pursuant to Fed.R.Civ.P. 16(b).',42],
  ['ctd-magistrate:72.2','federal-frcp:53','c','Review of special master proceedings shall be in accordance with Rule 53, Fed. R. Civ. P., to the extent applicable.',136]
];
const links=specs.map(([from,to,anchor,passage,pageIndex],i)=>{const p=rules.find(x=>x.id===from),q=rules.find(x=>x.id===to);if(!p.body.find(b=>b.id===anchor)?.text.includes(passage))throw Error('Reviewed evidence changed: '+from);return {id:'explicit-'+(i+1),from,to,type:'explicit-citation',status:'verified',editions:[p.editionId,q.editionId],reviewer:'Codex — source citation checked; not a legal applicability determination',reviewedAt:'2026-09-06',evidence:{sourceDocumentId:p.sourceDocumentId,pageIndex,passage}}});
await writeFile('data/relationships.json',JSON.stringify({version:1,reviewStatus:'partial',reviewedProvisions:[],links},null,2)+'\n');
console.log('Initial candidate imported with four explicit citation links. Full mapping review remains incomplete.');
