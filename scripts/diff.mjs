import {readFile,writeFile,mkdir} from 'node:fs/promises';
const [before='data',after='candidate/data',output='candidate/diff']=process.argv.slice(2);
const read=async(root,n)=>JSON.parse(await readFile(root+'/'+n+'.json','utf8'));
const a=new Map((await read(before,'provisions')).map(p=>[p.id,p])),b=new Map((await read(after,'provisions')).map(p=>[p.id,p]));
const changes=[];
for(const id of new Set([...a.keys(),...b.keys()])){if(!a.has(id)){changes.push({id,type:'added'});continue}if(!b.has(id)){changes.push({id,type:'deleted'});continue}for(const field of ['number','title','status','body','history','footnotes','dates','editionId'])if(JSON.stringify(a.get(id)[field])!==JSON.stringify(b.get(id)[field]))changes.push({id,type:field,before:a.get(id)[field],after:b.get(id)[field]})}
try{const ar=await read(before,'relationships'),br=await read(after,'relationships');if(JSON.stringify(ar)!==JSON.stringify(br))changes.push({type:'relationships',before:ar,after:br})}catch{changes.push({type:'relationships',status:'Candidate relationships unavailable; review required'})}
await mkdir(output.slice(0,output.lastIndexOf('/'))||'.',{recursive:true});await writeFile(output+'.json',JSON.stringify(changes,null,2)+'\n');await writeFile(output+'.md','# Corpus diff\n\n'+changes.map(c=>`- ${c.id||'Mapping'}: ${c.type}`).join('\n')+'\n');console.log(changes.length+' changes; '+output+'.{json,md}');
