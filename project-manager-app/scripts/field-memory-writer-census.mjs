/**
 * T-008g — static writer-census contract.
 *
 * This catches changes to known storage/Evidence write entrypoints and reports
 * candidate direct filesystem mutations for manual review. It is NOT proof
 * that the deployed process inventory is complete, nor a FROZEN attestation.
 *
 * Usage: node scripts/field-memory-writer-census.mjs --check
 *        node scripts/field-memory-writer-census.mjs --json
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../apps/api/src/", import.meta.url));
const repoRoot = path.resolve(root, "../../..");
const toPosix = value => value.replaceAll("\\", "/");

const knownSinks = [
  {
    id: "storage.store callers",
    pattern: /\bstorageService\.store\s*\(/g,
    allowed: [
      "infrastructure/storage/uploads.controller.ts",
      "modules/evidence/evidence.controller.ts",
      "modules/browser-agent/browser-agent.service.ts",
    ],
  },
  {
    id: "storage.delete callers",
    pattern: /\bstorageService\.delete\s*\(/g,
    allowed: ["modules/evidence/evidence.controller.ts"],
  },
  {
    id: "canonical evidence DB creation",
    pattern: /\bevidenceRepository\.create\s*\(/g,
    allowed: ["modules/evidence/evidence.service.ts"],
  },
  {
    id: "multipart temp root ownership",
    pattern: /\bSEMSE_MULTIPART_STORAGE_ROOT\b/g,
    allowed: ["modules/evidence/evidence.controller.ts"],
  },
];

const guardContracts = [
  ["infrastructure/storage/storage-write-gate-mode.ts", [
    /SEMSE_STORAGE_WRITE_GATE_MODE/,
    /SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE/,
    /mode === "off"/,
    /mode === "staging"/,
    /mode === "production"/,
    /level === "observe"/,
    /level === "provision"/,
    /Production storage write gate control is not armed/,
  ]],
  ["infrastructure/storage/storage.service.ts", [
    /storageWriteGateRuntimeEnabled/,
    /private configuredBoundary\(/,
    /withWriteGateMutation/,
    /async store\(/,
    /boundary\.beforePublish\(/,
    /async delete\(/,
  ]],
  ["modules/evidence/evidence.controller.ts", [
    /withWriteGateMutation\("MULTIPART_CREATE"/,
    /withWriteGateMutation\("MULTIPART_PART"/,
    /withWriteGateMutation\("MULTIPART_COMPLETE"/,
    /createWriteStream\(/,
    /saveMultipartManifest\(/,
  ]],
  ["modules/evidence/evidence.service.ts", [
    /withWriteGateMutation\("EVIDENCE_REGISTER"/,
    /this\.evidenceRepository\.create\(/,
  ]],
  ["modules/evidence-gateway/evidence-gateway.service.ts", [
    /withWriteGateMutation\("EVIDENCE_REGISTER"/,
    /this\.evidenceService\.register\(/,
  ]],
  ["modules/browser-agent/browser-agent.service.ts", [
    /withWriteGateMutation\("BROWSER_EVIDENCE"/,
    /this\.storageService\.store\(/,
    /this\.evidenceGateway\.uploadEvidence\(/,
  ]],
  ["modules/smart-intake/smart-intake.service.ts", [
    /this\.evidenceService\.register\(/,
  ]],
  ["infrastructure/storage/storage-write-gate-coordinator.ts", [
    /FOR UPDATE/,
    /StorageWriteOperation/,
  ]],
  ["infrastructure/storage/storage-write-gate-transition.service.ts", [
    /FOR UPDATE/,
    /StorageWriteGateAudit/,
  ]],
];

async function enumerate(directory) {
  const result = [];
  const entries = await readdir(directory, {withFileTypes:true});
  for(const entry of entries) {
    const p = path.join(directory,entry.name);
    if(entry.isDirectory()) result.push(...await enumerate(p));
    else if(entry.isFile() && /\.(ts|mjs)$/.test(entry.name))
      result.push({relative:toPosix(path.relative(root,p)),text:await readFile(p,"utf8")});
  }
  return result.sort((a,b)=>a.relative.localeCompare(b.relative));
}
function lineNumber(value,index) {
  return value.slice(0,index).split("\n").length;
}

export async function auditWriterCensus() {
  const files = await enumerate(root);
  const fileByName = new Map(files.map(x=>[x.relative,x.text]));
  const violations = [];
  const sinkLocations = {};
  for(const sink of knownSinks) {
    const locations = [];
    for(const file of files) {
      for(const match of file.text.matchAll(new RegExp(sink.pattern.source,"g"))) {
        locations.push({file:file.relative,line:lineNumber(file.text,match.index)});
        if(!sink.allowed.includes(file.relative))
          violations.push(`Unreviewed ${sink.id}: ${file.relative}:${lineNumber(file.text,match.index)}`);
      }
    }
    sinkLocations[sink.id] = locations;
    for(const expected of sink.allowed)
      if(!locations.some(x=>x.file===expected))
        violations.push(`Expected ${sink.id} not found in ${expected}`);
  }
  for(const [fileName,guards] of guardContracts) {
    const source=fileByName.get(fileName);
    if(!source){violations.push(`Missing guard owner: ${fileName}`);continue;}
    for(const guard of guards)
      if(!guard.test(source)) violations.push(`Missing T-008 guard ${String(guard)} in ${fileName}`);
  }
  // This is deliberately a candidate list, not automatically approved
  // writers: unrelated exports, temporary reports, cache, etc. may appear.
  // Each requires runtime-path/mount ownership analysis before FROZEN.
  const directFilesystemCandidatePaths=files.filter(({relative,text}) =>
    !relative.endsWith(".d.ts") &&
    /\b(?:writeFile|createWriteStream|rename|link|unlink|appendFile|copyFile|rm)\s*\(/.test(text)
  ).map(x=>x.relative);
  return {
    kind:"T008_STATIC_WRITER_CENSUS",
    scannedSourceFiles:files.length,
    sinkLocations,
    directFilesystemCandidatePaths,
    violations,
    passed:violations.length===0,
    caveat:"Static API source contract only. Does not certify process/mount/DB completeness, freeze or recovery.",
    sourceRoot:toPosix(path.relative(repoRoot,root)),
  };
}

const invoked = process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  const result=await auditWriterCensus();
  if(process.argv.includes("--json")) console.log(JSON.stringify(result,null,2));
  else {
    console.log(result.passed?"T008_STATIC_WRITER_CENSUS_PASS":"T008_STATIC_WRITER_CENSUS_FAIL");
    console.log(`Scanned ${result.scannedSourceFiles} API source files; ${result.directFilesystemCandidatePaths.length} direct filesystem mutation candidates require scope review.`);
    for(const violation of result.violations) console.error(violation);
    console.log(result.caveat);
  }
  if(!result.passed)process.exitCode=1;
}
