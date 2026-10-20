import test from 'node:test';import assert from 'node:assert/strict';
import {catalogs,validate,digest} from '../../scripts/i18n/validator.mjs';
const read=s=>catalogs('const T = '+s);
test('duplicate keys and flattened collisions fail before overwrite',()=>{
 for(const source of ['{es:{a:"x",a:"y"},en:{a:"z"}}','{es:{"a.b":"x",a:{b:"y"}},en:{a:"z"}}'])assert.throws(()=>read(source),/DUPLICATE/);
});
test('do not execute catalog code or accept spreads',()=>{assert.throws(()=>read('{es:{...external},en:{a:"x"}}'),/DYNAMIC/);});
test('missing keys, malformed ICU, variables and types fail',()=>{
 for(const pair of [{es:{a:'Hola'},en:{}},{es:{a:'Hola {name}'},en:{a:'Hi {user}'}},{es:{a:'{n, number}'},en:{a:'{n}'}},{es:{a:'{n, plural, one {uno}}'},en:{a:'one'}}])assert.equal(validate(pair).status,'FAIL');
});
test('nested plurals allow locale-specific branches with matching variable types',()=>assert.equal(validate({es:{a:'{n, plural, one {{name}} other {{name}}}'},en:{a:'{n, plural, =0 {None} one {{name}} other {{name}}}'}}).status,'PASS'));
test('critical approval binds both messages, source and glossary; evidence required',()=>{
 const data={es:{a:'Cancelar'},en:{a:'Cancel'}};
 const row={key:'a',risk:'destructive',surface:'fixture',description:'synthetic test',status:'approved',reviewer:'fixture reviewer',reviewEvidence:'fixture://review',reviewedAt:'2026-01-01',glossaryVersion:'1',sourceHash:digest('Cancelar'),translationSourceHash:digest('Cancelar'),targetHash:digest('Cancel')};
 const check=r=>validate(data,{glossaryVersion:'1',entries:[r]},true);
 assert.equal(check(row).status,'PASS');
 for(const patch of [{status:'inReview'},{reviewEvidence:''},{targetHash:'wrong'},{translationSourceHash:'wrong'},{glossaryVersion:'0'},{reviewedAt:'2999-01-01'}])assert.equal(check({...row,...patch}).status,'FAIL');
 assert.equal(validate(data,{entries:[]},true).status,'FAIL');
});
