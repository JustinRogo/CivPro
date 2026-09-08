import test from 'node:test';
import assert from 'node:assert/strict';
import {relatedRules} from '../src/related-rules.js';
const federal={id:'federal-frcp:3',collectionId:'federal-frcp',number:'3',editionId:'f1',districtId:'us',status:'active'};
const local={id:'ctd-civil:3',collectionId:'ctd-civil',number:'3',editionId:'c1',districtId:'ctd',status:'active'};
const catalog={provisions:[federal,local,{...local,id:'ctd-support:3',collectionId:'ctd-support'},{...local,id:'mad-civil:3',collectionId:'mad-civil',districtId:'mad'}]};
test('number matching stays within selected civil collection and FRCP',()=>{
  assert.deepEqual(relatedRules(federal,'ctd',catalog,{links:[]}),[{p:local,link:null}]);
  assert.deepEqual(relatedRules(federal,'none',catalog,{links:[]}),[]);
  assert.deepEqual(relatedRules({...federal,collectionId:'federal-social'},'ctd',catalog,{links:[]}),[]);
});
test('verified link is not duplicated by a number match and remains edition-bound',()=>{
  const link={from:local.id,to:federal.id,status:'verified',editions:['f1','c1']};
  assert.deepEqual(relatedRules(federal,'ctd',catalog,{links:[link]}),[{p:local,link}]);
  assert.deepEqual(relatedRules({...federal,editionId:'f0'},'ctd',catalog,{links:[link]}),[{p:local,link:null}]);
  assert.deepEqual(relatedRules(local,'ctd',catalog,{links:[link]}),[{p:federal,link}]);
});
