import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { GovernanceController } from "../dist/modules/governance/governance.controller.js";

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { "x-request-id": "req_gov_1" },
    authContext: {
      tenantId: "tenant_1",
      orgId: "org_1",
      userId: "usr_admin_1",
      roles: ["OPS_ADMIN"],
    },
    ...overrides,
  };
}

const STUB_PROPOSAL = {
  id: "prop_1",
  tenantId: "tenant_1",
  title: "Reduce contractor payout delay",
  description: "Move from T+5 to T+2 settlement",
  category: "financial",
  status: "open",
  authorId: "usr_admin_1",
  closesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

// ── Permission declarations ───────────────────────────────────────────────────

test("governance controller declares correct @RequirePermissions", () => {
  const expectations: Array<[string, string]> = [
    ["createProposal", "ops:dashboard:read"],
    ["listProposals",  "ops:dashboard:read"],
    ["getProposal",    "ops:dashboard:read"],
    ["getResults",     "ops:dashboard:read"],
    ["castVote",       "ops:dashboard:read"],
    ["closeProposal",  "ops:dashboard:read"],
    ["getCredits",     "ops:dashboard:read"],
  ];

  for (const [method, permission] of expectations) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, GovernanceController.prototype[method]);
    assert.deepEqual(meta, [permission], `${method} should require ${permission}`);
  }
});

// ── createProposal ────────────────────────────────────────────────────────────

test("governance controller: createProposal validates required fields", async () => {
  const calls: unknown[] = [];
  const controller = new GovernanceController({
    async createProposal(opts: unknown) { calls.push(opts); return STUB_PROPOSAL; },
    async listProposals() { return []; },
    async getProposal() { return STUB_PROPOSAL; },
    async getResults() { return {}; },
    async castVote() { return {}; },
    async closeProposal() { return STUB_PROPOSAL; },
    async getCredits() { return {}; },
  } as never);

  const validBody = {
    title: "New fee policy",
    description: "Lower platform fee for repeat contractors",
    closesAt: "2026-12-31T23:59:59Z",
    category: "financial",
  };
  const result = await controller.createProposal(makeReq() as never, validBody);
  assert.equal(result.data.id, "prop_1");
  assert.equal(calls.length, 1);
});

test("governance controller: createProposal rejects missing title", async () => {
  const controller = new GovernanceController({
    async createProposal() { return STUB_PROPOSAL; },
    async listProposals() { return []; },
    async getProposal() { return STUB_PROPOSAL; },
    async getResults() { return {}; },
    async castVote() { return {}; },
    async closeProposal() { return STUB_PROPOSAL; },
    async getCredits() { return {}; },
  } as never);

  await assert.rejects(
    () => controller.createProposal(makeReq() as never, {
      description: "desc",
      closesAt: "2026-12-31T23:59:59Z",
    }),
    BadRequestException
  );
});

test("governance controller: createProposal rejects invalid closesAt date", async () => {
  const controller = new GovernanceController({
    async createProposal() { return STUB_PROPOSAL; },
    async listProposals() { return []; },
    async getProposal() { return STUB_PROPOSAL; },
    async getResults() { return {}; },
    async castVote() { return {}; },
    async closeProposal() { return STUB_PROPOSAL; },
    async getCredits() { return {}; },
  } as never);

  await assert.rejects(
    () => controller.createProposal(makeReq() as never, {
      title: "Test",
      description: "Test desc",
      closesAt: "not-a-date",
    }),
    BadRequestException
  );
});

test("governance controller: createProposal falls back to ctx.tenantId when not in body", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new GovernanceController({
    async createProposal(opts: Record<string, unknown>) { calls.push(opts); return STUB_PROPOSAL; },
    async listProposals() { return []; },
    async getProposal() { return STUB_PROPOSAL; },
    async getResults() { return {}; },
    async castVote() { return {}; },
    async closeProposal() { return STUB_PROPOSAL; },
    async getCredits() { return {}; },
  } as never);

  await controller.createProposal(makeReq() as never, {
    title: "Fallback test",
    description: "desc",
    closesAt: "2026-12-31T23:59:59Z",
  });

  assert.equal(calls[0]?.tenantId, "tenant_1", "should use ctx.tenantId as fallback");
  assert.equal(calls[0]?.authorId, "usr_admin_1", "should use ctx.userId as fallback");
});

// ── listProposals ─────────────────────────────────────────────────────────────

