import {sourceHref,sourceSelection,findSourcePages} from './source-library.js';
import {read,write,bookmarkKey} from './state.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function sourceReader(library,params,load){
  const {document:doc,page}=sourceSelection(library,params),data=await load(doc.textPath);
  const q=params.get('q')||'',unit=doc.format==='pdf'?'Page':'Section';
  const link=(n,query=q)=>sourceHref(library.id,{document:doc.id,page:n,q:query});
  let matches=[],error='';try{matches=findSourcePages(data.pages,q)}catch(e){error=e.message}
  const mark={id:`${library.id}-source-${doc.id}-${page}`,editionId:doc.sha256,title:`${library.name} · ${doc.title} · ${unit} ${page}`,href:link(page,''),district:library.id};
  const saved=read('bookmarks',[]).some(b=>bookmarkKey(b)===bookmarkKey(mark));
  const html=`<div class="breadcrumb"><a href="#/">Library</a><span>/</span><span>${escape(library.name)}</span></div>
    <div class="eyebrow">District source library</div><h1>${escape(library.name)}</h1>
    <p class="page-intro">Court publications, with searchable text and the original source alongside.</p>
    <div class="notice">Source document view. Extracted text has not received rule-by-rule editorial review. Combined rulebooks may also contain criminal rules and other materials. Use the original document for formatting, tables, and cross-references.</div>
    <div class="source-controls"><label for="source-document">Stored document</label><select id="source-document">${library.documents.map(d=>`<option value="${d.id}" ${d.id===doc.id?'selected':''}>${escape(d.title)}${d.role==='upcoming-edition'?' — upcoming edition':''}</option>`).join('')}</select></div>
    ${doc.role==='upcoming-edition'?'<div class="notice"><strong>Upcoming edition.</strong> This document is not the default edition. Consult the court’s effective-date order before using it.</div>':''}
    <div class="reader-tools"><button id="source-bookmark" aria-pressed="${saved}">${saved?'✓ Bookmarked':'♧ Bookmark page'}</button>${doc.pdfPath?`<a href="./${escape(doc.pdfPath)}#page=${page}" target="_blank" rel="noopener">Open stored PDF ↗</a>`:''}<a href="${escape(doc.sourceUrl)}" target="_blank" rel="noopener">Official ${doc.format==='pdf'?'PDF':'web edition'} ↗</a><a href="#/settings">Download for offline reading</a></div>
    <details class="sources-detail"><summary>Source details & coverage</summary><div><p>Retrieved ${escape(doc.retrievedAt.slice(0,10))} · ${doc.pageCount} ${unit.toLowerCase()}s. Currency review is not recorded.</p>${library.notes.map(n=>`<p>${escape(n)}</p>`).join('')}<p><a href="${escape(library.discoveryUrl)}" target="_blank" rel="noopener">Court rules and amendments page ↗</a></p><p>Source SHA-256: <code>${escape(doc.sha256)}</code></p></div></details>
    <form id="source-search" class="source-search" role="search"><label for="source-query">Search this document</label><div class="reader-tools"><input id="source-query" value="${escape(q)}" placeholder="Phrase, AND, OR, NOT…"><button class="primary-button">Search document</button></div></form>
    ${q?`<section aria-label="Source search results"><p role="status">${error?escape(error):`${matches.length} matching ${unit.toLowerCase()}${matches.length===1?'':'s'}`}</p><div class="source-matches">${matches.map(m=>`<a class="source-result" href="${escape(link(m.number))}"><strong>${unit} ${m.number}</strong><p>${escape(m.snippet)}</p></a>`).join('')}</div></section>`:''}
    <nav class="source-pagination" aria-label="Source pages">${page>1?`<a href="${escape(link(page-1))}">← Previous</a>`:'<span></span>'}<form id="source-page-form"><label for="source-page">${unit}</label> <input id="source-page" type="number" min="1" max="${doc.pageCount}" value="${page}" required> <span>of ${doc.pageCount}</span> <button>Go</button></form>${page<doc.pageCount?`<a href="${escape(link(page+1))}">Next →</a>`:'<span></span>'}</nav>
    <article aria-label="Source ${unit.toLowerCase()} ${page}" class="source-page"><h2>${unit} ${page}</h2>${data.pages[page-1].text.trim()?`<div class="source-text">${escape(data.pages[page-1].text)}</div>`:'<p>No extractable text on this page. Open the stored PDF to read it.</p>'}</article>`;
  return {html,bind:()=>{
    document.getElementById('source-document').onchange=e=>{location.hash=sourceHref(library.id,{document:e.target.value})};
    document.getElementById('source-page-form').onsubmit=e=>{e.preventDefault();location.hash=link(Number(document.getElementById('source-page').value))};
    document.getElementById('source-search').onsubmit=e=>{e.preventDefault();location.hash=link(page,document.getElementById('source-query').value.trim())};
    document.getElementById('source-bookmark').onclick=e=>{const values=read('bookmarks',[]),exists=values.some(b=>bookmarkKey(b)===bookmarkKey(mark));const next=values.filter(b=>bookmarkKey(b)!==bookmarkKey(mark));if(!exists)next.push(mark);if(!write('bookmarks',next)){e.target.textContent='Storage unavailable';return}e.target.textContent=exists?'♧ Bookmark page':'✓ Bookmarked';e.target.setAttribute('aria-pressed',String(!exists))};
  }};
}

export async function sourceSearch(library,q,load){
  const groups=[];
  for(const doc of library.documents.filter(d=>d.role!=='upcoming-edition')){
    try{const data=await load(doc.textPath),hits=findSourcePages(data.pages,q);groups.push(`<h3>${escape(doc.title)}</h3><p>${hits.length} matching ${doc.format==='pdf'?'pages':'sections'}</p>${hits.slice(0,30).map(h=>`<a class="source-result" href="${escape(sourceHref(library.id,{document:doc.id,page:h.number,q}))}"><strong>${doc.format==='pdf'?'Page':'Section'} ${h.number}</strong><p>${escape(h.snippet)}</p></a>`).join('')}${hits.length>30?`<p><a href="${escape(sourceHref(library.id,{document:doc.id,q}))}">See all ${hits.length} matches in this document ↗</a></p>`:''}`)}catch(e){groups.push(`<p class="notice">${escape(doc.title)}: ${escape(e.message)}</p>`)}
  }
  return `<h2>${escape(library.name)} source documents</h2><p>Matches in extracted page text, including other materials in combined rulebooks. Upcoming editions are excluded. Rule-level citations and field filters are not available for source documents.</p>${groups.join('')}`;
}
