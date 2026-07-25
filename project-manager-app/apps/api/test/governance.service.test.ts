import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";

import { GovernanceService } from "../dist/modules/governance/governance.service.js";

type Call = { method: string; args: unknown };

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    id: "proposal_1",
    tenantId: "tenant_1",
    title: "Tenant-safe proposal",
    description: "Keep governance scoped to the signed tenant",
    category: "security",
    status: "open",
    authorId: "author_1",
    authorReputationScore: 50,
    mcaAdvice: null,
    mcaRisk: "low",
    closesAt: new Date("2099-01-01T00:00:00.000Z"),
    votes: [],
    ...overrides,
  };
}

function createHarness(proposalResult: ReturnType<typeof proposal> | null) {
  const calls: Call[] = [];
  const prisma = {
    governanceProposal: {
      async findFirst(args: unknown) {
        calls.push({ method: "governanceProposal.findFirst", args });
        return proposalResult;
      },
      async updateMany(args: unknown) {
        calls.push({ method: "governanceProposal.updateMany", args });
        return { count: 1 };
      },
    },
    governanceVote: {
      async findUnique(args: unknown) {
        calls.push({ method: "governanceVote.findUnique", args });
        return null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        calls.push({ method: "governanceVote.create", args: { data } });
        return { id: "vote_1", ...data };
      },
    },
    governanceCreditEvent: {
      async create(args: unknown) {
        calls.push({ method: "governanceCreditEvent.create", args });
        return { id: "credit_1" };
      },
    },
    rating: {
      async findMany() {
        return [];
      },
    },
    jobReservation: {
      async findMany() {
        return [];
      },
    },
    user: {
      async findUnique() {
        return { verificationStatus: "verified" };
      },
    },
  };

  return {
    calls,
    service: new GovernanceService(prisma as never),
  };
}

test("getProposal scopes the proposal and included votes to the caller tenant", async () => {
  const { service, calls } = createHarness(proposal());

  await service.getProposal("proposal_1", "tenant_1");

  const lookup = calls.find((call) => call.method === "governanceProposal.findFirst");
  assert.deepEqual(lookup?.args, {
    where: { id: "proposal_1", tenantId: "tenant_1" },
    include: { votes: { where: { tenantId: "tenant_1" } } },
  });
});

test("cross-tenant proposal lookup fails closed as not found", async () => {
  const { service } = createHarness(null);

  await assert.rejects(
    service.getProposal("proposal_foreign", "tenant_1"),
    NotFoundException,
  );
});

test("castVote writes the tenant from the scoped proposal, never an unrelated tenant", async () => {
  const { service, calls } = createHarness(proposal());

  await service.castVote({
    tenantId: "tenant_1",
    proposalId: "proposal_1",
    voterId: "voter_1",
    choice: "for",
    units: 1,
  });

  const proposalLookup = calls.find((call) => call.method === "governanceProposal.findFirst");
  assert.deepEqual(proposalLookup?.args, {
    where: { id: "proposal_1", tenantId: "tenant_1" },
  });

  const voteCreate = calls.find((call) => call.method === "governanceVote.create");
  assert.equal(
    (voteCreate?.args as { data?: { tenantId?: string } })?.data?.tenantId,
    "tenant_1",
  );
});

test("cross-tenant vote performs no vote write", async () => {
  const { service, calls } = createHarness(null);

  await assert.rejects(
    service.castVote({
      tenantId: "tenant_1",
      proposalId: "proposal_foreign",
      voterId: "voter_1",
      choice: "for",
      units: 1,
    }),
    NotFoundException,
  );

  assert.equal(calls.some((call) => call.method === "governanceVote.create"), false);
});

test("closeProposal conditionally updates by id, tenant and open status", async () => {
  const { service, calls } = createHarness(proposal());

  await service.closeProposal("proposal_1", "tenant_1");

  const update = calls.find((call) => call.method === "governanceProposal.updateMany");
  assert.deepEqual(
    (update?.args as { where?: unknown })?.where,
    { id: "proposal_1", tenantId: "tenant_1", status: "open" },
  );
});

test("cross-tenant close performs no status write", async () => {
  const { service, calls } = createHarness(null);

  await assert.rejects(
    service.closeProposal("proposal_foreign", "tenant_1"),
    NotFoundException,
  );

  assert.equal(calls.some((call) => call.method === "governanceProposal.updateMany"), false);
});
