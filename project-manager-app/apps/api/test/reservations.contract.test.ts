import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { ReservationsController } from "../dist/modules/reservations/reservations.controller.js";
import { ReservationsRepository } from "../dist/modules/reservations/reservations.repository.js";
import { ReservationsService } from "../dist/modules/reservations/reservations.service.js";

type JobRow = {
  id: string;
  tenantId: string;
  clientOrgId: string;
  status: string;
  deletedAt: Date | null;
};

type ReservationRow = {
  id: string;
  jobId: string;
  professionalOrgId: string | null;
  professionalId: string;
  status: string;
  reservedAt: Date;
  expiresAt: Date;
  releasedAt: Date | null;
  acceptedAt: Date | null;
  job: { id: string; tenantId: string; clientOrgId: string };
};

function visibleReservationFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "res_1",
    tenantId: "tenant_1",
    jobId: "job_1",
    professionalId: "usr_pro_1",
    professionalOrgId: "org_pro_1",
    status: "ACTIVE",
    reservedAt: "2026-06-09T10:00:00.000Z",
    expiresAt: "2026-06-09T10:30:00.000Z",
    releasedAt: null,
    acceptedAt: null,
    ...overrides,
  };
}

function createPrismaHarness() {
  const state = {
    jobs: new Map<string, JobRow>([
      ["job_1", { id: "job_1", tenantId: "tenant_1", clientOrgId: "org_client_1", status: "PUBLISHED", deletedAt: null }],
    ]),
    reservations: [] as ReservationRow[],
    projects: [] as Array<{ tenantId: string; jobId: string; assignedProOrgId: string; status: string }>,
    memberships: new Map<string, { orgId: string }>([
      ["usr_pro_1|org_pro_1", { orgId: "org_pro_1" }],
      ["usr_client_1|org_client_1", { orgId: "org_client_1" }],
      ["usr_ops_1|org_ops", { orgId: "org_ops" }],
    ]),
    roleCreated: false,
  };

  const prisma = {
    job: {
      async findFirst({ where }: { where: { id: string; tenantId?: string; deletedAt: null } }) {
        const job = state.jobs.get(where.id);
        if (!job || (where.tenantId && job.tenantId !== where.tenantId) || job.deletedAt !== null) return null;
        return { id: job.id, tenantId: job.tenantId, clientOrgId: job.clientOrgId, status: job.status };
      },
      async update({ where, data }: { where: { id: string }; data: { status: string } }) {
        const job = state.jobs.get(where.id);
        if (!job) throw new Error("job missing");
        job.status = data.status;
        return { id: job.id, status: job.status };
      },
    },
    jobReservation: {
      async findMany({ where }: { where: { jobId?: string; status?: string; expiresAt?: { lte: Date }; job?: { tenantId: string; deletedAt: null } } }) {
        return state.reservations.filter((row) =>
          (where.jobId ? row.jobId === where.jobId : true) &&
          (where.status ? row.status === where.status : true) &&
          (where.expiresAt?.lte ? row.expiresAt <= where.expiresAt.lte : true) &&
          (where.job ? row.job.tenantId === where.job.tenantId : true)
        );
      },
      async findFirst({ where }: { where: { jobId?: string; id?: string; status?: string; job?: { tenantId: string; deletedAt?: null } } }) {
        return state.reservations.find((row) =>
          (where.jobId ? row.jobId === where.jobId : true) &&
          (where.id ? row.id === where.id : true) &&
          (where.status ? row.status === where.status : true) &&
          (where.job ? row.job.tenantId === where.job.tenantId : true)
        ) ?? null;
      },
      async update({ where, data }: { where: { id: string }; data: Partial<ReservationRow> & { status: string } }) {
        const row = state.reservations.find((entry) => entry.id === where.id);
        if (!row) throw new Error("reservation missing");
        Object.assign(row, data);
        return row;
      },
      async create({ data }: { data: { jobId: string; professionalOrgId: string; professionalId: string; status: string; expiresAt: Date } }) {
        const job = state.jobs.get(data.jobId);
        if (!job) throw new Error("job missing");
        const row: ReservationRow = {
          id: `res_${state.reservations.length + 1}`,
          jobId: data.jobId,
          professionalOrgId: data.professionalOrgId,
          professionalId: data.professionalId,
          status: data.status,
          reservedAt: new Date("2026-06-09T10:00:00.000Z"),
          expiresAt: data.expiresAt,
          releasedAt: null,
          acceptedAt: null,
          job: { id: job.id, tenantId: job.tenantId, clientOrgId: job.clientOrgId },
        };
        state.reservations.push(row);
        return row;
      },
      async updateMany({ where, data }: { where: { id: { in: string[] } }; data: { status: string; releasedAt: Date } }) {
        let count = 0;
        for (const row of state.reservations) {
          if (where.id.in.includes(row.id)) {
            row.status = data.status;
            row.releasedAt = data.releasedAt;
            count++;
          }
        }
        return { count };
      },
      async count({ where }: { where: { jobId: string; status: string } }) {
        return state.reservations.filter((row) => row.jobId === where.jobId && row.status === where.status).length;
      },
    },
    project: {
      async findFirst({ where }: { where: { tenantId: string; jobId: string } }) {
        return state.projects.find((project) => project.tenantId === where.tenantId && project.jobId === where.jobId) ?? null;
      },
      async create({ data }: { data: { tenantId: string; jobId: string; assignedProOrgId: string; status: string } }) {
        state.projects.push(data);
        return data;
      },
    },
    membership: {
      async findFirst({ where }: { where: { userId: string; orgId?: string; roleId?: string; org?: { tenantId: string; type: string } } }) {
        const key = `${where.userId}|${where.orgId ?? where.org ? "?" : "?"}`;
        void key;
        if (where.userId === "usr_pro_1" && where.orgId === "org_pro_1") return { orgId: "org_pro_1" };
        if (where.userId === "usr_client_1" && where.orgId === "org_client_1") return { orgId: "org_client_1" };
        if (where.userId === "usr_ops_1" && where.orgId === "org_ops") return { orgId: "org_ops" };
        if (where.org && where.org.tenantId === "tenant_1") {
          if (where.userId === "usr_pro_1") return { orgId: "org_pro_1" };
          if (where.userId === "usr_client_1") return { orgId: "org_client_1" };
          if (where.userId === "usr_ops_1") return { orgId: "org_ops" };
        }
        return null;
      },
      async create({ data }: { data: { userId: string; orgId: string; roleId: string } }) {
        state.memberships.set(`${data.userId}|${data.orgId}`, { orgId: data.orgId });
        return { userId: data.userId };
      },
    },
    role: {
      async findUnique() {
        return { id: "role_pro" };
      },
      async create() {
        state.roleCreated = true;
        return { id: "role_pro" };
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(prisma),
  };

  const actorContextService = {
    async ensureActorContext() {
      return undefined;
    },
  };

  const auditEvents: unknown[] = [];
  const auditService = {
    async append(event: unknown) {
      auditEvents.push(event);
    },
  };

  return { prisma, actorContextService, auditService, state, auditEvents };
}

function createRepositoryHarness() {
  const harness = createPrismaHarness();
  const repository = new ReservationsRepository(harness.prisma as never, harness.actorContextService as never);
  const service = new ReservationsService(repository as never, harness.auditService as never);
  return { ...harness, repository, service };
}

test("reservations controller declares permissions and caps sweep maxItems", async () => {
  const controller = new ReservationsController({
    async list() {
      return [visibleReservationFixture()];
    },
    async create() {
      return visibleReservationFixture();
    },
    async accept() {
      return visibleReservationFixture({ status: "ACCEPTED", acceptedAt: "2026-06-09T10:10:00.000Z" });
    },
    async release() {
      return visibleReservationFixture({ status: "RELEASED", releasedAt: "2026-06-09T10:10:00.000Z" });
    },
    async expire() {
      return visibleReservationFixture({ status: "EXPIRED", releasedAt: "2026-06-09T10:10:00.000Z" });
    },
    async sweepExpired(input: { maxItems?: number }) {
      return { expiredCount: input.maxItems ?? 0, jobsReopened: 0 };
    },
  } as never);

  const expectations: Array<[string, string]> = [
    ["list", "reservations:read"],
    ["create", "reservations:create"],
    ["accept", "reservations:accept"],
    ["release", "reservations:release"],
    ["expire", "reservations:expire"],
    ["sweepExpired", "reservations:expire"],
  ];

  for (const [methodName, permission] of expectations) {
    const metadata = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, ReservationsController.prototype[methodName]);
    assert.deepEqual(metadata, [permission]);
  }

  const result = await controller.sweepExpired(
    {
      headers: {
        "x-request-id": "req_res_1",
        "x-tenant-id": "tenant_1",
        "x-org-id": "org_ops",
        "x-user-id": "usr_ops_1",
        "x-roles": "OPS_ADMIN"
      }
    } as never,
    { maxItems: 999 }
  );

  assert.equal(result.requestId, "req_res_1");
  assert.equal(result.data.expiredCount, 200);
});

test("reservations service rejects TTL outside the allowed range and uses the default", async () => {
  const { service, auditEvents } = createRepositoryHarness();

  await assert.rejects(
    () =>
      service.create({
        tenantId: "tenant_1",
        orgId: "org_pro_1",
        userId: "usr_pro_1",
        roles: ["PRO"],
        jobId: "job_1",
        expiresInMinutes: 0,
        requestId: "req_bad",
      }),
    BadRequestException
  );

  const created = await service.create({
    tenantId: "tenant_1",
    orgId: "org_pro_1",
    userId: "usr_pro_1",
    roles: ["PRO"],
    jobId: "job_1",
    requestId: "req_ok",
  });

  assert.equal(created.status, "active");
  assert.equal(created.professionalOrgId, "org_pro_1");
  assert.equal(auditEvents.length, 1);
});

test("reservations service audits expired reservation sweep", async () => {
  const { service, state, auditEvents } = createRepositoryHarness();
  const job = state.jobs.get("job_1");
  assert.ok(job);
  job.status = "RESERVED";
  state.reservations.push({
    id: "res_stale",
    jobId: "job_1",
    professionalOrgId: "org_pro_1",
    professionalId: "usr_pro_1",
    status: "ACTIVE",
    reservedAt: new Date("2026-06-09T10:00:00.000Z"),
    expiresAt: new Date(Date.now() - 60_000),
    releasedAt: null,
    acceptedAt: null,
    job: { id: job.id, tenantId: job.tenantId, clientOrgId: job.clientOrgId }
  });

  const result = await service.sweepExpired({
    tenantId: "tenant_1",
    orgId: "org_ops",
    userId: "usr_ops_1",
    maxItems: 10,
    requestId: "req_sweep"
  });

  assert.deepEqual(result, { expiredCount: 1, jobsReopened: 1 });
  assert.equal(state.reservations[0]?.status, "EXPIRED");
  assert.equal(state.jobs.get("job_1")?.status, "POSTED");
  assert.equal(auditEvents.length, 1);
  assert.deepEqual(auditEvents[0], {
    id: auditEvents[0].id,
    tenantId: "tenant_1",
    orgId: "org_ops",
    actorUserId: "usr_ops_1",
    action: "reservation.sweep_expired",
    entityType: "JobReservation",
    entityId: "expired-sweep",
    requestId: "req_sweep",
    timestamp: auditEvents[0].timestamp,
    afterJson: {
      maxItems: 10,
      expiredCount: 1,
      jobsReopened: 1
    }
  });
});

test("reservations repository enforces tenant isolation and terminal reservation conflicts", async () => {
  const { repository, state } = createRepositoryHarness();

  const created = await repository.create({
    tenantId: "tenant_1",
    orgId: "org_pro_1",
    userId: "usr_pro_1",
    roles: ["PRO"],
    jobId: "job_1",
    expiresInMinutes: 45,
  });

  assert.equal(created.status, "active");
  assert.equal(state.jobs.get("job_1")?.status, "RESERVED");

  const listed = await repository.listByJob({
    tenantId: "tenant_1",
    orgId: "org_client_1",
    userId: "usr_client_1",
    roles: ["CLIENT"],
    jobId: "job_1",
  });
  assert.equal(listed.length, 1);

  await assert.rejects(
    () =>
      repository.listByJob({
        tenantId: "tenant_2",
        orgId: "org_client_1",
        userId: "usr_client_1",
        roles: ["CLIENT"],
        jobId: "job_1",
      }),
    /Job 'job_1' not found/i
  );

  const accepted = await repository.accept({
    tenantId: "tenant_1",
    orgId: "org_client_1",
    userId: "usr_client_1",
    roles: ["CLIENT"],
    reservationId: created.id,
  });
  assert.equal(accepted.status, "accepted");

  await assert.rejects(
    () =>
      repository.release({
        tenantId: "tenant_1",
        orgId: "org_client_1",
        userId: "usr_client_1",
        roles: ["CLIENT"],
        reservationId: created.id,
      }),
    ConflictException
  );

  await assert.rejects(
    () =>
      repository.expire({
        tenantId: "tenant_1",
        orgId: "org_ops",
        userId: "usr_ops_1",
        roles: ["CLIENT"],
        reservationId: created.id,
      }),
    ForbiddenException
  );

  const acceptedAgain = await repository.accept({
    tenantId: "tenant_1",
    orgId: "org_client_1",
    userId: "usr_client_1",
    roles: ["CLIENT"],
    reservationId: created.id,
  });
  assert.equal(acceptedAgain.status, "accepted");
});

test("reservations repository converts concurrent active reservation insert into conflict", async () => {
  const { repository, prisma, state } = createRepositoryHarness();
  const job = state.jobs.get("job_1");
  assert.ok(job);
  state.reservations.push({
    id: "res_existing",
    jobId: "job_1",
    professionalOrgId: "org_pro_1",
    professionalId: "usr_pro_1",
    status: "ACTIVE",
    reservedAt: new Date("2026-06-09T10:00:00.000Z"),
    expiresAt: new Date(Date.now() + 30 * 60_000),
    releasedAt: null,
    acceptedAt: null,
    job: { id: job.id, tenantId: job.tenantId, clientOrgId: job.clientOrgId }
  });

  const originalFindFirst = prisma.jobReservation.findFirst;
  let activeLookupCount = 0;
  prisma.jobReservation.findFirst = async (args: Parameters<typeof originalFindFirst>[0]) => {
    if (args.where.jobId === "job_1" && args.where.status === "ACTIVE" && activeLookupCount++ === 0) {
      return null;
    }
    return originalFindFirst(args);
  };
  prisma.jobReservation.create = async () => {
    throw Object.assign(new Error("Unique constraint failed on active reservation"), { code: "P2002" });
  };

  await assert.rejects(
    () =>
      repository.create({
        tenantId: "tenant_1",
        orgId: "org_pro_2",
        userId: "usr_pro_2",
        roles: ["PRO"],
        jobId: "job_1",
        expiresInMinutes: 30
      }),
    ConflictException
  );

  assert.equal(state.reservations.filter((reservation) => reservation.status === "ACTIVE").length, 1);
});
