export function read(key, fallback) {
  try {const raw=localStorage.getItem('fcr.'+key);if(raw===null)return fallback;const value=JSON.parse(raw);if(Array.isArray(fallback))return Array.isArray(value)?value:fallback;return typeof value===typeof fallback?value:fallback} catch {return fallback}
}
export function write(key, value) {
  try {localStorage.setItem('fcr.'+key,JSON.stringify(value));return true} catch {return false}
}
export function bookmarkKey(p) {return p.id+'@'+p.editionId}
export function validateBookmarks(value) {
  if(!Array.isArray(value) || value.length>5000) throw Error('Choose a Federal Civil Rules bookmark export (up to 5,000 entries).');
  return value.map(x=>{
    if(!x || typeof x.id!=='string' || typeof x.editionId!=='string' || typeof x.title!=='string' || typeof x.href!=='string' || !/^#\/(federal|district)\//.test(x.href) || x.href.length>1500) throw Error('The bookmark file contains an invalid entry.');
    return {id:x.id,editionId:x.editionId,title:x.title.slice(0,400),href:x.href,district:typeof x.district==='string'&&/^[a-z-]+$/.test(x.district)?x.district:'none'};
  });
}
