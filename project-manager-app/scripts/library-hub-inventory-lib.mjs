import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const GROUPS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
const ALLOWED = new Set(["apps/*", "packages/*"]);
const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const hash = data => createHash("sha256").update(data).digest("hex");
const fail = m => { throw Error("SEMSE Library Hub inventory: " + m); };
function nodeAt(root, relative, kind, required=false) {
  const p=path.resolve(root,relative);
  if(p!==root && !p.startsWith(root+path.sep)) fail("Path leaves authorized root");
  if(!existsSync(p)) {
    try { if(lstatSync(p).isSymbolicLink()) fail("Refusing symbolic link: "+relative); } catch(e) { if(e?.code!=="ENOENT") throw e; }
    if(required) fail("Missing: "+relative);
    return null;
  }
  const st=lstatSync(p);
  if(st.isSymbolicLink()) fail("Refusing symbolic link: "+relative);
  if(kind==="file"&&!st.isFile()) fail("Not regular file: "+relative);
  if(kind==="dir"&&!st.isDirectory()) fail("Not directory: "+relative);
  return p;
}
function readManifest(root,rel) {
  const buffer=readFileSync(nodeAt(root,rel,"file",true));
  let json;
  try { json=JSON.parse(buffer.toString("utf8")); } catch { fail("Invalid JSON: "+rel); }
  if(!json||Array.isArray(json)||typeof json!=="object") fail("Invalid package manifest: "+rel);
  return {json,sha256:hash(buffer)};
}
function patternsFromWorkspace(root) {
  const lines=readFileSync(nodeAt(root,"pnpm-workspace.yaml","file",true),"utf8").split(/\r?\n/);
  let inside=false,seen=false; const found=new Set();
  for(const line of lines) {
    if(!line.trim()||/^\s*#/.test(line)) continue;
    if(/^packages:\s*$/.test(line)) { inside=true;seen=true;continue; }
    if(/^\S/.test(line)) { inside=false;continue; }
    if(!inside) continue;
    const match=line.match(/^\s+-\s+['"]?([^"'#]+?)['"]?\s*(?:#.*)?$/);
    if(!match) fail("Unsupported workspace packages syntax");
    const v=match[1].trim();
    if(!ALLOWED.has(v)) fail("Unsupported workspace pattern: "+v);
    found.add(v);
  }
  if(!seen||!found.size) fail("Missing supported workspace patterns");
  return [...found].sort(cmp);
}
function dirsFor(root,base) {
  const p=nodeAt(root,base,"dir",true);
  const dirs=[];
  for(const name of readdirSync(p).sort(cmp)) {
    const rel=base+"/"+name;
    const entry=path.join(p,name);
    const st=lstatSync(entry);
    if(st.isSymbolicLink()) fail("Refusing symbolic link directory: "+rel);
    if(st.isDirectory()) dirs.push(rel);
  }
  return dirs;
}
function unquote(v) {
  v=v.trim();
  if(v.startsWith("'")&&v.endsWith("'")) return v.slice(1,-1).replace(/''/g,"'");
  if(v.startsWith('"')&&v.endsWith('"')) {
    try{return JSON.parse(v)}catch{fail("Unsupported YAML scalar")}
  }
  return v;
}
function readLock(root,diagnostics) {
  const p=nodeAt(root,"pnpm-lock.yaml","file");
  if(!p) { diagnostics.push({code:"LOCKFILE_MISSING"});return null; }
  const data=readFileSync(p,"utf8");
  if(!/^lockfileVersion:\s*['"]?9(?:\.0)?['"]?\s*$/m.test(data)) fail("Unsupported pnpm-lock.yaml version; requires v9");
  const output=new Map();
  let active=false, importer=null, group=null, dep=null;
  for(const line of data.split(/\r?\n/)) {
    if(!line.trim()||/^\s*#/.test(line))continue;
    if(/^importers:\s*$/.test(line)){active=true;continue;}
    if(!active)continue;
    if(/^\S/.test(line))break;
    let m=line.match(/^ {2}(\S.*):\s*$/);
    if(m){ importer=unquote(m[1]);group=null;dep=null;
      if(output.has(importer)) fail("Duplicate importer in lockfile");
      output.set(importer,new Map());continue;
    }
    m=line.match(/^ {4}([A-Za-z]+):\s*$/);
    if(m){group=GROUPS.includes(m[1])?m[1]:null;dep=null;continue;}
    m=line.match(/^ {6}(.+):\s*$/);
    if(m){dep=group?unquote(m[1]):null;
      if(dep&&output.has(importer)){
        const key=group+"\u0000"+dep;
        if(output.get(importer).has(key))fail("Duplicate lockfile dependency");
        output.get(importer).set(key,{});
      }
      continue;
    }
    m=line.match(/^ {8}(specifier|version):\s*(.*?)\s*$/);
    if(m&&group&&dep&&output.has(importer))output.get(importer).get(group+"\u0000"+dep)[m[1]]=unquote(m[2]);
  }
  if(!active)fail("Missing pnpm lockfile importers");
  return output;
}
function resolution(lock,importer,group,name,range) {
  const unknown={lockSpecifier:null,resolvedReference:null,resolvedVersion:null,resolutionStatus:"UNVERIFIED"};
  if(!lock)return unknown;
  const x=lock.get(importer)?.get(group+"\u0000"+name);
  if(!x?.specifier||!x?.version)return unknown;
  if(x.specifier!==range)return {...unknown,lockSpecifier:x.specifier,resolutionStatus:"STALE_LOCKFILE"};
  const ref=x.version;
  if(ref.startsWith("link:")||ref.startsWith("workspace:"))return {...unknown,lockSpecifier:x.specifier,resolvedReference:ref,resolutionStatus:"LOCAL_LINK"};
  if(!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?(?:\(.+\))?$/.test(ref))return {...unknown,lockSpecifier:x.specifier,resolvedReference:ref};
  return {lockSpecifier:x.specifier,resolvedReference:ref,resolvedVersion:ref.split("(")[0],resolutionStatus:"RESOLVED"};
}
function scanPython(root,patterns,diagnostics) {
  const pythonRequirements=[], sources=[];
  for(const pattern of patterns) {
    if(!pattern.startsWith("apps/"))continue;
    for(const relDir of dirsFor(root,pattern.split("/")[0])) {
      const dir=nodeAt(root,relDir,"dir");
      for(const name of readdirSync(dir).sort(cmp)) {
        const rel=relDir+"/"+name;
        if(["pyproject.toml","Pipfile","poetry.lock","uv.lock"].includes(name)) {
          nodeAt(root,rel,"file");diagnostics.push({code:"PYTHON_MANIFEST_UNSUPPORTED",manifest:rel});
        }
        if(!/^requirements(?:[-._][A-Za-z0-9._-]+)?\.txt$/.test(name))continue;
        const buf=readFileSync(nodeAt(root,rel,"file",true));
        sources.push({path:rel,sha256:hash(buf)});
        buf.toString("utf8").split(/\r?\n/).forEach((line,i)=>{
          let trimmed=line.trim();
          if(!trimmed||trimmed.startsWith("#"))return;
          if(trimmed.includes("://")){
            pythonRequirements.push({manifest:rel,line:i+1,raw:"[REDACTED]",name:null,declaredRange:null,resolvedVersion:null,resolutionStatus:"UNRESOLVED"});
            diagnostics.push({code:"PYTHON_REQUIREMENT_REDACTED",manifest:rel,line:i+1});return;
          }
          const m=trimmed.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[([A-Za-z0-9,._-]+)\])?\s*((?:(?:===|==|~=|>=|<=|!=|>|<)\s*[A-Za-z0-9.*+_-]+\s*,?\s*)+)?(?:;\s*(.+))?$/);
          pythonRequirements.push({manifest:rel,line:i+1,raw:trimmed,name:m?.[1]?.toLowerCase()??null,extras:m?.[2]??null,marker:m?.[4]??null,declaredRange:m?.[3]?.trim()||null,resolvedVersion:null,resolutionStatus:"UNRESOLVED"});
          if(!m)diagnostics.push({code:"PYTHON_REQUIREMENT_UNSUPPORTED",manifest:rel,line:i+1});
        });
      }
    }
  }
  return {pythonRequirements,sources};
}
export function inventoryRepository(rootPath) {
  const root=realpathSync(path.resolve(rootPath));
  if(!lstatSync(root).isDirectory())fail("Root must be directory");
  const diagnostics=[];
  const patterns=patternsFromWorkspace(root);
  const paths=["package.json"];
  for(const pattern of patterns){
    for(const dir of dirsFor(root,pattern.split("/")[0])){
      if(nodeAt(root,dir+"/package.json","file"))paths.push(dir+"/package.json");
    }
  }
  paths.sort(cmp);
  const lock=readLock(root,diagnostics);
  const dependencies=[],manifests=[];
  for(const rel of paths){
    const {json,sha256}=readManifest(root,rel);
    const importer=rel==="package.json"?".":rel.slice(0,-"/package.json".length);
    manifests.push({path:rel,sha256,packageName:typeof json.name==="string"?json.name:null});
    for(const type of GROUPS){
      const group=json[type];
      if(group===undefined)continue;
      if(!group||typeof group!=="object"||Array.isArray(group))fail("Invalid "+type+" in "+rel);
      for(const name of Object.keys(group).sort(cmp)){
        const declaredRange=group[name];
        if(typeof declaredRange!=="string")fail("Invalid dependency spec in "+rel);
        dependencies.push({ecosystem:"npm",name,manifest:rel,dependencyType:type,declaredRange:declaredRange.includes("://")?"[REDACTED]":declaredRange,...(declaredRange.includes("://")?{lockSpecifier:null,resolvedReference:null,resolvedVersion:null,resolutionStatus:"UNVERIFIED"}:resolution(lock,importer,type,name,declaredRange)),licenseStatus:"UNKNOWN",vulnerabilityStatus:"UNKNOWN",runtimeStatus:"UNVERIFIED"});
      }
    }
  }
  const py=scanPython(root,patterns,diagnostics);
  dependencies.sort((a,b)=>cmp(a.manifest,b.manifest)||cmp(a.dependencyType,b.dependencyType)||cmp(a.name,b.name));
  diagnostics.sort((a,b)=>cmp(a.code+"|"+(a.manifest||"")+"|"+(a.line||0),b.code+"|"+(b.manifest||"")+"|"+(b.line||0)));
  const names=new Map();
  for(const d of dependencies){if(!names.has(d.name))names.set(d.name,[]);names.get(d.name).push(d.declaredRange);}
  return {schemaVersion:"semse.library-hub.inventory.v1",sourceRef:"checkout",sources:[{path:"pnpm-workspace.yaml"},{path:"pnpm-lock.yaml",present:lock!==null},...py.sources],manifests,dependencies,pythonRequirements:py.pythonRequirements,diagnostics,summary:{jsManifests:manifests.length,pythonManifests:py.sources.length,declarations:dependencies.length,uniquePackageNames:names.size,repeatedNames:[...names.values()].filter(x=>x.length>1).length,versionConstraintDifferences:[...names.values()].filter(x=>new Set(x).size>1).length,verifiedResolvedReferences:dependencies.filter(x=>x.resolutionStatus==="RESOLVED").length,staleLockfileEntries:dependencies.filter(x=>x.resolutionStatus==="STALE_LOCKFILE").length,unresolvedDependencies:dependencies.filter(x=>x.resolutionStatus==="UNVERIFIED").length}};
}
