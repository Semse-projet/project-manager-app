import test from "node:test";
import assert from "node:assert/strict";
import { WorkerApplicationService } from "../dist/modules/worker-verification/worker-application.service.js";

type Call = { method: string; args: unknown[] };

function createRepoStub(overrides: Partial<Record<string, unknown>> = {}) {
  const calls: Call[] = [];
  const record = (method: string, args: unknown[], result: unknown) => {
    calls.push({ method, args });
    return result;
  };
  const repo = {
    calls,
    async createApplication(...args: unknown[]) {
      const input = args[0] as Record<string, unknown>;
      return record("createApplication", args, {
        id: "app-1",
        status: "submitted",
        ...input,
      });
    },
    async countOpenByEmail(...args: unknown[]) {
      return record("countOpenByEmail", args, 0);
    },
    async countRecentBySession(...args: unknown[]) {
      return record("countRecentBySession", args, 0);
    },
    async getApplication(...args: unknown[]) {
      return record("getApplication", args, { id: args[0], status: "submitted" });
    },
    async updateApplication(...args: unknown[]) {
      const patch = args[2] as Record<string, unknown>;
      return record("updateApplication", args, { id: args[0], tenantId: args[1], ...patch });
    },
    async countByStatus(...args: unknown[]) {
      return record("countByStatus", args, { submitted: 3, approved: 1 });
    },
    ...overrides,
  };
  return repo;
}

function createService(overrides: Partial<Record<string, unknown>> = {}) {
  const repo = createRepoStub(overrides);
  const events: Array<{ scope: string; event: string }> = [];
  const sseBus = {
    emit(scope: string, event: string) {
      events.push({ scope, event });
    },
  };
  const service = new WorkerApplicationService(repo as never, sseBus as never);
  return { service, repo, events };
}

void test("submitApplication normalizes email and emits event", async () => {
  const { service, repo, events } = createService();

  const record = await service.submitApplication({
    tenantId: "tnt",
    fullName: "  Juan Pérez  ",
    email: "Juan.Perez@Example.COM",
    trade: " electrical ",
  });

  assert.equal(record.status, "submitted");
  const createCall = repo.calls.find((call) => call.method === "createApplication");
  assert.ok(createCall);
  const payload = createCall.args[0] as Record<string, unknown>;
  assert.equal(payload.email, "juan.perez@example.com");
  assert.equal(payload.fullName, "Juan Pérez");
  assert.equal(payload.trade, "electrical");
  assert.deepEqual(events, [{ scope: "worker-application", event: "submitted" }]);
});

void test("submitApplication rejects duplicate open application by email", async () => {
  const { service } = createService({
    async countOpenByEmail() {
      return 1;
    },
  });

  await assert.rejects(
    service.submitApplication({ tenantId: "tnt", fullName: "Juan", email: "j@x.com", trade: "painting" }),
    /aplicación en revisión/i,
  );
});

void test("submitApplication rejects when session daily limit is exceeded", async () => {
  const { service } = createService({
    async countRecentBySession() {
      return 3;
    },
  });

  await assert.rejects(
    service.submitApplication({
      tenantId: "tnt",
      fullName: "Juan",
      email: "j@x.com",
      trade: "painting",
      sessionToken: "sess-1",
    }),
    /límite de aplicaciones/i,
  );
});

void test("reviewApplication rejects invalid status", async () => {
  const { service } = createService();

  await assert.rejects(
    service.reviewApplication({ id: "app-1", tenantId: "tnt", reviewedBy: "admin", status: "banana" }),
    /Invalid review status/,
  );
});

void test("reviewApplication rejects already-resolved applications", async () => {
  const { service } = createService({
    async getApplication() {
      return { id: "app-1", status: "approved" };
    },
  });

  await assert.rejects(
    service.reviewApplication({ id: "app-1", tenantId: "tnt", reviewedBy: "admin", status: "rejected" }),
    /already resolved/i,
  );
});

void test("reviewApplication records reviewer and emits event", async () => {
  const { service, repo, events } = createService();

  await service.reviewApplication({
    id: "app-1",
    tenantId: "tnt",
    reviewedBy: "admin-1",
    status: "approved",
    reviewNotes: "perfil sólido",
  });

  const updateCall = repo.calls.find((call) => call.method === "updateApplication");
  assert.ok(updateCall);
  const patch = updateCall.args[2] as Record<string, unknown>;
  assert.equal(patch.status, "approved");
  assert.equal(patch.reviewedBy, "admin-1");
  assert.equal(patch.reviewNotes, "perfil sólido");
  assert.ok(patch.reviewedAt instanceof Date);
  assert.deepEqual(events, [{ scope: "worker-application", event: "approved" }]);
});

void test("getStats aggregates counts by status", async () => {
  const { service } = createService();

  const stats = await service.getStats("tnt");

  assert.equal(stats.total, 4);
  assert.equal(stats.submitted, 3);
  assert.equal(stats.approved, 1);
  assert.equal(stats.reviewing, 0);
  assert.equal(stats.rejected, 0);
});
