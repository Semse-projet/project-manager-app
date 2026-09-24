import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSynthesisPrompt,
  parseSynthesisResponse
} from "../dist/modules/contributor-program/observation-synthesis.js";

// PR-12 (docs/specs/core/knowledge-contributor-observation-synthesis.spec.md):
// pure-logic tests — prompt shape, citation validation, and the
// never-fabricate guard — no DB, no network, no LLM mock needed.

const segments = [
  { id: "seg_a", startMs: 0, endMs: 2500, text: "Instalé el conduit EMT en la pared norte." },
  { id: "seg_b", startMs: 2500, endMs: 5000, text: "Verifiqué el nivel del piso antes de continuar." }
];

test("buildSynthesisPrompt assigns short aliases in order and maps them back to real segment ids", () => {
  const { userPrompt, aliasToSegmentId } = buildSynthesisPrompt(segments);
  assert.equal(aliasToSegmentId.get("s1"), "seg_a");
  assert.equal(aliasToSegmentId.get("s2"), "seg_b");
  assert.match(userPrompt, /\[s1\] 0\.0s-2\.5s: Instalé el conduit EMT en la pared norte\./);
  assert.match(userPrompt, /\[s2\] 2\.5s-5\.0s: Verifiqué el nivel del piso antes de continuar\./);
});

test("buildSynthesisPrompt's system prompt forbids inventing facts or citations", () => {
  const { systemPrompt } = buildSynthesisPrompt(segments);
  assert.match(systemPrompt, /no inventes un valor/i);
  assert.match(systemPrompt, /Nunca inventes un id/i);
});

test("parseSynthesisResponse accepts a well-formed observation with a valid citation", () => {
  const { aliasToSegmentId } = buildSynthesisPrompt(segments);
  const raw = JSON.stringify({
    observaciones: [
      { objective: "Instalar conduit", condition: null, decision: null, reason: null, method: null, action: "Cortó y dobló el conduit", result: "Listo", segmentIds: ["s1"] }
    ]
  });
  const result = parseSynthesisResponse(raw, aliasToSegmentId);
  assert.equal(result.length, 1);
  assert.equal(result[0].objective, "Instalar conduit");
  assert.equal(result[0].condition, null);
  assert.deepEqual(result[0].sourceSegmentIds, ["seg_a"]);
});

test("parseSynthesisResponse drops an observation whose only citation is hallucinated", () => {
  const { aliasToSegmentId } = buildSynthesisPrompt(segments);
  const raw = JSON.stringify({
    observaciones: [{ objective: "Observación inventada", segmentIds: ["s99"] }]
  });
  assert.deepEqual(parseSynthesisResponse(raw, aliasToSegmentId), []);
});

test("parseSynthesisResponse keeps only the valid aliases out of a mixed real/hallucinated citation list", () => {
  const { aliasToSegmentId } = buildSynthesisPrompt(segments);
  const raw = JSON.stringify({
    observaciones: [{ objective: "Parcialmente real", segmentIds: ["s1", "s99"] }]
  });
  const result = parseSynthesisResponse(raw, aliasToSegmentId);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].sourceSegmentIds, ["seg_a"]);
});

test("parseSynthesisResponse drops an observation with a valid citation but every field null (nothing actually said)", () => {
  const { aliasToSegmentId } = buildSynthesisPrompt(segments);
  const raw = JSON.stringify({
    observaciones: [{ objective: null, condition: null, decision: null, reason: null, method: null, action: null, result: null, segmentIds: ["s1"] }]
  });
  assert.deepEqual(parseSynthesisResponse(raw, aliasToSegmentId), []);
});

test("parseSynthesisResponse: an empty observaciones list (nothing salient in the transcript) is honest, not an error", () => {
  const { aliasToSegmentId } = buildSynthesisPrompt(segments);
  assert.deepEqual(parseSynthesisResponse(JSON.stringify({ observaciones: [] }), aliasToSegmentId), []);
});

test("parseSynthesisResponse tolerates malformed/non-JSON output by returning no observations", () => {
  const { aliasToSegmentId } = buildSynthesisPrompt(segments);
  assert.deepEqual(parseSynthesisResponse("not json at all", aliasToSegmentId), []);
});

test("parseSynthesisResponse strips a markdown code fence around the JSON", () => {
  const { aliasToSegmentId } = buildSynthesisPrompt(segments);
  const raw = "```json\n" + JSON.stringify({ observaciones: [{ objective: "x", segmentIds: ["s1"] }] }) + "\n```";
  const result = parseSynthesisResponse(raw, aliasToSegmentId);
  assert.equal(result.length, 1);
  assert.equal(result[0].objective, "x");
});

test("parseSynthesisResponse de-duplicates repeated citations of the same segment", () => {
  const { aliasToSegmentId } = buildSynthesisPrompt(segments);
  const raw = JSON.stringify({ observaciones: [{ objective: "x", segmentIds: ["s1", "s1"] }] });
  const result = parseSynthesisResponse(raw, aliasToSegmentId);
  assert.deepEqual(result[0].sourceSegmentIds, ["seg_a"]);
});
