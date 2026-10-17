import test from "node:test";
import assert from "node:assert/strict";
import { EvidenceGatewayService } from "../dist/modules/evidence-gateway/evidence-gateway.service.js";

function build(input?: { blocked?: boolean }) {
  const gateKinds: string[] = [];
  let updates = 0;
  let validationLogs = 0;

  const repository = {
    async getEvidence() {
      return {
        id: "ev_validation_1",
        kind: "DOCUMENT",
        bucketKey: "tenants/tenant_1/evidence/doc.pdf",
        metadataJson: null,
        milestoneId: null,
        project: { id: "project_1", tenantId: "tenant_1" },
        milestone: null,
      };
    },
    async updateEvidenceValidation() {
      updates += 1;
      return { id: "ev_validation_1" };
    },
    async logValidationEvent() {
      validationLogs += 1;
    },
  };

  const visionService = {
    async runAnalysis() {
      return { qualityScore: 0.7 };
    },
    async getAnalysis() {
      return { duplicateRisk: 0 };
    },
    async matchReference() {
      return { similarityScore: 0.8 };
    },
  };

  const storageService = {
    async withWriteGateMutation<T>(kind: string, work: () => Promise<T>): Promise<T> {
      gateKinds.push(kind);
      if (input?.blocked) throw new Error("storage gate blocked");
      return work();
    },
    publicUrl() {
      return "https://example.invalid/evidence";
    },
  };

  const service = new EvidenceGatewayService(
    repository as never,
    visionService as never,
    storageService as never,
    {} as never,
  );

  return {
    service,
    gateKinds,
    get updates() { return updates; },
    get validationLogs() { return validationLogs; },
  };
}

test("validateEvidenceAsync persists validation inside EVIDENCE_VALIDATION gate", async () => {
  const fixture = build();

  await fixture.service.validateEvidenceAsync("ev_validation_1", "project_1");

  assert.deepEqual(fixture.gateKinds, ["EVIDENCE_VALIDATION"]);
  assert.equal(fixture.updates, 1);
  assert.equal(fixture.validationLogs, 1);
});

test("validateEvidenceAsync does not mutate Evidence when the write gate blocks", async () => {
  const fixture = build({ blocked: true });

  await assert.rejects(
    () => fixture.service.validateEvidenceAsync("ev_validation_1", "project_1"),
    /storage gate blocked/,
  );

  assert.deepEqual(fixture.gateKinds, ["EVIDENCE_VALIDATION"]);
  assert.equal(fixture.updates, 0);
  assert.equal(fixture.validationLogs, 0);
});