test("governance controller: listProposals passes tenantId and status", async () => {
  const calls: unknown[] = [];
  const controller = new GovernanceController({
    async createProposal() { return STUB_PROPOSAL; },
    async listProposals(...args: unknown[]) { calls.push(args); return [STUB_PROPOSAL]; },
    async getProposal() { return STUB_PROPOSAL; },
    async getResults() { return {}; },
    async castVote() { return {}; },
    async closeProposal() { return STUB_PROPOSAL; },
    async getCredits() { return {}; },
  } as never);

  const result = await controller.listProposals(makeReq() as never, "tenant_1", "open");
  assert.equal(result.data.length, 1);
  assert.deepEqual(calls[0], ["tenant_1", "open"]);
});

// ── getProposal ───────────────────────────────────────────────────────────────

test("governance controller: getProposal routes id to service", async () => {
  const calls: string[] = [];
  const controller = new GovernanceController({
    async createProposal() { return STUB_PROPOSAL; },
    async listProposals() { return []; },
    async getProposal(id: string) { calls.push(id); return { ...STUB_PROPOSAL, id }; },
    async getResults() { return {}; },
    async castVote() { return {}; },
    async closeProposal() { return STUB_PROPOSAL; },
    async getCredits() { return {}; },
  } as never);

  const result = await controller.getProposal(makeReq() as never, "prop_abc");
  assert.equal(result.data.id, "prop_abc");
  assert.equal(calls[0], "prop_abc");
});

// ── castVote ──────────────────────────────────────────────────────────────────

test("governance controller: castVote requires choice field", async () => {
  const controller = new GovernanceController({
    async createProposal() { return STUB_PROPOSAL; },
    async listProposals() { return []; },
    async getProposal() { return STUB_PROPOSAL; },
    async getResults() { return {}; },
    async castVote() { return {}; },
    async closeProposal() { return STUB_PROPOSAL; },
    async getCredits() { return {}; },
  } as never);

  await assert.rejects(
    () => controller.castVote(makeReq() as never, "prop_1", { units: 1 }),
    BadRequestException
  );
});

test("governance controller: castVote routes to service with correct params", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new GovernanceController({
    async createProposal() { return STUB_PROPOSAL; },
    async listProposals() { return []; },
    async getProposal() { return STUB_PROPOSAL; },
    async getResults() { return {}; },
    async castVote(opts: Record<string, unknown>) { calls.push(opts); return { id: "vote_1", choice: opts.choice }; },
    async closeProposal() { return STUB_PROPOSAL; },
    async getCredits() { return {}; },
  } as never);

  const result = await controller.castVote(makeReq() as never, "prop_1", { choice: "yes", units: 2 });
  assert.equal(result.data.choice, "yes");
  assert.equal(calls[0]?.proposalId, "prop_1");
  assert.equal(calls[0]?.units, 2);
  assert.equal(calls[0]?.tenantId, "tenant_1");
});

// ── getCredits ────────────────────────────────────────────────────────────────

test("governance controller: getCredits returns credit summary for userId", async () => {
  const calls: unknown[] = [];
  const controller = new GovernanceController({
    async createProposal() { return STUB_PROPOSAL; },
    async listProposals() { return []; },
    async getProposal() { return STUB_PROPOSAL; },
    async getResults() { return {}; },
    async castVote() { return {}; },
    async closeProposal() { return STUB_PROPOSAL; },
    async getCredits(...args: unknown[]) {
      calls.push(args);
      return { userId: "usr_1", credits: 150, tier: "silver" };
    },
  } as never);

  const result = await controller.getCredits(makeReq() as never, "usr_1", "tenant_1");
  assert.equal(result.data.credits, 150);
  assert.deepEqual(calls[0], ["tenant_1", "usr_1"]);
});

// ── closeProposal ─────────────────────────────────────────────────────────────

test("governance controller: closeProposal routes id and returns updated proposal", async () => {
  const calls: string[] = [];
  const controller = new GovernanceController({
    async createProposal() { return STUB_PROPOSAL; },
    async listProposals() { return []; },
    async getProposal() { return STUB_PROPOSAL; },
    async getResults() { return {}; },
    async castVote() { return {}; },
    async closeProposal(id: string) { calls.push(id); return { ...STUB_PROPOSAL, id, status: "closed" }; },
    async getCredits() { return {}; },
  } as never);

  const result = await controller.closeProposal(makeReq() as never, "prop_1");
  assert.equal(result.data.status, "closed");
  assert.equal(calls[0], "prop_1");
});
