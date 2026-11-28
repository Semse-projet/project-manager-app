import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";

import { GovernanceService } from "../dist/modules/governance/governance.service.js";
import {
  computeCreditBalance,
  voteCost,
  VOTE_SPENT_EVENT,
} from "../dist/modules/governance/governance-credits.algorithm.js";

// spec api.governance-quadratic-credits (owner decisions 2026-11-10: PD-09, D1–D3; AUDIT_REMEDIATION_PLAN 0.49b).

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

test("voteCost is k² − 1: one unit is free, intensity is paid quadratically (D1)", () => {
  assert.deepEqual([1, 2, 3, 10].map(voteCost), [0, 3, 8, 99]);
});

test("balance: earned credits decay, spent credits never decay nor come back (PD-09)", () => {
  const ledger = [
    { eventType: "proposal_created", credits: 12, createdAt: now },
    { eventType: "vote_cast", credits: 2, createdAt: daysAgo(90) }, // half-life → 1
    { eventType: VOTE_SPENT_EVENT, credits: -8, createdAt: daysAgo(365) }, // old spend still counts in full
  ];
  const balance = computeCreditBalance(ledger, now);
  assert.equal(balance.earned, 13);
  assert.equal(balance.spent, 8);
  assert.equal(balance.available, 5);
});

type Call = { method: string; args: any };

function harness(ledger: Array<{ eventType: string; credits: number; createdAt: Date }>) {
  const calls: Call[] = [];
  const committed: Call[] = [];
  const prisma: Record<string, any> = {
    governanceVote: {
      async findUnique() { return null; },
      async create({ data }: any) { calls.push({ method: "governanceVote.create", args: data }); return { id: "vote_1", ...data }; },
    },
    governanceCreditEvent: {
      async findMany(args: any) { calls.push({ method: "governanceCreditEvent.findMany", args }); return ledger; },
      async create(args: any) { calls.push({ method: "governanceCreditEvent.create", args: args.data }); return { id: "c" }; },
    },
    rating: { async findMany() { return []; } },
    jobReservation: { async findMany() { return []; } },
    user: { async findUnique() { return { verificationStatus: "verified" }; } },
  };
  prisma.$queryRaw = async () => [{ id: "p1", tenantId: "t1", status: "open", closesAt: new Date("2099-01-01") }];
  prisma.$executeRaw = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ method: "$executeRaw", args: { sql: strings.join("?"), values } });
    return 1;
  };
  // Writes inside the transaction only "commit" when the work resolves, like a real rollback.
  prisma.$transaction = async (work: (tx: unknown) => Promise<unknown>) => {
    const before = calls.length;
    const result = await work(prisma);
    committed.push(...calls.slice(before));
    return result;
  };
  return { service: new GovernanceService(prisma as never), calls, committed };
}

const vote = (units: number) => ({ proposalId: "p1", tenantId: "t1", voterId: "u1", choice: "for", units });

test("1 unit with zero credits is accepted and writes no spend (D1)", async () => {
  const { service, committed } = harness([]);
  await service.castVote(vote(1) as never);
  assert.equal(committed.some((c) => c.method === "governanceVote.create"), true);
  assert.equal(committed.some((c) => c.method === "governanceCreditEvent.create" && c.args.eventType === VOTE_SPENT_EVENT), false);
  assert.equal(committed.some((c) => c.method === "$executeRaw"), false, "no voter lock needed for a free vote");
});

test("a paid vote locks the voter, then spends −cost in the same transaction as the vote", async () => {
  const { service, committed } = harness([{ eventType: "proposal_created", credits: 12, createdAt: now }]);
  await service.castVote(vote(3) as never);
  const lockIndex = committed.findIndex((c) => c.method === "$executeRaw");
  const readIndex = committed.findIndex((c) => c.method === "governanceCreditEvent.findMany");
  assert.ok(lockIndex >= 0 && lockIndex < readIndex, "advisory lock is taken before reading the balance");
  assert.match(committed[lockIndex]!.args.sql, /pg_advisory_xact_lock/);
  assert.deepEqual(committed[lockIndex]!.args.values, ["governance-credits:t1:u1"]);
  const spend = committed.find((c) => c.method === "governanceCreditEvent.create" && c.args.eventType === VOTE_SPENT_EVENT);
  assert.equal(spend?.args.credits, -8);
  assert.equal(spend?.args.userId, "u1");
  assert.equal(spend?.args.tenantId, "t1");
  assert.equal(committed.some((c) => c.method === "governanceVote.create"), true);
});

test("insufficient balance → 409 with cost and available; neither vote nor spend is committed (D3)", async () => {
  const { service, committed } = harness([{ eventType: "proposal_created", credits: 5, createdAt: now }]);
  await assert.rejects(
    () => service.castVote(vote(3) as never),
    (err: unknown) => {
      assert.ok(err instanceof ConflictException);
      const body = (err as ConflictException).getResponse() as Record<string, unknown>;
      assert.equal(body.cost, 8);
      assert.equal(body.available, 5);
      assert.equal(body.units, 3);
      return true;
    },
  );
  assert.equal(committed.length, 0);
});

test("the voting reward is kept after a paid vote (D2)", async () => {
  const { service, calls } = harness([{ eventType: "proposal_created", credits: 12, createdAt: now }]);
  await service.castVote(vote(2) as never);
  const reward = calls.find((c) => c.method === "governanceCreditEvent.create" && c.args.eventType === "vote_cast");
  assert.ok(reward, "vote_cast reward still recorded");
});

test("getCredits: tier and totalCredits stay on earned; spent and available are reported", async () => {
  const { service } = harness([
    { eventType: "proposal_created", credits: 12, createdAt: now },
    { eventType: VOTE_SPENT_EVENT, credits: -8, createdAt: now },
  ]);
  const credits: any = await service.getCredits("t1", "u1");
  assert.equal(credits.totalCredits, 12);
  assert.equal(credits.tier, "participant");
  assert.equal(credits.spentCredits, 8);
  assert.equal(credits.availableCredits, 4);
});
