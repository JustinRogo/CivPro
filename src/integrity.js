export async function verify(bytes, artifact) {
  if(bytes.byteLength!==artifact.bytes)throw Error(`Size mismatch: ${artifact.path}`);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==artifact.sha256)throw Error(`Hash mismatch: ${artifact.path}`);
  return true;
}
export async function stagePackage({cacheStorage,fetcher,artifacts,base,cacheName,promote,onProgress=()=>{}}) {
  const cache=await cacheStorage.open(cacheName);
  try {
    for(let i=0;i<artifacts.length;i++) {
      const a=artifacts[i],url=new URL(a.path,base).href;
      if(new URL(url).origin!==new URL(base).origin||!url.startsWith(base))throw Error('Invalid artifact path');
      const response=await fetcher(url,{cache:'no-store'});
      if(!response.ok)throw Error(`Download failed (${response.status}): ${a.path}`);
      await verify(await response.clone().arrayBuffer(),a);
      await cache.put(url,response);
      onProgress(i+1,artifacts.length);
    }
    await promote(cacheName);
  } catch(error) {await cacheStorage.delete(cacheName);throw error}
}
