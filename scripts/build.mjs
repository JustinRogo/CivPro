import {cp,mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv';
import {validate,json,sha} from './validate.mjs';
const {provisions,sources,relationships}=await validate();
const review=await json('data/review.json');
if(process.argv.includes('--production')){
  if(review.status!=='approved'||review.corpusSha256!==sha(await readFile('data/provisions.json')))throw Error('Production publication requires a completed review bound to the canonical corpus hash. See docs/DEPLOYMENT.md.');
  if(!process.env.FCR_SITE_URL)throw Error('Set FCR_SITE_URL to the final HTTPS publication URL.');
}
const root=process.cwd(),output=path.resolve(root,'dist');
if(output!==path.join(root,'dist'))throw Error('Unsafe build output');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
await cp('src',output,{recursive:true});await cp('public',output,{recursive:true});
const write=async(p,v)=>{await mkdir(path.dirname(p),{recursive:true});await writeFile(p,typeof v==='string'?v:JSON.stringify(v)+'\n')};
const definitions=await json('data/collections.json');
const catalog={version:1,districts:await json('data/districts.json'),collections:[],provisions:[]},artifacts=[];
const add=async(rel,value)=>{const data=JSON.stringify(value)+'\n';await write(path.join(output,rel),data);artifacts.push({path:rel,bytes:Buffer.byteLength(data),sha256:sha(data)})};
for(const definition of definitions){
  const items=provisions.filter(p=>p.collectionId===definition.id),editionId=items[0].editionId;
  const prefix=`data/editions/${definition.id}/${editionId}`;
  const edition={id:editionId,collectionId:definition.id,sourceDocumentId:items[0].sourceDocumentId,label:sources.find(x=>x.id===items[0].sourceDocumentId).editionLabel,path:prefix+'/provisions.json',searchPath:prefix+'/search.json'};
  catalog.collections.push({...definition,count:items.length,editions:[edition]});
  await add(edition.path,items);
  const search=items.map(p=>({id:p.id,collectionId:p.collectionId,districtId:p.districtId,number:p.number,citation:p.citation,title:p.title,editionId:p.editionId,text:p.body.map(b=>b.text).join('\n'),history:p.history.map(b=>b.text).join('\n'),notes:p.footnotes.map(b=>b.text).join('\n')}));
  await add(edition.searchPath,search);
  catalog.provisions.push(...items.map(({id,collectionId,districtId,number,citation,title,status,group,editionId})=>({id,collectionId,districtId,number,citation,title,status,group,editionId})));
}
await add('data/catalog.json',catalog);await add('data/sources.json',sources);
await add('data/relationships.json',{...relationships,reverse:Object.fromEntries(provisions.map(p=>[p.id,relationships.links.filter(l=>l.from===p.id||l.to===p.id).map(l=>l.id)]))});
await add('data/inventory.json',await json('data/inventory.json'));
const release={version:1,id:sha(JSON.stringify(artifacts)).slice(0,16),reviewStatus:'candidate',artifacts,packages:{}};
for(const d of catalog.districts.filter(d=>d.supported)){const id=d.id==='us'?'federal':d.id;release.packages[id]={label:d.id==='us'?'Federal collections':d.name+' collections',artifacts:artifacts.filter(a=>!a.path.startsWith('data/editions/')||d.collections.some(c=>a.path.startsWith('data/editions/'+c+'/'))).map(a=>a.path)}};
await write(output+'/data/release.json',release);
const site=new URL(process.env.FCR_SITE_URL||'https://example.github.io/CivPro/');if(!site.pathname.endsWith('/'))throw Error('FCR_SITE_URL must end in /');
await write(output+'/manifest.webmanifest',{id:site.pathname,name:'Federal Civil Rules',short_name:'Civil Rules',description:'Federal and Connecticut civil rules, in context.',start_url:site.pathname+'#/',scope:site.pathname,display:'standalone',background_color:'#f8f8f3',theme_color:'#183e35',icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]});
await write(output+'/.nojekyll','');
await cp(output+'/index.html',output+'/404.html');
const shell=(await readdir(output)).filter(n=>!['sw.js','data','.nojekyll'].includes(n));shell.push('data/catalog.json','data/release.json','data/sources.json','data/relationships.json');
const buildId=sha((await Promise.all(shell.map(f=>readFile(output+'/'+f)))).map(sha).join('')).slice(0,16);
const worker=await readFile('src/sw.js','utf8');await write(output+'/sw.js',worker.replace('__BUILD__',buildId).replace('__SHELL_FILES__',JSON.stringify(shell)));
const ajv=new Ajv();
for(const [name,value]of [['catalog',catalog],['release-manifest',release]]){const check=ajv.compile(await json(`schemas/${name}.schema.json`));if(!check(value))throw Error(JSON.stringify(check.errors))}
console.log(`Built ${provisions.length} provisions · release ${release.id} · base ${site.pathname} · dist/`);
