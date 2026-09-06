import {searchDocuments} from './search.js';
let documents=[];
self.onmessage=({data})=>{
  if(data.type==='init'){documents=data.documents;return}
  try {self.postMessage({id:data.id,results:searchDocuments(documents,data.query,data.options)})}
  catch(error){self.postMessage({id:data.id,error:error.message})}
};
