import ts from 'typescript';
import {parse} from '@formatjs/icu-messageformat-parser';
import {createHash} from 'node:crypto';
export const digest = text => createHash('sha256').update(text.replace(/\r\n/g,'\n'),'utf8').digest('hex');
// Parse literals without executing application code. Reject spreads/computed expressions.
export function catalogs(source, filename='catalog.tsx', variable='T') {
  const sf=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,filename.endsWith('.json')?ts.ScriptKind.JSON:ts.ScriptKind.TSX);
  if(sf.parseDiagnostics.length) throw Error('CATALOG_SYNTAX');
  let root;
  if(filename.endsWith('.json')) root=sf.statements[0]?.expression;
  else { const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(sf)===variable) root=n.initializer;ts.forEachChild(n,visit);};visit(sf); }
  if(!root) throw Error('CATALOG_NOT_FOUND');
  function unwrap(n){while(n&&(ts.isAsExpression(n)||ts.isSatisfiesExpression(n)||ts.isParenthesizedExpression(n)))n=n.expression;return n;}
  function value(n){
    n=unwrap(n);
    if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))return n.text;
    if(ts.isArrowFunction(n)&&n.parameters.every(p=>ts.isIdentifier(p.name))&&ts.isTemplateExpression(n.body)){
      const names=new Set(n.parameters.map(p=>p.name.text));let result=n.body.head.text;
      for(const span of n.body.templateSpans){if(!ts.isIdentifier(span.expression)||!names.has(span.expression.text))throw Error('CATALOG_DYNAMIC_TEMPLATE');result+='{'+span.expression.text+'}'+span.literal.text;}return result;
    }
    return object(n);
  }
  function object(n) {
    n=unwrap(n);
    if(!n||!ts.isObjectLiteralExpression(n)) throw Error('CATALOG_NOT_LITERAL');
    const out=Object.create(null);
    for(const p of n.properties) {
      if(!ts.isPropertyAssignment(p)||!(ts.isStringLiteral(p.name)||ts.isIdentifier(p.name))) throw Error('CATALOG_DYNAMIC_PROPERTY');
      const k=p.name.text;if(Object.hasOwn(out,k))throw Error('DUPLICATE_KEY:'+k);
      const v=p.initializer;
      out[k]=value(v);
    }return out;
  }
  const raw=object(root), result={};
  for(const locale of ['es','en']) {
    if(!raw[locale]||typeof raw[locale]!=='object')throw Error('LOCALE_MISSING:'+locale);
    const flat=Object.create(null);
    function walk(o,prefix=''){for(const [k,v]of Object.entries(o)){const key=prefix+k;if(typeof v==='string'){if(Object.hasOwn(flat,key))throw Error('DUPLICATE_PATH:'+key);flat[key]=v;}else walk(v,key+'.');}}
    walk(raw[locale]);result[locale]=flat;
  }return result;
}
export function signature(message) {
  const args=new Map();
  function walk(nodes){for(const n of nodes){
    if([1,2,3,4,5,6,8].includes(n.type)){
      const kind=({1:'string',2:'number',3:'date',4:'time',5:'select',6:'plural',8:'tag'})[n.type]+(n.type===6?':'+n.pluralType:'');
      if(args.has(n.value)&&args.get(n.value)!==kind)throw Error('VARIABLE_TYPE_CONFLICT');args.set(n.value,kind);
    }
    if(n.options)for(const o of Object.values(n.options))walk(o.value);
    if(n.children)walk(n.children);
  }}walk(parse(message,{ignoreTag:false,requiresOtherClause:true}));
  return JSON.stringify([...args].sort(([a],[b])=>a.localeCompare(b)));
}
export function validate(data, manifest, critical=false, allowEmpty=[]) {
  const errors=[];
  const keys=[...new Set([...Object.keys(data.es),...Object.keys(data.en)])].sort();
  for(const key of keys){
    if(!Object.hasOwn(data.es,key)||!Object.hasOwn(data.en,key)){errors.push({code:'MISSING_KEY',key});continue;}
    for(const locale of ['es','en'])if(!data[locale][key].trim()&&!allowEmpty.includes(locale+':'+key))errors.push({code:'EMPTY_MESSAGE',key,locale});
    try{if(signature(data.es[key])!==signature(data.en[key]))errors.push({code:'VARIABLE_MISMATCH',key});}
    catch{errors.push({code:'INVALID_MESSAGE',key});}
  }
  if(critical){
    if(!manifest||!Array.isArray(manifest.entries)||!manifest.entries.length||!manifest.glossaryVersion)errors.push({code:'CRITICAL_MANIFEST_REQUIRED'});
    else{
      const seen=new Set();
      for(const row of manifest.entries){const key=row.key;
        if(seen.has(key))errors.push({code:'DUPLICATE_CRITICAL_KEY',key});seen.add(key);
        if(!Object.hasOwn(data.es,key)||!Object.hasOwn(data.en,key)){errors.push({code:'CRITICAL_KEY_MISSING',key});continue;}
        if(!['legal','financial','security','permission','destructive'].includes(row.risk)||!row.surface||!row.description)errors.push({code:'CRITICAL_METADATA_MISSING',key});
        if(row.status!=='approved'||!row.reviewer?.trim()||!row.reviewEvidence?.trim()||!Number.isFinite(Date.parse(row.reviewedAt))||Date.parse(row.reviewedAt)>Date.now())errors.push({code:'CRITICAL_REVIEW_REQUIRED',key});
        if(row.sourceHash!==digest(data.es[key])||row.translationSourceHash!==digest(data.es[key])||row.targetHash!==digest(data.en[key])||row.glossaryVersion!==manifest.glossaryVersion)errors.push({code:'CRITICAL_STALE',key});
      }
    }
  }
  return {status:errors.length?'FAIL':'PASS',keys:keys.length,critical,errors};
}
