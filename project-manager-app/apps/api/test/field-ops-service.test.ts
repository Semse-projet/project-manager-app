import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { FieldOpsService } from "../dist/modules/field-ops/field-ops.service.js";
import type { TrackerSessionRecord } from "../src/modules/field-ops/tracker-session.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Field Ops Service Layer Tests: Units, Worklogs, Tracker, Facts, Vendors
// ─────────────────────────────────────────────────────────────────────────────

const baseTime = new Date("2026-06-22T10:00:00.000Z");

function makeSession(
  status: TrackerSessionRecord["status"],
  overrides: Partial<TrackerSessionRecord> = {}
): TrackerSessionRecord {
  const startedAt = overrides.startedAt ?? baseTime;
  return {
    id: overrides.id ?? "sess_1",
    tenantId: overrides.tenantId ?? "tenant_1",
    orgId: overrides.orgId ?? "org_1",
    jobId: overrides.jobId ?? "job_1",
    createdBy: overrides.createdBy ?? "usr_1",
    status,
    startedAt,
    resumedAt:
      overrides.resumedAt ??
      (status === "RUNNING" ? new Date("2026-06-22T10:05:00.000Z") : null),
    pausedAt:
      overrides.pausedAt ??
      (status === "PAUSED" ? new Date("2026-06-22T10:15:00.000Z") : null),
    stoppedAt:
      overrides.stoppedAt ??
      (status === "STOPPED" ? new Date("2026-06-22T10:30:00.000Z") : null),
    accumulatedSeconds: overrides.accumulatedSeconds ?? 600,
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? startedAt,
    updatedAt: overrides.updatedAt ?? new Date("2026-06-22T10:30:00.000Z"),
    job:
      overrides.job ?? {
        id: overrides.jobId ?? "job_1",
        title: "Bathroom Remodel",
        status: "IN_PROGRESS",
      },
  };
}

