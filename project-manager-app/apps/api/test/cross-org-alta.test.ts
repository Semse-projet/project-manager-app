import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { FieldOpsRepository } from "../dist/modules/field-ops/field-ops.repository.js";
import { FieldOpsService } from "../dist/modules/field-ops/field-ops.service.js";
import { UsersRepository } from "../dist/modules/users/users.repository.js";
import { UsersService } from "../dist/modules/users/users.service.js";
import { DigitalTwinService } from "../dist/modules/intelligence/digital-twin.service.js";
import { PaymentGovernanceDiagnosticsService } from "../dist/modules/payment-governance/diagnostics.service.js";

const userRow = (id: string) => ({
  id,
  email: `${id}@example.com`,
  phone: "555-0100",
  status: "active",
  verificationStatus: "verified",
  trustScore: 0.2,
  riskLevel: "high",
  flags: ["watch"],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

test("user directory is limited to the session organization and hides risk signals", async () => {
  const queries: unknown[] = [];
  const repository = new UsersRepository(
    {
      async user() { return null; },
      user: {
        async findMany(args: unknown) {
          queries.push(args);
          return [userRow("usr_same_org")];
        },
      },
    } as never,
    { async ensureActorContext() { return undefined; } } as never,
  );
  const service = new UsersService(
    repository as never,
    { async append() { return undefined; } } as never,
    {} as never,
    {} as never,
  );

  const listed = await service.listUsers({
    tenantId: "tenant_default",
    orgId: "org_client",
    userId: "usr_client",
    roles: ["CLIENT"],
  });
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.email, "usr_same_org@example.com");
  assert.equal("riskLevel" in listed[0]!, false);
  assert.equal("flags" in listed[0]!, false);
  assert.deepEqual(queries[0], {
    where: {
      memberships: {
        some: { orgId: "org_client", org: { tenantId: "tenant_default" } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  queries.length = 0;
  const ops = await service.listUsers({
    tenantId: "tenant_default",
    orgId: "org_ops",
    userId: "usr_ops",
    roles: ["OPS_ADMIN"],
  });
  assert.equal(ops[0]?.riskLevel, "high");
  assert.deepEqual(ops[0]?.flags, ["watch"]);
  assert.deepEqual((queries[0] as { where: unknown }).where, {
    memberships: { some: { org: { tenantId: "tenant_default" } } },
  });

  const emptyOrg = await repository.findUsersByTenant({
    tenantId: "tenant_default",
    orgId: "",
    userId: "usr_client",
    roles: ["CLIENT"],
  });
  assert.deepEqual(emptyOrg, []);
});

test("archived project snapshots stay inside the caller's organization", async () => {
  const queries: unknown[] = [];
  const row = {
    id: "arch_1",
    tenantId: "tenant_default",
    projectId: "project_client",
    jobId: null,
    archivedAt: new Date("2026-02-01T00:00:00.000Z"),
    archivedBy: "usr_1",
    status: "complete",
    snapshotJson: { name: "obra" },
    financialJson: { total: 1000 },
    milestonesJson: [],
    contractorId: null,
    contractorOrgId: "org_pro",
    clientOrgId: "org_client",
    totalValue: 1000,
    durationDays: 3,
    milestoneCount: 1,
    evidenceCount: 0,
    disputeCount: 0,
    pdfUrl: null,
  };
  const twin = new DigitalTwinService({
    projectArchive: {
      async findMany(args: unknown) {
        queries.push(args);
        return [row];
      },
    },
  } as never);

  const own = await twin.listArchives("tenant_default", 20, {
    orgId: "org_client",
    projectIds: ["project_live"],
  });
  assert.equal(own[0]?.projectId, "project_client");
  assert.deepEqual(queries[0], {
    where: {
      tenantId: "tenant_default",
      OR: [
        { clientOrgId: "org_client" },
        { contractorOrgId: "org_client" },
        { projectId: { in: ["project_live"] } },
      ],
    },
    orderBy: { archivedAt: "desc" },
    take: 20,
  });

  const none = await twin.listArchives("tenant_default", 20, { orgId: "", projectIds: [] });
  assert.deepEqual(none, []);
  assert.equal(queries.length, 1);
});

test("payment diagnostics count only the caller's projects", async () => {
  const queries: unknown[] = [];
  const diagnostics = new PaymentGovernanceDiagnosticsService({
    milestone: {
      async findMany(args: unknown) {
        queries.push(args);
        return [];
      },
    },
  } as never);

  const empty = await diagnostics.getDiagnostics("tenant_default", { kind: "projects", projectIds: [] });
  assert.equal(empty.totalMilestones, 0);
  assert.equal(queries.length, 0);

  await diagnostics.getDiagnostics("tenant_default", { kind: "projects", projectIds: ["project_a"] });
  assert.deepEqual((queries[0] as { where: unknown }).where, {
    projectId: { in: ["project_a"] },
    project: { tenantId: "tenant_default" },
  });
});

test("field-ops lists and writes stay on the caller's projects and org", async () => {
  const calls: Array<{ model: string; method: string; args: unknown }> = [];
  const record = (model: string, method: string, args: unknown, value: unknown) => {
    calls.push({ model, method, args });
    return value;
  };
  const prisma = {
    fieldUnit: {
      async findMany(args: unknown) { return record("fieldUnit", "findMany", args, []); },
      async findFirst(args: unknown) {
        return record("fieldUnit", "findFirst", args, { id: "unit_b", projectId: "project_b", tenantId: "tenant_default" });
      },
      async create(args: unknown) { return record("fieldUnit", "create", args, { id: "unit_new" }); },
      async updateMany() { throw new Error("update should not run"); },
    },
    worklogEntry: {
      async findMany(args: unknown) { return record("worklogEntry", "findMany", args, []); },
      async create(args: unknown) { return record("worklogEntry", "create", args, { id: "wl_new" }); },
    },
    vendor: {
      async findMany(args: unknown) { return record("vendor", "findMany", args, []); },
      async findFirst(args: unknown) {
        return record("vendor", "findFirst", args, { id: "vendor_b", orgId: "org_b" });
      },
      async create(args: unknown) { return record("vendor", "create", args, { id: "vendor_new" }); },
    },
    complianceDoc: {
      async findFirst() { throw new Error("compliance lookup should not run"); },
      async create() { throw new Error("compliance write should not run"); },
      async update() { throw new Error("compliance write should not run"); },
    },
  };
  const repository = new FieldOpsRepository(prisma as never);

  await repository.listUnits({ tenantId: "tenant_default", orgId: "org_a" });
  assert.deepEqual(calls.at(-1)?.args, {
    where: {
      tenantId: "tenant_default",
      project: {
        OR: [
          { assignedProOrgId: "org_a" },
          { job: { clientOrgId: "org_a" } },
        ],
      },
    },
    orderBy: { code: "asc" },
  });

  await repository.listWorklogs({ tenantId: "tenant_default", orgId: "org_a" });
  const worklogWhere = (calls.at(-1)?.args as { where: { fieldUnit: unknown } }).where;
  assert.deepEqual(worklogWhere.fieldUnit, {
    project: {
      OR: [
        { assignedProOrgId: "org_a" },
        { job: { clientOrgId: "org_a" } },
      ],
    },
  });

  await repository.listVendors({ tenantId: "tenant_default", orgId: "org_a" });
  assert.deepEqual((calls.at(-1)?.args as { where: unknown }).where, {
    tenantId: "tenant_default",
    orgId: "org_a",
  });
  assert.deepEqual(await repository.listUnits({ tenantId: "tenant_default", orgId: "" }), []);

  const created: string[] = [];
  const access = {
    async assertProjectAccess(actor: { orgId: string }, projectId: string) {
      if (actor.orgId === "org_a" && projectId === "project_a") return;
      throw new ForbiddenException("Actor cannot access this project");
    },
  };
  const service = new FieldOpsService(
    {
      async listUnits() { return [{ id: "unit_a" }]; },
      async findUnitById(input: { fieldUnitId: string }) {
        if (input.fieldUnitId === "unit_b") return { id: "unit_b", projectId: "project_b" };
        return { id: "unit_a", projectId: "project_a" };
      },
      async createUnit(input: { projectId: string }) {
        created.push(input.projectId);
        return { id: "unit_new", projectId: input.projectId };
      },
      async createWorklog() {
        created.push("worklog");
        return { id: "wl_new" };
      },
      async findVendorById(input: { vendorId: string }) {
        if (input.vendorId === "vendor_b") return { id: "vendor_b", orgId: "org_b" };
        return { id: "vendor_a", orgId: "org_a" };
      },
      async upsertComplianceDoc(input: { status: string }) {
        created.push(input.status);
        return { id: "doc_1", status: input.status };
      },
    } as never,
    { async append() { return undefined; } } as never,
    access as never,
  );

  const outsider = { tenantId: "tenant_default", orgId: "org_a", userId: "usr_a", roles: ["PRO"] };
  await assert.rejects(
    () => service.createUnit({ ...outsider, projectId: "project_b", code: "B-1" }),
    ForbiddenException,
  );
  await assert.rejects(
    () => service.updateUnitStatus({ ...outsider, fieldUnitId: "unit_b", status: "COMPLETE" }),
    ForbiddenException,
  );
  await assert.rejects(
    () => service.createWorklog({
      ...outsider,
      fieldUnitId: "unit_b",
      date: "2026-11-01",
      doneToday: "x",
      pendingNext: "y",
      createdBy: "usr_a",
    }),
    ForbiddenException,
  );
  assert.deepEqual(created, []);

  const same = await service.createUnit({ ...outsider, projectId: "project_a", code: "A-1" });
  assert.equal(same.projectId, "project_a");

  await assert.rejects(
    () => service.upsertComplianceDoc({
      ...outsider,
      vendorId: "vendor_b",
      type: "INSURANCE",
      status: "PENDING",
    }),
    ForbiddenException,
  );
  await assert.rejects(
    () => service.upsertComplianceDoc({
      ...outsider,
      vendorId: "vendor_a",
      type: "INSURANCE",
      status: "APPROVED",
    }),
    ForbiddenException,
  );
  assert.deepEqual(created, ["project_a"]);

  const approved = await service.upsertComplianceDoc({
    tenantId: "tenant_default",
    orgId: "org_a",
    userId: "usr_client",
    roles: ["CLIENT"],
    vendorId: "vendor_a",
    type: "INSURANCE",
    status: "APPROVED",
  });
  assert.equal(approved.status, "APPROVED");
  assert.deepEqual(created, ["project_a", "APPROVED"]);
});
