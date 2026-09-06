import {stagePackage,verify} from './integrity.js';
const BUILD='__BUILD__',SHELL='fcr-shell-'+BUILD,BASE=new URL('./',self.location).href;
const FILES=__SHELL_FILES__;
const CONTROL='fcr-control-v1',RUNTIME='fcr-visited-v1';
const metaURL=new URL('__installed__',BASE).href;
let queue=Promise.resolve();
const loadMeta=async()=>{const r=await(await caches.open(CONTROL)).match(metaURL);return r?await r.json():{}};
const saveMeta=async v=>(await caches.open(CONTROL)).put(metaURL,new Response(JSON.stringify(v)));
self.addEventListener('install',event=>event.waitUntil((async()=>{const c=await caches.open(SHELL);await c.addAll(FILES.map(x=>new URL(x,BASE).href))})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const url=event.request.url;
  if(event.request.method!=='GET'||!url.startsWith(BASE))return;
  event.respondWith((async()=>{
    const local=url.slice(BASE.length).split('?')[0];
    if(FILES.includes(local)||local==='')return (await(await caches.open(SHELL)).match(new URL(local||'index.html',BASE).href))||fetch(event.request);
    if(local.startsWith('data/')){
      const installed=await loadMeta();
      for(const m of Object.values(installed)){
        const r=await(await caches.open(m.cacheName)).match(event.request);
        if(r)return r;
      }
      try {
        const r=await fetch(event.request);if(r.ok)await(await caches.open(RUNTIME)).put(event.request,r.clone());return r;
      }catch{return (await(await caches.open(RUNTIME)).match(event.request))||new Response('Package unavailable offline',{status:503})}
    }
    return fetch(event.request);
  })());
});
self.addEventListener('message',event=>{
  if(event.data.type==='activate'){self.skipWaiting();return}
  const port=event.ports[0];
  if(!port)return;
  const task=async()=>{
    const {type,packageId,manifest}=event.data;
    const installed=await loadMeta();
    if(type==='status'){
      for(const [id,m] of Object.entries(installed)) {
        if(!await caches.has(m.cacheName)){delete installed[id];continue}
        const c=await caches.open(m.cacheName);
        for(const a of m.artifacts){const r=await c.match(new URL(a.path,BASE).href);if(!r){m.incomplete=true;break}}
      }
      port.postMessage({done:true,installed});return;
    }
    if(type==='remove'){
      const prior=installed[packageId];delete installed[packageId];await saveMeta(installed);
      if(prior)await caches.delete(prior.cacheName);
      const visited=await caches.open(RUNTIME);
      for(const req of await visited.keys())if(prior?.artifacts.some(a=>new URL(a.path,BASE).href===req.url))await visited.delete(req);
      port.postMessage({done:true});return;
    }
    if(type==='install') {
      // A page can request only the release bound into its application shell.
      const trusted=await(await(await caches.open(SHELL)).match(new URL('data/release.json',BASE).href)).json();
      if(manifest.id!==trusted.id)throw Error('Reload the app before installing a different release.');
      const pkg=trusted.packages[packageId];if(!pkg)throw Error('Unknown package');
      const artifacts=pkg.artifacts.map(path=>trusted.artifacts.find(a=>a.path===path));
      const cacheName=`fcr-package-${packageId}-${trusted.id}-${crypto.randomUUID()}`;
      const previous=installed[packageId];
      await stagePackage({cacheStorage:caches,fetcher:fetch,artifacts,base:BASE,cacheName,onProgress:(done,total)=>port.postMessage({progress:done/total}),promote:async name=>{
        installed[packageId]={cacheName:name,releaseId:trusted.id,verifiedAt:new Date().toISOString(),bytes:artifacts.reduce((n,a)=>n+a.bytes,0),artifacts};
        await saveMeta(installed);
      }});
      if(previous)await caches.delete(previous.cacheName);
      port.postMessage({done:true});
    }
  };
  queue=queue.then(task).catch(error=>port.postMessage({error:error.message}));
  event.waitUntil(queue);
});