function createMockFieldOpsService(overrides?: {
  units?: any[];
  worklogs?: any[];
  sessions?: TrackerSessionRecord[];
  jobs?: any[];
  facts?: any[];
  vendors?: any[];
  complianceDocs?: any[];
  shouldThrow?: {
    [key: string]: Error;
  };
}) {
  const units = overrides?.units ?? [];
  const worklogs = overrides?.worklogs ?? [];
  const sessions = overrides?.sessions ?? [];
  const jobs = overrides?.jobs ?? [];
  const facts = overrides?.facts ?? [];
  const vendors = overrides?.vendors ?? [];
  const complianceDocs = overrides?.complianceDocs ?? [];
  const shouldThrow = overrides?.shouldThrow ?? {};

  const mockRepo = {
    // Units
    listUnits: async (input: any) => {
      if (shouldThrow["listUnits"]) throw shouldThrow["listUnits"];
      return units.filter((u) => !input.projectId || u.projectId === input.projectId);
    },
    findUnitById: async (input: any) => {
      if (shouldThrow["findUnitById"]) throw shouldThrow["findUnitById"];
      return units.find((u) => u.id === input.fieldUnitId) ?? null;
    },
    createUnit: async (input: any) => {
      if (shouldThrow["createUnit"]) throw shouldThrow["createUnit"];
      const unit = { id: "unit_1", ...input, createdAt: baseTime };
      units.push(unit);
      return unit;
    },
    updateUnitStatus: async (input: any) => {
      if (shouldThrow["updateUnitStatus"]) throw shouldThrow["updateUnitStatus"];
      const unit = units.find((u) => u.id === input.fieldUnitId);
      if (unit) unit.status = input.status;
      return unit;
    },

    // Worklogs
    listWorklogs: async (input: any) => {
      if (shouldThrow["listWorklogs"]) throw shouldThrow["listWorklogs"];
      return worklogs.filter(
        (w) =>
          (!input.fieldUnitId || w.fieldUnitId === input.fieldUnitId) &&
          (!input.dateFrom || new Date(w.date) >= input.dateFrom) &&
          (!input.dateTo || new Date(w.date) <= input.dateTo)
      );
    },
    createWorklog: async (input: any) => {
      if (shouldThrow["createWorklog"]) throw shouldThrow["createWorklog"];
      const worklog = {
        id: "worklog_1",
        ...input,
        createdAt: baseTime,
      };
      worklogs.push(worklog);
      return worklog;
    },

    // Tracker Sessions
    findActiveTrackerSession: async (input: any) => {
      if (shouldThrow["findActiveTrackerSession"]) throw shouldThrow["findActiveTrackerSession"];
      return sessions.find(
        (s) =>
          s.tenantId === input.tenantId &&
          s.createdBy === input.createdBy &&
          (s.status === "RUNNING" || s.status === "PAUSED")
      ) ?? null;
    },
    listRecentTrackerSessions: async (input: any) => {
      if (shouldThrow["listRecentTrackerSessions"]) throw shouldThrow["listRecentTrackerSessions"];
      return sessions
        .filter((s) => s.tenantId === input.tenantId && s.createdBy === input.createdBy)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, input.limit ?? 20);
    },
    findJobForTracker: async (input: any) => {
      if (shouldThrow["findJobForTracker"]) throw shouldThrow["findJobForTracker"];
      return jobs.find((j) => j.id === input.jobId) ?? null;
    },
    createTrackerSession: async (input: any) => {
      if (shouldThrow["createTrackerSession"]) throw shouldThrow["createTrackerSession"];
      const session = makeSession(input.status, {
        tenantId: input.tenantId,
        orgId: input.orgId,
        jobId: input.jobId,
        createdBy: input.createdBy,
        startedAt: input.startedAt,
        resumedAt: input.resumedAt,
        pausedAt: input.pausedAt,
        stoppedAt: input.stoppedAt,
        accumulatedSeconds: input.accumulatedSeconds ?? 0,
        notes: input.notes ?? null,
      });
      sessions.push(session);
      return session;
    },
    findTrackerSessionById: async (input: any) => {
      if (shouldThrow["findTrackerSessionById"]) throw shouldThrow["findTrackerSessionById"];
      return sessions.find((s) => s.id === input.sessionId) ?? null;
    },
    updateTrackerSession: async (input: any) => {
      if (shouldThrow["updateTrackerSession"]) throw shouldThrow["updateTrackerSession"];
      const session = sessions.find((s) => s.id === input.sessionId);
      if (session) {
        Object.assign(session, input);
      }
      return session;
    },
    listTrackerSessions: async (input: any) => {
      if (shouldThrow["listTrackerSessions"]) throw shouldThrow["listTrackerSessions"];
      return sessions
        .filter((s) => s.tenantId === input.tenantId && s.createdBy === input.createdBy)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, input.limit ?? 50);
    },
    listJobsForTracker: async (input: any) => {
      if (shouldThrow["listJobsForTracker"]) throw shouldThrow["listJobsForTracker"];
      return jobs;
    },

    // Facts (RDF triplicates)
    listFacts: async (input: any) => {
      if (shouldThrow["listFacts"]) throw shouldThrow["listFacts"];
      return facts.filter(
        (f) =>
          (!input.subject || f.subject === input.subject) &&
          (!input.predicate || f.predicate === input.predicate)
      );
    },
    createFact: async (input: any) => {
      if (shouldThrow["createFact"]) throw shouldThrow["createFact"];
      const fact = {
        id: "fact_1",
        ...input,
        createdAt: baseTime,
      };
      facts.push(fact);
      return fact;
    },

    // Vendors & Compliance
    listVendors: async (input: any) => {
      if (shouldThrow["listVendors"]) throw shouldThrow["listVendors"];
      return vendors;
    },
    createVendor: async (input: any) => {
      if (shouldThrow["createVendor"]) throw shouldThrow["createVendor"];
      const vendor = {
        id: "vendor_1",
        ...input,
        createdAt: baseTime,
      };
      vendors.push(vendor);
      return vendor;
    },
    upsertComplianceDoc: async (input: any) => {
      if (shouldThrow["upsertComplianceDoc"]) throw shouldThrow["upsertComplianceDoc"];
      const doc = {
        id: "comp_1",
        ...input,
        createdAt: baseTime,
      };
      complianceDocs.push(doc);
      return doc;
    },
  };

  const mockAuditService = {
    append: async () => {
      // noop for tests
    },
  };

  return new FieldOpsService(mockRepo as any, mockAuditService as any);
}

