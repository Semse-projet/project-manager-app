import test from "node:test";
import assert from "node:assert/strict";

import { SemseAgentsService } from "../dist/modules/semse-agents/semse-agents.service.js";
import { MarketplaceAgent } from "../dist/modules/semse-agents/marketplace.agent.js";

test("job.matched notifies contractors and writes a best-effort job.matched.v1 outbox event", async () => {
  const outboxRows: Array<Record<string, unknown>> = [];
  const outboxRepository = {
    async create(_tx: unknown, event: unknown) {
      outboxRows.push(event as Record<string, unknown>);
    },
  };
  const prisma = {
    job: {
      findFirst: async () => ({ clientOrgId: "org_client_1" }),
    },
  };
  let notified: Record<string, unknown> | null = null;
  const notifications = {
    async handleEvent(input: Record<string, unknown>) {
      notified = input;
    },
  };
  const matching = {
    async matchJob() {
      return { candidates: [{ userId: "usr_pro_1" }, { userId: "usr_pro_2" }] };
    },
  };

  const bus = new SemseAgentsService();
  const agent = new MarketplaceAgent(
    bus as never,
    prisma as never,
    matching as never,
    notifications as never,
    outboxRepository as never,
  );

  await agent.handleMessage({
    from: "test",
    to: "marketplace",
    event: "PROJECT_PUBLISHED",
    payload: { jobId: "job_1", tenantId: "tenant_1", title: "Kitchen remodel", location: "Austin, TX" },
    projectId: "job_1",
  } as never);
  // notifyMatchedContractors runs fire-and-forget from handleMessage — flush
  // the microtask queue so its async work (matching, notify, outbox) settles.
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal((notified as unknown as { eventType: string })?.eventType, "job.matched");
  assert.equal(outboxRows.length, 1);
  assert.equal(outboxRows[0]?.eventType, "job.matched.v1");
  assert.equal(outboxRows[0]?.tenantId, "tenant_1");
  assert.equal(outboxRows[0]?.orgId, "org_client_1");
  assert.deepEqual((outboxRows[0]?.payload as { matchedUserIds: string[] }).matchedUserIds, [
    "usr_pro_1",
    "usr_pro_2",
  ]);
});

test("job.matched: outbox write failure never breaks the notification flow (best-effort)", async () => {
  const notifications = {
    handleEvent: async () => undefined,
  };
  const outboxRepository = {
    create: async () => {
      throw new Error("simulated outbox failure");
    },
  };
  const prisma = {
    job: { findFirst: async () => ({ clientOrgId: "org_client_1" }) },
  };
  const matching = {
    matchJob: async () => ({ candidates: [{ userId: "usr_pro_1" }] }),
  };

  const bus = new SemseAgentsService();
  const agent = new MarketplaceAgent(
    bus as never,
    prisma as never,
    matching as never,
    notifications as never,
    outboxRepository as never,
  );

  await assert.doesNotReject(() =>
    agent.handleMessage({
      from: "test",
      to: "marketplace",
      event: "PROJECT_PUBLISHED",
      payload: { jobId: "job_1", tenantId: "tenant_1" },
      projectId: "job_1",
    } as never),
  );
});
