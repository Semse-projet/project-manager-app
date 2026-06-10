import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { JobsController } from "../dist/modules/jobs/jobs.controller.js";

function createController() {
  const calls = {
    list: [] as Array<Record<string, unknown>>,
    detail: [] as Array<Record<string, unknown>>,
    create: [] as Array<Record<string, unknown>>,
    update: [] as Array<Record<string, unknown>>,
    archive: [] as Array<Record<string, unknown>>,
    restore: [] as Array<Record<string, unknown>>,
    transition: [] as Array<Record<string, unknown>>,
  };

  const service = {
    async list(input: Record<string, unknown>) {
      calls.list.push(input);
      return [{
        id: "job_1",
        tenantId: String(input.tenantId ?? "tenant_1"),
        title: "Instalacion split",
        scope: "Instalacion completa con evidencia",
        status: "posted",
      }];
    },
    async detail(input: Record<string, unknown>) {
      calls.detail.push(input);
      return {
        id: String(input.jobId ?? "job_1"),
        tenantId: String(input.tenantId ?? "tenant_1"),
        title: "Instalacion split",
        scope: "Instalacion completa con evidencia",
        status: "posted",
      };
    },
    async agentSignals(input: Record<string, unknown>) {
      return { jobId: input.jobId, signals: [] };
    },
    async create(input: Record<string, unknown>) {
      calls.create.push(input);
      return {
        id: "job_created",
        tenantId: String(input.tenantId ?? "tenant_1"),
        title: String(input.title ?? "Nuevo trabajo"),
        scope: String(input.scope ?? "scope"),
        status: "draft",
      };
    },
    async update(input: Record<string, unknown>) {
      calls.update.push(input);
      return {
        id: String(input.jobId ?? "job_1"),
        tenantId: String(input.tenantId ?? "tenant_1"),
        title: "Instalacion split",
        scope: "Instalacion completa con evidencia",
        status: "reserved",
      };
    },
    async archive(input: Record<string, unknown>) {
      calls.archive.push(input);
      return { id: String(input.jobId ?? "job_1"), archived: true };
    },
    async restore(input: Record<string, unknown>) {
      calls.restore.push(input);
      return { id: String(input.jobId ?? "job_1"), restored: true };
    },
    async transitionJob(input: Record<string, unknown>) {
      calls.transition.push(input);
      return {
        id: String(input.jobId ?? "job_1"),
        tenantId: String(input.tenantId ?? "tenant_1"),
        title: "Instalacion split",
        scope: "Instalacion completa con evidencia",
        status: String(input.targetStatus ?? "reserved"),
      };
    },
  };

  return { controller: new JobsController(service as never), calls };
}

test("jobs controller declares expected permissions", () => {
  const expectations: Array<[string, string]> = [
    ["list", "jobs:read"],
    ["detail", "jobs:read"],
    ["agentSignals", "jobs:read"],
    ["create", "jobs:create"],
    ["update", "jobs:update"],
    ["archive", "jobs:archive"],
    ["transition", "jobs:update"],
    ["restore", "jobs:restore"],
  ];

  for (const [methodName, permission] of expectations) {
    const metadata = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, JobsController.prototype[methodName]);
    assert.deepEqual(metadata, [permission]);
  }
});

test("jobs controller wraps service responses and passes actor context", async () => {
  const { controller, calls } = createController();

  const actor = {
    headers: {
      "x-request-id": "req_jobs_1",
      "x-tenant-id": "tenant_1",
      "x-org-id": "org_client_1",
      "x-user-id": "usr_client_1",
      "x-roles": "CLIENT",
    },
    authContext: {
      tenantId: "tenant_1",
      orgId: "org_client_1",
      userId: "usr_client_1",
      roles: ["CLIENT"],
    },
  };

  const created = await controller.create(actor as never, {
    title: "Trabajo nuevo",
    scope: "Instalacion completa con evidencia",
    budgetType: "range",
    budgetMin: 1000,
    budgetMax: 1500,
    locationType: "on_site",
    city: "Monterrey",
    urgency: "high",
  });

  const transitioned = await controller.transition(actor as never, "job_1", { targetStatus: "reserved" });

  assert.equal(created.requestId, "req_jobs_1");
  assert.equal(created.data.status, "DRAFT");
  assert.equal(transitioned.data.status, "RESERVED");
  assert.equal(calls.create[0]?.tenantId, "tenant_1");
  assert.equal(calls.transition[0]?.targetStatus, "reserved");
});
