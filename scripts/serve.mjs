import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist'),port=Number(process.env.PORT||4173);
const base=process.env.FCR_BASE_PATH||'/CivPro/';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf'};
http.createServer(async(req,res)=>{try{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name==='/'&&base!=='/'){res.writeHead(302,{Location:base});return res.end()}if(!name.startsWith(base)){res.writeHead(404);return res.end('Not found')}name=name.slice(base.length);let file=path.resolve(root,name||'index.html');if(!file.startsWith(root+path.sep))throw Error('Invalid path');if((await stat(file)).isDirectory())file=path.join(file,'index.html');const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(bytes)}catch{res.writeHead(404);res.end('Not found')}}).listen(port,'127.0.0.1',()=>console.log(`Federal Civil Rules: http://127.0.0.1:${port}${base}`));