// ═════════════════════════════════════════════════════════════════════════════
// UNITS TESTS
// ═════════════════════════════════════════════════════════════════════════════

test("field-ops: listUnits returns all units for project when no filter", async () => {
  const units = [
    { id: "unit_1", projectId: "proj_1", code: "UNIT-A", name: "Site A", status: "IN_PROGRESS" },
    { id: "unit_2", projectId: "proj_1", code: "UNIT-B", name: "Site B", status: "PENDING" },
  ];
  const service = createMockFieldOpsService({ units });

  const result = await service.listUnits({ tenantId: "tenant_1", projectId: "proj_1" });

  assert.equal(result.length, 2);
  assert.equal(result[0].code, "UNIT-A");
});

test("field-ops: createUnit requires non-empty code", async () => {
  const service = createMockFieldOpsService();

  assert.throws(
    () =>
      service.createUnit({
        tenantId: "tenant_1",
        projectId: "proj_1",
        code: "   ",
      }),
    BadRequestException
  );
});

test("field-ops: updateUnitStatus validates against allowed statuses", async () => {
  const service = createMockFieldOpsService();

  assert.throws(
    () =>
      service.updateUnitStatus({
        tenantId: "tenant_1",
        fieldUnitId: "unit_1",
        status: "INVALID_STATUS",
      }),
    BadRequestException
  );
});

test("field-ops: updateUnitStatus accepts valid SEMSE statuses", async () => {
  const units = [{ id: "unit_1", status: "PENDING", projectId: "proj_1", code: "UNIT-A" }];
  const service = createMockFieldOpsService({ units });

  const result = await service.updateUnitStatus({
    tenantId: "tenant_1",
    fieldUnitId: "unit_1",
    status: "IN_PROGRESS",
  });

  assert.equal(result.status, "IN_PROGRESS");
});

// ═════════════════════════════════════════════════════════════════════════════
// WORKLOGS TESTS
// ═════════════════════════════════════════════════════════════════════════════

test("field-ops: createWorklog requires doneToday and pendingNext", async () => {
  const service = createMockFieldOpsService();

  assert.throws(
    () =>
      service.createWorklog({
        tenantId: "tenant_1",
        fieldUnitId: "unit_1",
        date: "2026-06-22",
        doneToday: "   ",
        pendingNext: "Something",
        createdBy: "usr_1",
      }),
    BadRequestException
  );
});

