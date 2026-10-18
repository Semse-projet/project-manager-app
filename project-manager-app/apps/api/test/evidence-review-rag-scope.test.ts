import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { EvidenceReviewService } from "../dist/modules/operational-intelligence/evidence-review.service.js";

function fixture({ validMembership = true, validProject = true }: { validMembership?: boolean; validProject?: boolean } = {}) {
  const ragInputs: Array<Record<string, unknown>> = [];
  const llmContexts: Array<Record<string, unknown>> = [];
  let membershipCalls = 0;
  const prisma = {
    milestoneEvidenceItem: {
      async findUnique() {
        return { id: "evidence-1", milestoneId: "milestone-1", status: "submitted",
          kind: "PHOTO", label: "Electrical wiring", description: null };
      },
      async findMany() { return [{ id: "evidence-1", status: "submitted", required: true }]; },
      async update() { return {}; },
    },
    milestone: {
      async findFirst() { return { id: "milestone-1", title: "Electrical install", projectId: "project-A" }; },
    },
    membership: {
      async findFirst() { membershipCalls++; return validMembership ? { orgId: "org-A" } : null; },
    },
    project: {
      async findFirst(args: { where?: Record<string, unknown> }) {
        if (args.where && "milestones" in args.where) return { tenantId: "tenant-A" };
        return validProject ? { id: "project-A" } : null;
      },
    },
  };
  const llm = {
    async chat(args: { context: Record<string, unknown> }) {
      llmContexts.push(args.context);
      return { text: "not-json", provider: "ollama", model: "local", metadata: { fallbackUsed: false } };
    },
  };
  const rag = {
    async retrieveContext(input: Record<string, unknown>) {
      ragInputs.push(input);
      return { available: true, contextBlock: "private approved documentation",
        citations: [{ documentId: "doc-A", documentTitle: "Electrical manual", excerpt: "Approved", score: 0.97 }] };
    },
  };
  const svc = new EvidenceReviewService(prisma as never, llm as never, undefined, undefined, rag as never);
  return { svc, ragInputs, llmContexts, membershipCalls: () => membershipCalls };
}

test("evidence-review passes only verified active reviewer org and exact milestone project to RAG", async () => {
  const f = fixture();
  const result = await f.svc.runReview({
    evidenceItemId: "evidence-1", tenantId: "tenant-A", reviewedById: "user-A",
    reviewedByOrgId: "org-A",
  });
  assert.equal(result.ragUsed, true);
  assert.equal(f.ragInputs.length, 1);
  assert.equal(f.ragInputs[0].tenantId, "tenant-A");
  assert.equal(f.ragInputs[0].projectId, "project-A");
  assert.deepEqual(f.ragInputs[0].scope, {
    orgId: "org-A", projectIds: ["project-A"], jobIds: [],
  });
  assert.ok(f.llmContexts.length > 0);
  assert.ok(f.llmContexts.every(context => context.localOnly === true),
    "private evidence and RAG excerpts must never use cloud inference");
});

test("revoked org membership denies evidence-review RAG but preserves rules fallback", async () => {
  const f = fixture({ validMembership: false });
  const result = await f.svc.runReview({
    evidenceItemId: "evidence-1", tenantId: "tenant-A", reviewedById: "user-A",
    reviewedByOrgId: "org-A",
  });
  assert.equal(result.ragUsed, false);
  assert.deepEqual(f.ragInputs, []);
});

test("unassociated actor/project denies RAG instead of falling back to tenant-wide retrieval", async () => {
  const f = fixture({ validProject: false });
  const result = await f.svc.runReview({
    evidenceItemId: "evidence-1", tenantId: "tenant-A", reviewedById: "user-A",
    reviewedByOrgId: "org-A",
  });
  assert.equal(result.ragUsed, false);
  assert.deepEqual(f.ragInputs, []);
});

test("internal caller without authenticated reviewer org never queries private RAG", async () => {
  const f = fixture();
  const result = await f.svc.runReview({
    evidenceItemId: "evidence-1", tenantId: "tenant-A", reviewedById: "service-worker",
  });
  assert.equal(result.ragUsed, false);
  assert.deepEqual(f.ragInputs, []);
  assert.equal(f.membershipCalls(), 0);
});
