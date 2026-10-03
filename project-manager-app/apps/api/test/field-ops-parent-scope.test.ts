import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";

import { FieldOpsRepository } from "../dist/modules/field-ops/field-ops.repository.js";

type ParentKind = "project" | "fieldUnit" | "worklogEntry" | "vendor";

function createHarness(parentResults: Partial<Record<ParentKind, unknown>> = {}) {
  const calls: Array<{ model: string; method: string; args: unknown }> = [];

  function parentModel(model: ParentKind) {
    return {
      async findFirst(args: unknown) {
        calls.push({ model, method: "findFirst", args });
        return parentResults[model] ?? null;
      },
    };
  }

  const prisma = {
    project: parentModel("project"),
    fieldUnit: {
      ...parentModel("fieldUnit"),
      async create(args: unknown) {
        calls.push({ model: "fieldUnit", method: "create", args });
        return { id: "unit_1" };
      },
    },
    worklogEntry: {
      ...parentModel("worklogEntry"),
      async create(args: unknown) {
        calls.push({ model: "worklogEntry", method: "create", args });
        return { id: "worklog_1" };
      },
    },
    knowledgeFact: {
      async create(args: unknown) {
        calls.push({ model: "knowledgeFact", method: "create", args });
        return { id: "fact_1" };
      },
    },
    vendor: parentModel("vendor"),
    complianceDoc: {
      async findFirst(args: unknown) {
        calls.push({ model: "complianceDoc", method: "findFirst", args });
        return null;
      },
      async create(args: unknown) {
        calls.push({ model: "complianceDoc", method: "create", args });
        return { id: "doc_1" };
      },
      async update(args: unknown) {
        calls.push({ model: "complianceDoc", method: "update", args });
        return { id: "doc_1" };
      },
    },
  };

  return {
    calls,
    repository: new FieldOpsRepository(prisma as never),
  };
}

function findCall(
  calls: Array<{ model: string; method: string; args: unknown }>,
  model: string,
  method: string,
) {
  return calls.find((call) => call.model === model && call.method === method);
}

test("createUnit rejects a project outside the tenant before writing", async () => {
  const { repository, calls } = createHarness();

  await assert.rejects(
    repository.createUnit({
      tenantId: "tenant_a",
      projectId: "project_b",
      code: "UNIT-1",
    }),
    NotFoundException,
  );

  assert.deepEqual(findCall(calls, "project", "findFirst")?.args, {
    where: { id: "project_b", tenantId: "tenant_a" },
    select: { id: true },
  });
  assert.equal(findCall(calls, "fieldUnit", "create"), undefined);
});

test("createWorklog rejects a field unit outside the tenant before writing", async () => {
  const { repository, calls } = createHarness();

  await assert.rejects(
    repository.createWorklog({
      tenantId: "tenant_a",
      fieldUnitId: "unit_b",
      date: new Date("2026-07-25T00:00:00.000Z"),
      doneToday: "Done",
      pendingNext: "Next",
      createdBy: "user_a",
    }),
    NotFoundException,
  );

  assert.deepEqual(findCall(calls, "fieldUnit", "findFirst")?.args, {
    where: { id: "unit_b", tenantId: "tenant_a" },
    select: { id: true },
  });
  assert.equal(findCall(calls, "worklogEntry", "create"), undefined);
});

test("createFact rejects a linked worklog outside the tenant before writing", async () => {
  const { repository, calls } = createHarness();

  await assert.rejects(
    repository.createFact({
      tenantId: "tenant_a",
      subject: "unit",
      predicate: "has_status",
      object: "ready",
      worklogId: "worklog_b",
      createdBy: "user_a",
    }),
    NotFoundException,
  );

  assert.deepEqual(findCall(calls, "worklogEntry", "findFirst")?.args, {
    where: { id: "worklog_b", tenantId: "tenant_a" },
    select: { id: true },
  });
  assert.equal(findCall(calls, "knowledgeFact", "create"), undefined);
});

test("createFact without a worklog remains valid and performs no parent lookup", async () => {
  const { repository, calls } = createHarness();

  await repository.createFact({
    tenantId: "tenant_a",
    subject: "worker",
    predicate: "has_skill",
    object: "framing",
    createdBy: "user_a",
  });

  assert.equal(findCall(calls, "worklogEntry", "findFirst"), undefined);
  assert.ok(findCall(calls, "knowledgeFact", "create"));
});

test("upsertComplianceDoc rejects a vendor outside the tenant before lookup or write", async () => {
  const { repository, calls } = createHarness();

  await assert.rejects(
    repository.upsertComplianceDoc({
      tenantId: "tenant_a",
      vendorId: "vendor_b",
      type: "insurance",
      status: "APPROVED",
    }),
    NotFoundException,
  );

  assert.deepEqual(findCall(calls, "vendor", "findFirst")?.args, {
    where: { id: "vendor_b", tenantId: "tenant_a" },
    select: { id: true },
  });
  assert.equal(findCall(calls, "complianceDoc", "findFirst"), undefined);
  assert.equal(findCall(calls, "complianceDoc", "create"), undefined);
});
