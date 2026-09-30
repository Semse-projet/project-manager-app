import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { EvidenceGatewayService } from "../dist/modules/evidence-gateway/evidence-gateway.service.js";

// C10 / C67 — the evidence gateway must enforce tenant + organization +
// resource scope using the canonical evidence policy (ADR-028). Previously
// reads filtered only by the URL projectId and upload trusted the body's
// projectId, so any holder of evidence:read/write could read or pollute
// another tenant's/org's project evidence (which gates payment readiness).

const CLIENT_ORG = "org_client";
const PRO_ORG = "org_pro";

function build() {
  const calls: string[] = [];
  const repository = {
    // Only project "proj_1" of "tenant_1" exists.
    async getProjectOwnership(projectId: string, tenantId: string) {
      calls.push(`ownership:${projectId}:${tenantId}`);
      return projectId === "proj_1" && tenantId === "tenant_1"
        ? { clientOrgId: CLIENT_ORG, assignedProOrgId: PRO_ORG }
        : null;
    },
    async milestoneBelongsToProject(milestoneId: string, projectId: string, tenantId: string) {
      calls.push(`milestone:${milestoneId}:${projectId}:${tenantId}`);
      return milestoneId === "ms_1" && projectId === "proj_1" && tenantId === "tenant_1";
    },
    async getProjectEvidenceByStatus(projectId: string, status: string, tenantId: string) {
      calls.push(`list:${projectId}:${status}:${tenantId}`);
      return [{ id: "ev_1", bucketKey: "secret-key" }];
    },
    async getMilestoneEvidenceValidationStatus(_p: string, _m: string, tenantId: string) {
      calls.push(`status:${tenantId}`);
      return { total: 1, passed: 1, failed: 0, pending: 0, manualReview: 0, avgScore: 1, isComplete: true, isReady: true };
    },
    async createEvidence() { calls.push("create"); return { id: "ev_new" }; },
    async logValidationEvent() {},
  };
  const service = new EvidenceGatewayService(repository as never, {} as never, {} as never);
  return { service, calls };
}

const actor = (over: Record<string, unknown> = {}) =>
  ({ tenantId: "tenant_1", orgId: PRO_ORG, userId: "u1", roles: ["PRO"], ...over }) as never;

test("read: owning client/pro org and OPS_ADMIN are allowed", async () => {
  const { service } = build();
  for (const a of [actor({ orgId: CLIENT_ORG }), actor({ orgId: PRO_ORG }), actor({ orgId: "org_ops", roles: ["OPS_ADMIN"] })]) {
    const items = await service.getPassedEvidence(a, "proj_1");
    assert.equal(items.length, 1);
  }
});

test("read: other org in the SAME tenant is forbidden and no evidence is queried", async () => {
  const { service, calls } = build();
  await assert.rejects(service.getPassedEvidence(actor({ orgId: "org_other" }), "proj_1"), ForbiddenException);
  assert.ok(!calls.some((c) => c.startsWith("list:")));
});

test("read: project of another tenant is reported as not found (no existence oracle)", async () => {
  const { service, calls } = build();
  await assert.rejects(service.getFailedEvidence(actor({ tenantId: "tenant_2" }), "proj_1"), NotFoundException);
  await assert.rejects(service.getPendingEvidence(actor({ tenantId: "tenant_2" }), "proj_1"), NotFoundException);
  assert.ok(!calls.some((c) => c.startsWith("list:")));
});

test("read: tenant is passed into every evidence query (defense in depth)", async () => {
  const { service, calls } = build();
  await service.getPassedEvidence(actor(), "proj_1");
  await service.getMilestoneValidationStatus(actor(), "proj_1", "ms_1");
  assert.ok(calls.includes("list:proj_1:passed:tenant_1"));
  assert.ok(calls.includes("status:tenant_1"));
});

test("milestone status: milestone from another project is not found", async () => {
  const { service } = build();
  await assert.rejects(service.getMilestoneValidationStatus(actor(), "proj_1", "ms_other"), NotFoundException);
});

test("assertProjectAccess rejects an empty projectId", async () => {
  const { service } = build();
  await assert.rejects(service.assertProjectAccess(actor(), "", "read"), NotFoundException);
});

test("upload: foreign-tenant project, foreign org and foreign milestone are all rejected before any write", async () => {
  const base = { uploadedById: "u1", kind: "PHOTO" as const, bucketKey: "k" };
  const cases: Array<[Record<string, unknown>, unknown]> = [
    [{ tenantId: "tenant_2", orgId: PRO_ORG, roles: ["PRO"], projectId: "proj_1" }, NotFoundException],
    [{ tenantId: "tenant_1", orgId: "org_other", roles: ["PRO"], projectId: "proj_1" }, ForbiddenException],
    [{ tenantId: "tenant_1", orgId: PRO_ORG, roles: ["PRO"], projectId: "proj_1", milestoneId: "ms_other" }, NotFoundException],
  ];
  for (const [req, err] of cases) {
    const { service, calls } = build();
    await assert.rejects(service.uploadEvidence({ ...base, ...req } as never), err as never);
    assert.ok(!calls.includes("create"), "must not create evidence");
  }
});

test("upload: owning org with a milestone of the same project succeeds", async () => {
  const { service, calls } = build();
  const res = await service.uploadEvidence({
    tenantId: "tenant_1", orgId: PRO_ORG, roles: ["PRO"], uploadedById: "u1",
    projectId: "proj_1", milestoneId: "ms_1", kind: "PHOTO", bucketKey: "k",
  });
  assert.equal(res.evidenceId, "ev_new");
  assert.ok(calls.includes("create"));
});
