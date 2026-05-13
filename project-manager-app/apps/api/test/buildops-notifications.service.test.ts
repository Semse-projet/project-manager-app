import test from "node:test";
import assert from "node:assert/strict";
import { NotificationsService } from "../dist/modules/notifications/notifications.service.js";

function makeRepo() {
  const created: Array<Record<string, unknown>> = [];
  return {
    created,
    listForUser: async () => [],
    countUnread: async () => 0,
    markRead: async () => {},
    markAllRead: async () => {},
    create: async (spec: Record<string, unknown>) => {
      created.push(spec);
    },
  };
}

function makeService() {
  const repo = makeRepo();
  const svc = new NotificationsService(repo as Parameters<typeof NotificationsService.prototype.handleEvent>[never]);
  return { svc, repo };
}

async function handle(
  svc: NotificationsService,
  tenantId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  return svc.handleEvent({ tenantId, eventType, payload });
}

// ── buildops.plan.approved ─────────────────────────────────────────────────

test("buildops.plan.approved notifies the OPS user (createdBy)", async () => {
  const { svc, repo } = makeService();
  await handle(svc, "t1", "buildops.plan.approved", {
    buildOpsProjectId: "bop_1",
    jobId: "job_1",
    createdBy: "usr_ops_001",
    actorUserId: "usr_client_001",
    approvedAt: "2026-05-13T10:00:00.000Z",
  });
  assert.equal(repo.created.length, 1);
  const n = repo.created[0];
  assert.equal(n.userId, "usr_ops_001");
  assert.equal(n.type, "buildops_plan_approved");
  assert.equal(n.tenantId, "t1");
  assert.ok(typeof n.title === "string" && (n.title as string).length > 0);
});

test("buildops.plan.approved skips notification when createdBy missing", async () => {
  const { svc, repo } = makeService();
  await handle(svc, "t1", "buildops.plan.approved", {
    buildOpsProjectId: "bop_1",
    actorUserId: "usr_client_001",
  });
  assert.equal(repo.created.length, 0);
});

// ── buildops.plan.changes_requested ───────────────────────────────────────

test("buildops.plan.changes_requested notifies OPS (createdBy) with comment", async () => {
  const { svc, repo } = makeService();
  await handle(svc, "t1", "buildops.plan.changes_requested", {
    buildOpsProjectId: "bop_1",
    jobId: "job_1",
    createdBy: "usr_ops_002",
    actorUserId: "usr_client_002",
    comment: "Reduce prep time and add third coat.",
    reviewedAt: "2026-05-13T11:00:00.000Z",
  });
  assert.equal(repo.created.length, 1);
  const n = repo.created[0];
  assert.equal(n.userId, "usr_ops_002");
  assert.equal(n.type, "buildops_plan_changes_requested");
  assert.ok((n.body as string).includes("Reduce prep time"));
});

test("buildops.plan.changes_requested uses fallback body when no comment", async () => {
  const { svc, repo } = makeService();
  await handle(svc, "t1", "buildops.plan.changes_requested", {
    buildOpsProjectId: "bop_1",
    createdBy: "usr_ops_002",
  });
  assert.equal(repo.created.length, 1);
  assert.ok(!(repo.created[0].body as string).includes("undefined"));
});

test("buildops.plan.changes_requested skips notification when createdBy missing", async () => {
  const { svc, repo } = makeService();
  await handle(svc, "t1", "buildops.plan.changes_requested", { buildOpsProjectId: "bop_1" });
  assert.equal(repo.created.length, 0);
});

// ── buildops.plan.rejected ─────────────────────────────────────────────────

test("buildops.plan.rejected notifies OPS (createdBy) with comment", async () => {
  const { svc, repo } = makeService();
  await handle(svc, "t1", "buildops.plan.rejected", {
    buildOpsProjectId: "bop_1",
    jobId: "job_1",
    createdBy: "usr_ops_003",
    actorUserId: "usr_client_003",
    comment: "Budget does not match expectations.",
    reviewedAt: "2026-05-13T12:00:00.000Z",
  });
  assert.equal(repo.created.length, 1);
  const n = repo.created[0];
  assert.equal(n.userId, "usr_ops_003");
  assert.equal(n.type, "buildops_plan_rejected");
  assert.ok((n.body as string).includes("Budget does not match"));
});

test("buildops.plan.rejected uses fallback body when no comment", async () => {
  const { svc, repo } = makeService();
  await handle(svc, "t1", "buildops.plan.rejected", {
    buildOpsProjectId: "bop_1",
    createdBy: "usr_ops_003",
  });
  assert.equal(repo.created.length, 1);
  assert.ok(!(repo.created[0].body as string).includes("undefined"));
});

test("buildops.plan.rejected skips notification when createdBy missing", async () => {
  const { svc, repo } = makeService();
  await handle(svc, "t1", "buildops.plan.rejected", { buildOpsProjectId: "bop_1" });
  assert.equal(repo.created.length, 0);
});

// ── buildops.plan.rerun_completed ─────────────────────────────────────────

test("buildops.plan.rerun_completed notifies actorUserId with version number", async () => {
  const { svc, repo } = makeService();
  await handle(svc, "t1", "buildops.plan.rerun_completed", {
    buildOpsProjectId: "bop_1",
    activeVersionId: "ver_2",
    activeVersionNumber: 2,
    actorUserId: "usr_ops_004",
    rerunCompletedAt: "2026-05-13T13:00:00.000Z",
  });
  assert.equal(repo.created.length, 1);
  const n = repo.created[0];
  assert.equal(n.userId, "usr_ops_004");
  assert.equal(n.type, "buildops_plan_rerun_completed");
  assert.ok((n.body as string).includes("v2"));
  assert.equal((n.payload as Record<string, unknown>).activeVersionNumber, 2);
});

test("buildops.plan.rerun_completed skips notification when actorUserId missing", async () => {
  const { svc, repo } = makeService();
  await handle(svc, "t1", "buildops.plan.rerun_completed", {
    buildOpsProjectId: "bop_1",
    activeVersionNumber: 2,
  });
  assert.equal(repo.created.length, 0);
});

// ── unknown events still return empty ─────────────────────────────────────

test("unknown event type produces no notification", async () => {
  const { svc, repo } = makeService();
  await handle(svc, "t1", "buildops.plan.something_unknown", {
    buildOpsProjectId: "bop_1",
    createdBy: "usr_ops_001",
  });
  assert.equal(repo.created.length, 0);
});
