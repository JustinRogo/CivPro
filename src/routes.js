export function routeFor(p, {district='ctd', edition=null, anchor=null}={}) {
  const [region, collection] = p.collectionId.split('-');
  const base = region === 'federal' ? `/federal/${collection}` : `/district/${region}/${collection}`;
  const query = new URLSearchParams({district});
  if (edition) query.set('edition', edition);
  return `#${base}/rule/${encodeURIComponent(p.number)}${anchor ? '/p/'+anchor.split('/').map(encodeURIComponent).join('/') : ''}?${query}`;
}
export function parseRoute(hash) {
  const [path, query=''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean).map(x=>{try{return decodeURIComponent(x)}catch{return x}});
  const params = new URLSearchParams(query);
  let collectionId=null, number=null, anchor=null;
  if(parts[0]==='federal' && parts[1]) collectionId='federal-'+parts[1];
  if(parts[0]==='district' && parts[1] && parts[2]) collectionId=parts[1]+'-'+parts[2];
  const pos=parts.indexOf('rule');
  if(pos>=0) {number=parts[pos+1]; if(parts[pos+2]==='p') anchor=parts.slice(pos+3).join('/')}
  return {page:parts[0] || 'home', districtId:parts[0]==='district'?parts[1]||null:null, collectionId, number, anchor, params};
}
