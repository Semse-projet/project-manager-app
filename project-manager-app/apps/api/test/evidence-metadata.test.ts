import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import {
  MAX_EVIDENCE_METADATA_BYTES,
  parseEvidenceMetadata,
} from "../dist/modules/evidence/evidence-metadata.js";

// C67 — contrato validado de metadataJson del registro canonico de evidencia.

test("sin metadatos => undefined; objeto valido => copia JSON-segura", () => {
  assert.equal(parseEvidenceMetadata(undefined), undefined);
  assert.equal(parseEvidenceMetadata(null), undefined);
  const input = { source: "browser-agent", counts: { a: 1 }, tags: ["x", "y"] };
  const out = parseEvidenceMetadata(input);
  assert.deepEqual(out, input);
  assert.notEqual(out, input);
});

test("no objeto / array => 400", () => {
  for (const bad of ["x", 5, true, [1, 2]]) {
    assert.throws(() => parseEvidenceMetadata(bad), BadRequestException);
  }
});

test("claves reservadas (jobId, filename, category, description) => 400: el cliente no puede forjar el contexto", () => {
  for (const key of ["jobId", "filename", "category", "description"]) {
    assert.throws(() => parseEvidenceMetadata({ [key]: "x" }), (e: Error) => e instanceof BadRequestException && /reserved/.test(e.message));
  }
});

test("claves de prototipo prohibidas, tambien anidadas", () => {
  assert.throws(() => parseEvidenceMetadata(JSON.parse('{"a":{"__proto__":{"x":1}}}')), BadRequestException);
  assert.throws(() => parseEvidenceMetadata({ constructor: 1 }), BadRequestException);
});

test("profundidad maxima", () => {
  let deep: Record<string, unknown> = { v: 1 };
  for (let i = 0; i < 10; i++) deep = { n: deep };
  assert.throws(() => parseEvidenceMetadata(deep), BadRequestException);
});

test("tamano maximo: el base64 de una captura ya no cabe en metadataJson", () => {
  const big = { screenshotBase64: "A".repeat(MAX_EVIDENCE_METADATA_BYTES) };
  assert.throws(() => parseEvidenceMetadata(big), (e: Error) => /TOO_LARGE/.test(e.message));
  assert.ok(parseEvidenceMetadata({ s: "A".repeat(1000) }));
});

test("valores no serializables => 400", () => {
  assert.throws(() => parseEvidenceMetadata({ f: () => 1 }), BadRequestException);
  assert.throws(() => parseEvidenceMetadata({ n: 10n }), BadRequestException);
  const cyc: Record<string, unknown> = {}; cyc.self = cyc;
  assert.throws(() => parseEvidenceMetadata(cyc), BadRequestException);
});
