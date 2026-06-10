import test from "node:test";
import assert from "node:assert/strict";

type EvidenceUploadInput = {
  fileName: string;
  gpsLat?: number;
  gpsLng?: number;
  timestampIso?: string;
};

function classifyEvidenceUpload(input: EvidenceUploadInput): { reviewRequired: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (typeof input.gpsLat !== "number" || typeof input.gpsLng !== "number") reasons.push("missing gps");
  if (typeof input.timestampIso !== "string" || Number.isNaN(Date.parse(input.timestampIso))) reasons.push("missing timestamp");
  return { reviewRequired: reasons.length > 0, reasons };
}

function buildExportBundle(input: { evidenceIds: string[]; logIds: string[]; changeOrderIds: string[] }) {
  return {
    evidence: [...input.evidenceIds],
    logs: [...input.logIds],
    changeOrders: [...input.changeOrderIds],
  };
}

function canProceedChangeOrder(input: { requiredSignaturePresent: boolean }): boolean {
  return input.requiredSignaturePresent;
}

test("M2.2 evidence upload with GPS and timestamp does not require review", () => {
  const result = classifyEvidenceUpload({ fileName: "photo.jpg", gpsLat: 19.4326, gpsLng: -99.1332, timestampIso: "2026-06-09T12:00:00.000Z" });
  assert.equal(result.reviewRequired, false);
  assert.equal(result.reasons.length, 0);
});

test("M2.2 evidence upload without required metadata triggers review", () => {
  const result = classifyEvidenceUpload({ fileName: "photo.jpg" });
  assert.equal(result.reviewRequired, true);
  assert.ok(result.reasons.includes("missing gps"));
  assert.ok(result.reasons.includes("missing timestamp"));
});

test("M2.2 export bundle includes evidence, logs and change orders", () => {
  const bundle = buildExportBundle({ evidenceIds: ["ev_1"], logIds: ["log_1"], changeOrderIds: ["co_1"] });
  assert.deepEqual(bundle, { evidence: ["ev_1"], logs: ["log_1"], changeOrders: ["co_1"] });
});

test("M2.2 change order cannot proceed when required signature is missing", () => {
  assert.equal(canProceedChangeOrder({ requiredSignaturePresent: true }), true);
  assert.equal(canProceedChangeOrder({ requiredSignaturePresent: false }), false);
});
