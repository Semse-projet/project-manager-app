import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const src = readFileSync(path.join(root, "apps/web/app/(app)/worker/evidence/page.tsx"), "utf8");

test("field evidence form collects explicit unverified worksite context", () => {
  assert.match(src, /Contexto de la fotografía en obra/);
  assert.match(src, /BEFORE_CONCEALMENT/);
  assert.match(src, /DURING_INSTALL/);
  assert.match(src, /AFTER_CONCEALMENT/);
  assert.match(src, /maxLength=\{60\}/);
  assert.match(src, /maxLength=\{100\}/);
  assert.match(src, /trust: "CLAIMED_BY_WORKER"/);
  assert.match(src, /no verificada/);
});

test("field metadata only goes to real photo registration after file PUT success", () => {
  const failedUploadCheck = src.indexOf("if (!uploadRes.ok)");
  const registerCall = src.indexOf("await registerJobEvidence(selectedJobId");
  assert.ok(failedUploadCheck > 0 && registerCall > failedUploadCheck);
  assert.match(src, /fileKind === "PHOTO" && hasFieldCapture/);
  assert.match(src, /metadata: \{/);
  assert.match(src, /fieldCapture: \{/);
  assert.match(src, /if \(hasFieldCapture && \(!zoneLabel \|\| capturePhase === "UNSPECIFIED"\)\)/);
});

test("changing job clears old capture annotations and file selection", () => {
  assert.match(src, /setSelectedJobId\(e\.target\.value\); setSelectedMilestoneId\(""\); setFiles\(\[\]\); setCaptureZoneLabel\(""\); setCaptureFloorLabel\(""\); setCapturePhase\("UNSPECIFIED"\)/);
});