test("field-ops: listWorklogs filters by dateRange when provided", async () => {
  const worklogs = [
    {
      id: "wl_1",
      fieldUnitId: "unit_1",
      date: new Date("2026-06-20"),
      doneToday: "Phase 1",
      pendingNext: "Phase 2",
    },
    {
      id: "wl_2",
      fieldUnitId: "unit_1",
      date: new Date("2026-06-22"),
      doneToday: "Phase 2",
      pendingNext: "Phase 3",
    },
    {
      id: "wl_3",
      fieldUnitId: "unit_1",
      date: new Date("2026-06-25"),
      doneToday: "Phase 3",
      pendingNext: "Cleanup",
    },
  ];
  const service = createMockFieldOpsService({ worklogs });

  const result = await service.listWorklogs({
    tenantId: "tenant_1",
    fieldUnitId: "unit_1",
    dateFrom: "2026-06-21",
    dateTo: "2026-06-23",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "wl_2");
});

test("field-ops: createWorklog persists doneToday, pendingNext, and optional blockers", async () => {
  const service = createMockFieldOpsService();

  const result = await service.createWorklog({
    tenantId: "tenant_1",
    fieldUnitId: "unit_1",
    date: "2026-06-22",
    doneToday: "Framing complete",
    pendingNext: "Electrical rough-in",
    blockers: "Permit delay",
    notes: "All systems nominal",
    createdBy: "usr_1",
  });

  assert.ok(result.id);
  assert.equal(result.doneToday, "Framing complete");
  assert.equal(result.blockers, "Permit delay");
});

// ═════════════════════════════════════════════════════════════════════════════
// TRACKER SUMMARY & SNAPSHOT TESTS
// ═════════════════════════════════════════════════════════════════════════════

test("field-ops: getTrackerSnapshot returns active session + recent history", async () => {
  const activeSess = makeSession("RUNNING", { id: "active_1", createdBy: "usr_1", accumulatedSeconds: 300 });
  const recentSess = makeSession("STOPPED", { id: "past_1", createdBy: "usr_1", accumulatedSeconds: 1200 });
  const service = createMockFieldOpsService({ sessions: [activeSess, recentSess] });

  const result = await service.getTrackerSnapshot({ tenantId: "tenant_1", createdBy: "usr_1" });

  assert.ok(result.activeSession);
  assert.equal(result.activeSession.id, "active_1");
  assert.equal(result.recentSessions.length, 2);
});

test("field-ops: getTrackerSummary aggregates by job and calculates totals for week/month", async () => {
  const now = new Date();
  // Use 6 days ago so all sessions fall safely inside the 7-day window regardless of wall-clock time
  const weekAgo = new Date(now.getTime() - 6 * 24 * 3600 * 1000);

  const sessions = [
    makeSession("STOPPED", {
      id: "sess_1",
      jobId: "job_1",
      createdBy: "usr_1",
      startedAt: weekAgo,
      accumulatedSeconds: 3600,
    }),
    makeSession("STOPPED", {
      id: "sess_2",
      jobId: "job_1",
      createdBy: "usr_1",
      startedAt: new Date(weekAgo.getTime() + 86400000),
      accumulatedSeconds: 1800,
    }),
    makeSession("STOPPED", {
      id: "sess_3",
      jobId: "job_2",
      createdBy: "usr_1",
      startedAt: new Date(weekAgo.getTime() + 172800000),
      accumulatedSeconds: 7200,
    }),
  ];

  const service = createMockFieldOpsService({ sessions });

  const result = await service.getTrackerSummary({
    tenantId: "tenant_1",
    createdBy: "usr_1",
    range: "week",
  });

  assert.equal(result.range, "week");
  assert.equal(result.sessionCount, 3);
  assert.equal(result.totalSeconds, 12600); // 3600 + 1800 + 7200
  assert.ok(result.byJob.length > 0);
  assert.equal(result.byJob[0].jobId, "job_2"); // job_2 has most seconds (7200)
});

test("field-ops: getTrackerSummary highlights sessionsWithoutNotes", async () => {
  const recentStart = new Date(Date.now() - 2 * 24 * 3600 * 1000);
  const sessions = [
    makeSession("STOPPED", { id: "sess_1", createdBy: "usr_1", startedAt: recentStart, notes: null }),
    makeSession("STOPPED", { id: "sess_2", createdBy: "usr_1", startedAt: recentStart, notes: "Some work" }),
    makeSession("STOPPED", { id: "sess_3", createdBy: "usr_1", startedAt: recentStart, notes: null }),
  ];

  const service = createMockFieldOpsService({ sessions });

  const result = await service.getTrackerSummary({ tenantId: "tenant_1", createdBy: "usr_1", range: "week" });

  assert.equal(result.sessionsWithoutNotes, 2);
});

// ═════════════════════════════════════════════════════════════════════════════
// TRACKER SESSION LIFECYCLE TESTS
// ═════════════════════════════════════════════════════════════════════════════

test("field-ops: startTrackerSession creates session with RUNNING status", async () => {
  const jobs = [{ id: "job_1", title: "Bathroom Remodel", status: "IN_PROGRESS" }];
  const service = createMockFieldOpsService({ jobs });

  const result = await service.startTrackerSession({
    tenantId: "tenant_1",
    orgId: "org_1",
    createdBy: "usr_1",
    requestId: "req_1",
    jobId: "job_1",
    notes: "Started work",
  });

  assert.equal(result.status, "RUNNING");
  assert.ok(result.id);
});

test("field-ops: startTrackerSession rejects when job does not exist", async () => {
  const service = createMockFieldOpsService();

  assert.rejects(
    () =>
      service.startTrackerSession({
        tenantId: "tenant_1",
        orgId: "org_1",
        createdBy: "usr_1",
        requestId: "req_1",
        jobId: "nonexistent_job",
      }),
    BadRequestException
  );
});

test("field-ops: createManualTrackerSession calculates accumulatedSeconds from time range", async () => {
  const jobs = [{ id: "job_1", title: "Bathroom", status: "IN_PROGRESS" }];
  const service = createMockFieldOpsService({ jobs });

  const result = await service.createManualTrackerSession({
    tenantId: "tenant_1",
    orgId: "org_1",
    createdBy: "usr_1",
    requestId: "req_1",
    jobId: "job_1",
    date: "2026-06-22",
    startTime: "08:00",
    endTime: "12:00",
    notes: "Morning shift",
  });

  assert.equal(result.status, "STOPPED");
  assert.equal(result.accumulatedSeconds, 14400); // 4 hours
});

test("field-ops: createManualTrackerSession rejects invalid time range", async () => {
  const service = createMockFieldOpsService();

  assert.rejects(
    () =>
      service.createManualTrackerSession({
        tenantId: "tenant_1",
        orgId: "org_1",
        createdBy: "usr_1",
        requestId: "req_1",
        jobId: "job_1",
        date: "2026-06-22",
        startTime: "12:00",
        endTime: "08:00",
      }),
    BadRequestException
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// FACTS (RDF TRIPLICATES) TESTS
// ═════════════════════════════════════════════════════════════════════════════

test("field-ops: createFact requires subject, predicate, object", async () => {
  const service = createMockFieldOpsService();

  assert.throws(
    () =>
      service.createFact({
        tenantId: "tenant_1",
        subject: "   ",
        predicate: "has_skill",
        object: "drywall",
        createdBy: "usr_1",
      }),
    BadRequestException
  );
});

test("field-ops: listFacts filters by subject and predicate", async () => {
  const facts = [
    {
      id: "fact_1",
      subject: "contractor_1",
      predicate: "has_skill",
      object: "electrical",
    },
    {
      id: "fact_2",
      subject: "contractor_1",
      predicate: "has_cert",
      object: "licensed_electrician",
    },
    {
      id: "fact_3",
      subject: "contractor_2",
      predicate: "has_skill",
      object: "plumbing",
    },
  ];

  const service = createMockFieldOpsService({ facts });

  const result = await service.listFacts({
    tenantId: "tenant_1",
    subject: "contractor_1",
    predicate: "has_skill",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].object, "electrical");
});

// ═════════════════════════════════════════════════════════════════════════════
// VENDORS & COMPLIANCE TESTS
// ═════════════════════════════════════════════════════════════════════════════

test("field-ops: createVendor requires non-empty name", async () => {
  const service = createMockFieldOpsService();

  assert.throws(
    () =>
      service.createVendor({
        tenantId: "tenant_1",
        name: "   ",
        phone: "555-0000",
      }),
    BadRequestException
  );
});

test("field-ops: listVendors returns all vendors for tenant", async () => {
  const vendors = [
    { id: "vendor_1", name: "ABC Supply", phone: "555-1000", email: "abc@supply.com" },
    { id: "vendor_2", name: "XYZ Materials", phone: "555-2000", email: "xyz@materials.com" },
  ];

  const service = createMockFieldOpsService({ vendors });

  const result = await service.listVendors({ tenantId: "tenant_1" });

  assert.equal(result.length, 2);
  assert.equal(result[0].name, "ABC Supply");
});

test("field-ops: upsertComplianceDoc validates status values", async () => {
  const service = createMockFieldOpsService();

  assert.throws(
    () =>
      service.upsertComplianceDoc({
        tenantId: "tenant_1",
        vendorId: "vendor_1",
        type: "insurance",
        status: "UNKNOWN",
      }),
    BadRequestException
  );
});

test("field-ops: upsertComplianceDoc accepts valid compliance statuses", async () => {
  const service = createMockFieldOpsService();

  const result = await service.upsertComplianceDoc({
    tenantId: "tenant_1",
    vendorId: "vendor_1",
    type: "insurance",
    status: "APPROVED",
    fileUrl: "https://example.com/cert.pdf",
    expiresAt: "2027-06-22",
  });

  assert.equal(result.status, "APPROVED");
  assert.ok(result.id);
});

// ═════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ═════════════════════════════════════════════════════════════════════════════

test("field-ops: full job site ops workflow — unit → worklog → tracker → facts", async () => {
  const jobs = [{ id: "job_1", title: "Kitchen Remodel", status: "IN_PROGRESS" }];
  const service = createMockFieldOpsService({ jobs });

  // Step 1: Create unit
  const unit = await service.createUnit({
    tenantId: "tenant_1",
    projectId: "proj_1",
    code: "KITCHEN-01",
    name: "Customer Main Kitchen",
  });
  assert.ok(unit.id);

  // Step 2: Log work
  const worklog = await service.createWorklog({
    tenantId: "tenant_1",
    fieldUnitId: unit.id,
    date: "2026-06-22",
    doneToday: "Cabinet demolition complete",
    pendingNext: "Electrical rough-in",
    blockers: "Permit not signed",
    createdBy: "usr_1",
  });
  assert.equal(worklog.doneToday, "Cabinet demolition complete");

  // Step 3: Track time on job
  const session = await service.startTrackerSession({
    tenantId: "tenant_1",
    orgId: "org_1",
    createdBy: "usr_1",
    requestId: "req_1",
    jobId: "job_1",
    notes: "Cabinet demo work",
  });
  assert.equal(session.status, "RUNNING");

  // Step 4: Record factual knowledge
  const fact = await service.createFact({
    tenantId: "tenant_1",
    subject: "usr_1",
    predicate: "has_skill",
    object: "cabinet_installation",
    confidence: 0.9,
    worklogId: worklog.id,
    createdBy: "usr_1",
  });
  assert.ok(fact.id);
});

test("field-ops: vendor compliance tracking — create vendor → manage docs → track status", async () => {
  const service = createMockFieldOpsService();

  // Step 1: Register vendor
  const vendor = await service.createVendor({
    tenantId: "tenant_1",
    name: "Elite Electric",
    phone: "555-0123",
    email: "contact@elite.com",
  });
  assert.ok(vendor.id);

  // Step 2: Track insurance compliance
  const insuranceDoc = await service.upsertComplianceDoc({
    tenantId: "tenant_1",
    vendorId: vendor.id,
    type: "general_liability_insurance",
    status: "PENDING",
    notes: "Awaiting policy renewal docs",
  });
  assert.equal(insuranceDoc.type, "general_liability_insurance");
  assert.equal(insuranceDoc.status, "PENDING");

  // Step 3: Update to approved
  const approvedDoc = await service.upsertComplianceDoc({
    tenantId: "tenant_1",
    vendorId: vendor.id,
    type: "general_liability_insurance",
    status: "APPROVED",
    fileUrl: "https://files.example.com/elite-insurance-2026.pdf",
    expiresAt: "2027-06-22",
  });
  assert.equal(approvedDoc.status, "APPROVED");
  assert.ok(approvedDoc.fileUrl);
});
