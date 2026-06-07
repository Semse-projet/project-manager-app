import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDisputeWorkspaceMemoryRecord,
  buildJobWorkspaceMemoryRecord,
  buildProjectWorkspaceMemoryRecord
} from "../../apps/api/src/modules/knowledge/workspace-memory.business-records.ts";

test("buildJobWorkspaceMemoryRecord creates task-scoped record", () => {
  const record = buildJobWorkspaceMemoryRecord({
    tenantId: "tnt",
    orgId: "org",
    userId: "usr",
    jobId: "job_1",
    title: "Paint rooftop",
    status: "posted",
    scope: "Roof inspection",
    budgetMin: 100,
    budgetMax: 250,
    action: "created"
  });

  assert.equal(record.workspaceId, "job:job_1");
  assert.equal(record.kind, "task_state");
  assert.ok(record.tags.includes("jobs"));
  assert.ok(record.summary.includes("created"));
});

test("buildProjectWorkspaceMemoryRecord creates decision record", () => {
  const record = buildProjectWorkspaceMemoryRecord({
    tenantId: "tnt",
    orgId: "org",
    userId: "usr",
    projectId: "prj_1",
    jobId: "job_1",
    previousStatus: "open",
    status: "in_progress"
  });

  assert.equal(record.workspaceId, "project:prj_1");
  assert.equal(record.kind, "decision");
  assert.ok(record.tags.includes("status-change"));
  assert.ok(record.body?.includes("From: open"));
});

test("buildDisputeWorkspaceMemoryRecord creates dispute-specific records", () => {
  const record = buildDisputeWorkspaceMemoryRecord({
    tenantId: "tnt",
    orgId: "org",
    userId: "usr",
    disputeId: "dsp_1",
    projectId: "prj_1",
    jobId: "job_1",
    status: "resolved",
    reason: "Late delivery",
    action: "resolved",
    resolution: "Refund approved"
  });

  assert.equal(record.workspaceId, "dispute:dsp_1");
  assert.equal(record.kind, "decision");
  assert.ok(record.tags.includes("disputes"));
  assert.ok(record.body?.includes("Resolution: Refund approved"));
});
