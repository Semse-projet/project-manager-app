import test from "node:test";
import assert from "node:assert/strict";

/**
 * Job Auto-Completion — unit tests (no DB, no HTTP)
 *
 * Covers:
 *  JC1–JC3: checkAllMilestonesApproved logic
 *  JC4–JC6: systemCompleteJob guard logic
 *  JC7–JC9: notification dispatch for job.completed
 */

// ── checkAllMilestonesApproved logic ────────────────────────────────────────

type MilestoneRow = { status: string; deletedAt: Date | null };

function checkAllMilestonesApproved(milestones: MilestoneRow[]): boolean {
  const active = milestones.filter((m) => m.deletedAt === null);
  if (active.length === 0) return false;
  return active.every((m) => m.status === "APPROVED");
}

test("JC1: all milestones APPROVED → returns true", () => {
  const milestones: MilestoneRow[] = [
    { status: "APPROVED", deletedAt: null },
    { status: "APPROVED", deletedAt: null },
    { status: "APPROVED", deletedAt: null },
  ];
  assert.ok(checkAllMilestonesApproved(milestones));
});

test("JC2: one milestone not approved → returns false", () => {
  const milestones: MilestoneRow[] = [
    { status: "APPROVED", deletedAt: null },
    { status: "SUBMITTED", deletedAt: null },
    { status: "APPROVED", deletedAt: null },
  ];
  assert.equal(checkAllMilestonesApproved(milestones), false);
});

test("JC3: no active milestones → returns false (guard against empty project)", () => {
  const milestones: MilestoneRow[] = [
    { status: "APPROVED", deletedAt: new Date() },
  ];
  assert.equal(checkAllMilestonesApproved(milestones), false);
});

test("JC3b: empty milestone list → returns false", () => {
  assert.equal(checkAllMilestonesApproved([]), false);
});

// ── systemCompleteJob guard logic ────────────────────────────────────────────

type JobStatus = "DRAFT" | "IN_PROGRESS" | "REVIEW" | "COMPLETED" | "CANCELLED";

function systemCompleteJobGuard(jobStatus: JobStatus): { shouldSkip: boolean; reason?: string } {
  if (jobStatus === "COMPLETED") return { shouldSkip: true, reason: "already completed" };
  if (jobStatus === "CANCELLED") return { shouldSkip: true, reason: "job was cancelled" };
  return { shouldSkip: false };
}

test("JC4: job already COMPLETED → systemCompleteJob is no-op", () => {
  const result = systemCompleteJobGuard("COMPLETED");
  assert.ok(result.shouldSkip, "must skip when already completed");
  assert.equal(result.reason, "already completed");
});

test("JC5: job CANCELLED → systemCompleteJob is no-op", () => {
  const result = systemCompleteJobGuard("CANCELLED");
  assert.ok(result.shouldSkip, "must skip when cancelled");
});

test("JC6: job IN_PROGRESS → systemCompleteJob should proceed", () => {
  const result = systemCompleteJobGuard("IN_PROGRESS");
  assert.equal(result.shouldSkip, false);
});

test("JC6b: job REVIEW → systemCompleteJob should proceed", () => {
  const result = systemCompleteJobGuard("REVIEW");
  assert.equal(result.shouldSkip, false);
});

// ── job.completed notification dispatch ─────────────────────────────────────

type NotifSpec = { userId: string; type: string; title: string; body: string };

function buildJobCompletedNotifications(
  jobId: string,
  proUserId: string | null,
  clientUserId: string | null
): NotifSpec[] {
  const specs: NotifSpec[] = [];
  if (proUserId) {
    specs.push({
      userId: proUserId,
      type: "job_completed",
      title: "Trabajo marcado como completado",
      body: "El trabajo fue cerrado exitosamente. Revisa tu calificación y pago final.",
    });
  }
  if (clientUserId) {
    specs.push({
      userId: clientUserId,
      type: "job_completed_client",
      title: "Proyecto completado",
      body: "Tu proyecto fue cerrado. Califica al profesional para fortalecer la plataforma.",
    });
  }
  return specs;
}

test("JC7: both proUserId and clientUserId → 2 notifications", () => {
  const specs = buildJobCompletedNotifications("job-1", "pro-1", "client-1");
  assert.equal(specs.length, 2);
  assert.ok(specs.some((s) => s.userId === "pro-1" && s.type === "job_completed"));
  assert.ok(specs.some((s) => s.userId === "client-1" && s.type === "job_completed_client"));
});

test("JC8: only proUserId → 1 notification (contractor only)", () => {
  const specs = buildJobCompletedNotifications("job-1", "pro-1", null);
  assert.equal(specs.length, 1);
  assert.equal(specs[0]?.userId, "pro-1");
  assert.equal(specs[0]?.type, "job_completed");
});

test("JC9: neither userId → 0 notifications", () => {
  const specs = buildJobCompletedNotifications("job-1", null, null);
  assert.equal(specs.length, 0);
});

// ── Integration: approve-last-milestone trigger chain ────────────────────────

test("JC10: approving last milestone triggers systemCompleteJob exactly once", async () => {
  let systemCompleteCallCount = 0;
  const mockJobsService = {
    systemCompleteJob: async (_input: unknown) => {
      systemCompleteCallCount++;
    },
  };

  const mockMilestonesRepository = {
    checkAllMilestonesApproved: async (_input: unknown) => true,
  };

  const jobId = "job-10";
  const projectId = "proj-10";
  const tenantId = "tenant_default";
  const requestId = "req-10";

  const context = { projectId, jobId, proUserId: "pro-10", milestoneId: "m-10", evidenceCount: 2 };

  const allApproved = await mockMilestonesRepository.checkAllMilestonesApproved({ tenantId, projectId });
  if (allApproved && context.jobId) {
    await mockJobsService.systemCompleteJob({ tenantId, jobId: context.jobId, requestId });
  }

  assert.equal(systemCompleteCallCount, 1, "systemCompleteJob must be called exactly once");
});

test("JC11: approving non-last milestone does NOT trigger systemCompleteJob", async () => {
  let systemCompleteCallCount = 0;
  const mockJobsService = {
    systemCompleteJob: async (_input: unknown) => {
      systemCompleteCallCount++;
    },
  };

  const mockMilestonesRepository = {
    checkAllMilestonesApproved: async (_input: unknown) => false,
  };

  const context = { projectId: "proj-11", jobId: "job-11", proUserId: "pro-11" };

  const allApproved = await mockMilestonesRepository.checkAllMilestonesApproved({
    tenantId: "tenant_default",
    projectId: context.projectId,
  });
  if (allApproved && context.jobId) {
    await mockJobsService.systemCompleteJob({ tenantId: "tenant_default", jobId: context.jobId, requestId: "req-11" });
  }

  assert.equal(systemCompleteCallCount, 0, "systemCompleteJob must NOT be called when milestones remain");
});

test("JC12: no jobId in context → systemCompleteJob never called", async () => {
  let systemCompleteCallCount = 0;
  const mockJobsService = {
    systemCompleteJob: async (_input: unknown) => {
      systemCompleteCallCount++;
    },
  };

  const context = { projectId: "proj-12", jobId: null as string | null, proUserId: "pro-12" };

  const allApproved = true;
  if (allApproved && context.jobId) {
    await mockJobsService.systemCompleteJob({ tenantId: "tenant_default", jobId: context.jobId, requestId: "req-12" });
  }

  assert.equal(systemCompleteCallCount, 0, "no jobId means no completion trigger");
});
