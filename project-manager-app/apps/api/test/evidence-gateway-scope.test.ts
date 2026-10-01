import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
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
    async logValidationEvent() {},
  };
  // C67: el gateway delega la escritura en EvidenceService.register (propietario canonico).
  const registered: Record<string, unknown>[] = [];
  const evidenceService = {
    async register(input: Record<string, unknown>) {
      calls.push("create");
      registered.push(input);
      return { id: "ev_new" };
    },
  };
  const service = new EvidenceGatewayService(repository as never, {} as never, {} as never, evidenceService as never);
  return { service, calls, registered };
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
  const base = { uploadedById: "u1", kind: "PHOTO" as const, bucketKey: "tenants/tenant_1/evidence/a.jpg" };
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
    projectId: "proj_1", milestoneId: "ms_1", kind: "PHOTO", bucketKey: "tenants/tenant_1/evidence/a.jpg",
  });
  assert.equal(res.evidenceId, "ev_new");
  assert.ok(calls.includes("create"));
});

test("upload (C67): bucketKey de otro tenant, sin prefijo de tenant o malformada => 400 y no se crea evidencia", async () => {
  const keys = [
    "tenants/tenant_2/evidence/a.jpg", // tenant ajeno
    "k", // sin prefijo
    "../../etc/passwd",
    "tenants/tenant_1/contract/a.pdf", // otro dominio
    "s3://bucket/ev.jpg",
  ];
  for (const bucketKey of keys) {
    const { service, calls } = build();
    await assert.rejects(
      service.uploadEvidence({
        tenantId: "tenant_1", orgId: PRO_ORG, roles: ["PRO"], uploadedById: "u1",
        projectId: "proj_1", kind: "PHOTO", bucketKey,
      } as never),
      BadRequestException,
      bucketKey,
    );
    assert.ok(!calls.includes("create"), `no debe crear con ${bucketKey}`);
  }
});

test("upload (C67): delega en EvidenceService.register con requestId, clave validada y metadata; no escribe por su cuenta", async () => {
  const { service, calls, registered } = build();
  const res = await service.uploadEvidence({
    tenantId: "tenant_1", orgId: PRO_ORG, roles: ["PRO"], uploadedById: "u1",
    projectId: "proj_1", milestoneId: "ms_1", kind: "PHOTO",
    bucketKey: "tenants/tenant_1/evidence/a.jpg", requestId: "req_9",
    metadataJson: { resolution: "1920x1080" },
  });
  assert.equal(res.evidenceId, "ev_new");
  assert.equal(res.status, "pending_validation");
  assert.equal(calls.filter((c) => c === "create").length, 1);
  assert.deepEqual(registered[0], {
    tenantId: "tenant_1", orgId: PRO_ORG, userId: "u1", roles: ["PRO"], requestId: "req_9",
    projectId: "proj_1", milestoneId: "ms_1", key: "tenants/tenant_1/evidence/a.jpg", kind: "PHOTO",
    metadata: { resolution: "1920x1080" },
  });
});

test("upload (C67): sin requestId se genera uno distinto por llamada (cada una es un registro nuevo)", async () => {
  const { service, registered } = build();
  const req = { tenantId: "tenant_1", orgId: PRO_ORG, roles: ["PRO"], uploadedById: "u1", projectId: "proj_1", kind: "PHOTO" as const, bucketKey: "tenants/tenant_1/evidence/a.jpg" };
  await service.uploadEvidence(req as never);
  await service.uploadEvidence(req as never);
  assert.notEqual(registered[0].requestId, registered[1].requestId);
  assert.match(String(registered[0].requestId), /^evidence-gateway-/);
});

test("upload (C67): una clave sintetica ya NO se acepta (el gateway no escribe claves que no apuntan a storage)", async () => {
  const { service, calls } = build();
  await assert.rejects(
    service.uploadEvidence({
      tenantId: "tenant_1", orgId: PRO_ORG, roles: ["PRO"], uploadedById: "u1",
      projectId: "proj_1", kind: "DOCUMENT" as const, bucketKey: "browser-agent/screenshot-1.png",
    } as never),
    BadRequestException,
  );
  assert.ok(!calls.includes("create"));
});
