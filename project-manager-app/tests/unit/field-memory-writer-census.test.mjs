import test from "node:test";
import assert from "node:assert/strict";
import { auditWriterCensus } from "../../scripts/field-memory-writer-census.mjs";

test("T-008g: all known original and Evidence registration sinks remain inventoried",async()=>{
  const report=await auditWriterCensus();
  assert.ok(report.scannedSourceFiles>20);
  assert.deepEqual(report.violations,[],report.violations.join("\n"));
  assert.equal(report.passed,true);
  assert.equal(report.sinkLocations["storage.store callers"].length,3);
  assert.equal(report.sinkLocations["storage.delete callers"].length,1);
  assert.equal(report.sinkLocations["canonical evidence DB creation"].length,1);
  assert.ok(report.sinkLocations["multipart temp root ownership"].length>=1);
});

test("T-008g: direct filesystem mutation candidates remain visible and unapproved",async()=>{
  const report=await auditWriterCensus();
  assert.ok(report.directFilesystemCandidatePaths.includes("modules/evidence/evidence.controller.ts"));
  assert.ok(report.directFilesystemCandidatePaths.includes("infrastructure/storage/storage.service.ts"));
  assert.match(report.caveat,/Does not certify/);
  assert.match(report.sourceRoot,/apps\/api\/src/);
});
