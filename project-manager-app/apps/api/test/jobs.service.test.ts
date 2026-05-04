import test from "node:test";
import assert from "node:assert/strict";
import { JobsService } from "../dist/modules/jobs/jobs.service.js";

type StoredPreferredEntry = {
  workspaceId: string;
  body: string | null;
  kind: string;
  tags: string[];
};

function createService() {
  const memoryRows: StoredPreferredEntry[] = [];
  const calls = {
    audit: [] as Array<Record<string, unknown>>,
    emitted: [] as Array<Record<string, unknown>>,
    appended: [] as Array<Record<string, unknown>>,
    created: [] as Array<Record<string, unknown>>,
    updates: [] as Array<Record<string, unknown>>,
  };

  const baseJob = {
    id: "job_pref_1",
    tenantId: "tenant_default",
    title: "Trabajo preferente",
    category: "electricidad",
    scope: "Resolver una instalacion con profesional objetivo.",
    status: "posted",
    budgetType: "range",
    budgetMin: 1200,
    budgetMax: 1800,
    location: "On site · Monterrey",
    urgency: "high",
    deadline: "2026-05-20T00:00:00.000Z",
  };

  const repository = {
    async listByTenant() {
      return [{ ...baseJob }];
    },
    async findById(input: { jobId: string }) {
      return { ...baseJob, id: input.jobId };
    },
    async create(input: Record<string, unknown>) {
      calls.created.push(input);
      return {
        ...baseJob,
        id: "job_created_1",
        title: String(input.title ?? baseJob.title),
        category: typeof input.category === "string" ? input.category : baseJob.category,
        scope: String(input.scope ?? baseJob.scope),
        budgetType: typeof input.budgetType === "string" ? input.budgetType : baseJob.budgetType,
        budgetMin: typeof input.budgetMin === "number" ? input.budgetMin : baseJob.budgetMin,
        budgetMax: typeof input.budgetMax === "number" ? input.budgetMax : baseJob.budgetMax,
        location: typeof input.location === "string" ? input.location : baseJob.location,
        urgency: typeof input.urgency === "string" ? input.urgency : baseJob.urgency,
      };
    },
    async getTransitionAccess() {
      return {
        clientOrgId: "org_client_001",
        professionalOrgId: "org_worker_001",
      };
    },
    async updateStatus(input: { jobId: string; status: string }) {
      calls.updates.push(input);
      return {
        ...baseJob,
        id: input.jobId,
        status: input.status,
      };
    },
  };

  const auditService = {
    async append(input: Record<string, unknown>) {
      calls.audit.push(input);
    },
  };

  const domainEventBus = {
    async emit(event: Record<string, unknown>) {
      calls.emitted.push(event);
    },
  };

  const workspaceMemoryRepository = {
    async append(record: Record<string, unknown>) {
      calls.appended.push(record);
      memoryRows.push({
        workspaceId: String(record.workspaceId ?? ""),
        body: typeof record.body === "string" ? record.body : null,
        kind: String(record.kind ?? ""),
        tags: Array.isArray(record.tags) ? record.tags.map(String) : [],
      });
      return record;
    },
  };

  const prisma = {
    workspaceMemoryEntry: {
      async findMany(input: {
        where?: {
          tenantId?: string;
          workspaceId?: { in?: string[] };
          kind?: string;
          tags?: { has?: string };
        };
      }) {
        const workspaceIds = input.where?.workspaceId?.in ?? [];
        const requiredTag = input.where?.tags?.has;
        const requiredKind = input.where?.kind;

        return memoryRows
          .filter((entry) => workspaceIds.includes(entry.workspaceId))
          .filter((entry) => (requiredKind ? entry.kind === requiredKind : true))
          .filter((entry) => (requiredTag ? entry.tags.includes(requiredTag) : true))
          .map((entry) => ({
            workspaceId: entry.workspaceId,
            body: entry.body,
          }));
      },
    },
    agentRun: {
      async findMany() {
        return [];
      },
    },
  };

  return {
    service: new JobsService(
      repository as never,
      auditService as never,
      domainEventBus as never,
      workspaceMemoryRepository as never,
      prisma as never,
      undefined,
    ),
    calls,
    memoryRows,
  };
}

test("jobs service list/detail enriches preferred professional from workspace memory", async () => {
  const { service, memoryRows } = createService();

  memoryRows.push({
    workspaceId: "job:job_pref_1",
    kind: "decision",
    tags: ["jobs", "decision", "preferred-professional", "matching-target"],
    body: JSON.stringify({
      userId: "usr_worker_001",
      displayName: "Profesional Demo",
      publicSlug: "worker-demo",
    }),
  });

  const listed = await service.list({
    tenantId: "tenant_default",
    orgId: "org_client_001",
    userId: "usr_client_001",
  });
  const detail = await service.detail({
    tenantId: "tenant_default",
    orgId: "org_client_001",
    userId: "usr_client_001",
    jobId: "job_pref_1",
  });

  assert.equal(listed[0]?.preferredProfessional?.displayName, "Profesional Demo");
  assert.equal(detail.preferredProfessional?.publicSlug, "worker-demo");
});

test("jobs service create returns job enriched with preferred professional", async () => {
  const { service, calls } = createService();

  const created = await service.create({
    tenantId: "tenant_default",
    orgId: "org_client_001",
    userId: "usr_client_001",
    title: "Trabajo nuevo con objetivo",
    category: "electricidad",
    scope: "Necesito publicar un trabajo con objetivo persistente.",
    budgetType: "range",
    budgetMin: 1400,
    budgetMax: 2200,
    locationType: "on_site",
    city: "Monterrey",
    urgency: "high",
    preferredProfessional: {
      userId: "usr_worker_001",
      displayName: "Profesional Demo",
      publicSlug: "worker-demo",
    },
    requestId: "req_jobs_create",
  });

  assert.equal(created.preferredProfessional?.userId, "usr_worker_001");
  assert.equal(created.preferredProfessional?.displayName, "Profesional Demo");
  assert.equal(calls.appended.length >= 2, true);
  assert.equal(calls.emitted.some((event) => event.type === "job.preferred_professional_selected"), true);
});

test("jobs service transition preserves preferred professional in returned job", async () => {
  const { service, memoryRows } = createService();

  memoryRows.push({
    workspaceId: "job:job_pref_1",
    kind: "decision",
    tags: ["jobs", "decision", "preferred-professional", "matching-target"],
    body: JSON.stringify({
      userId: "usr_worker_001",
      displayName: "Profesional Demo",
      publicSlug: "worker-demo",
    }),
  });

  const updated = await service.transitionJob({
    tenantId: "tenant_default",
    orgId: "org_client_001",
    userId: "usr_client_001",
    roles: ["CLIENT"],
    jobId: "job_pref_1",
    targetStatus: "reserved",
    requestId: "req_jobs_transition",
  });

  assert.equal(updated.status, "reserved");
  assert.equal(updated.preferredProfessional?.displayName, "Profesional Demo");
});
