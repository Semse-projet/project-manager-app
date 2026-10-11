import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf8");

test("Evidence v1 schema allows client annotations without creating a second owner", () => {
  const schema = read("packages/schemas/src/evidence.schema.ts");
  assert.match(schema, /export const registerEvidenceSchema[\s\S]*?metadata: z\.record\(z\.unknown\(\)\)\.optional\(\)/);
  assert.match(schema, /export const evidenceRecordSchema[\s\S]*?metadata: z\.record\(z\.unknown\(\)\)\.optional\(\)/);
  assert.match(schema, /projectId: z\.string\(\)\.min\(1\)\.optional\(\)/);
  assert.match(schema, /jobId: z\.string\(\)\.min\(1\)\.optional\(\)/);
});

test("BFF keeps the actor-controlled jobId and forwards only parsed payload", () => {
  const route = read("apps/web/app/api/semse/jobs/[jobId]/evidence/route.ts");
  assert.match(route, /registerEvidenceSchema\.safeParse\(\{ \.\.\.body, jobId \}\)/);
  assert.match(route, /body: JSON\.stringify\(parsed\.data\)/);
});

test("HTTP registration passes untrusted metadata to the canonical Evidence service", () => {
  const controller = read("apps/api/src/modules/evidence/evidence.controller.ts");
  assert.match(controller, /metadata: parsed\.data\.metadata/);
  const service = read("apps/api/src/modules/evidence/evidence.service.ts");
  assert.match(service, /this\.evidenceRepository\.create\(input\)/);
  const repository = read("apps/api/src/modules/evidence/evidence.repository.ts");
  assert.match(repository, /parseEvidenceMetadata\(input\.metadata\)/);
  const restrictions = read("apps/api/src/modules/evidence/evidence-metadata.ts");
  assert.match(restrictions, /MAX_EVIDENCE_METADATA_BYTES = 64 \* 1024/);
  assert.match(restrictions, /RESERVED_EVIDENCE_METADATA_KEYS/);
  assert.match(restrictions, /"jobId"/);
  assert.match(restrictions, /"__proto__"/);
});

test("web upload helper supports optional metadata; no fake upload endpoint is added", () => {
  const web = read("apps/web/app/semse-api.ts");
  assert.match(web, /input: \{ key: string; kind: "PHOTO" \| "VIDEO" \| "DOCUMENT"; milestoneId\?: string; filename\?: string; metadata\?: Record<string, unknown> \}/);
});
