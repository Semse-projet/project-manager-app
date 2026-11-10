import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { BuildOpsIntelligenceAgent } from "../dist/modules/operational-intelligence/buildops-intelligence.agent.js";

test("milestone evaluation constrains the owning project tenant in SQL before any signal or RAG", async () => {
  let lookup: Record<string, unknown> | undefined;
  let signalWrites = 0;
  let runWrites = 0;
  let ragReads = 0;
  const prisma = {
    milestone: {
      async findFirst(args: Record<string, unknown>) {
        lookup = args;
        return null; // A foreign-tenant milestone must be invisible to the caller.
      },
    },
  };
  const signals = { async upsertSignal() { signalWrites++; return { created: true, id: "signal" }; } };
  const runs = { async record() { runWrites++; } };
  const rag = { async retrieveContext() { ragReads++; return { available: false, citations: [] }; } };
  const agent = new BuildOpsIntelligenceAgent(prisma as never, signals as never, runs as never, undefined, rag as never);

  await agent.evaluateMilestone({
    tenantId: "tenant-A", milestoneId: "milestone-of-tenant-B", triggerEvent: "EVIDENCE_UPLOADED",
  });

  assert.deepEqual(lookup?.where, {
    id: "milestone-of-tenant-B",
    project: { is: { tenantId: "tenant-A" } },
  }, "SQL must enforce tenant through the milestone's owning Project");
  assert.deepEqual(lookup?.include, { evidenceItems: true });
  assert.equal(signalWrites, 0, "a foreign-tenant milestone must never create operational signals");
  assert.equal(runWrites, 0, "a foreign-tenant milestone must never appear in intelligence runs");
  assert.equal(ragReads, 0, "a foreign-tenant milestone must never trigger document retrieval");
});

test("a valid same-tenant milestone still records a rule-only evaluation", async () => {
  let recorded: Record<string, unknown> | undefined;
  const prisma = {
    milestone: {
      async findFirst(args: { where: { id: string; project: { is: { tenantId: string } } } }) {
        assert.equal(args.where.project.is.tenantId, "tenant-A");
        return {
          id: "milestone-A", projectId: "project-A", status: "DRAFT",
          paymentReadiness: "ready_to_release", evidenceReadiness: "complete",
          evidenceItems: [],
        };
      },
    },
    changeOrderCandidate: { async count() { return 0; } },
  };
  const signals = { async upsertSignal() { throw new Error("unexpected signal"); } };
  const runs = { async record(input: Record<string, unknown>) { recorded = input; } };
  const agent = new BuildOpsIntelligenceAgent(prisma as never, signals as never, runs as never);

  await agent.evaluateMilestone({ tenantId: "tenant-A", milestoneId: "milestone-A", triggerEvent: "MILESTONE_CREATED" });

  assert.equal(recorded?.tenantId, "tenant-A");
  assert.equal(recorded?.entityId, "milestone-A");
  assert.equal(recorded?.status, "completed");
});
