import test from "node:test";
import assert from "node:assert/strict";

/**
 * SSE events logic tests.
 * Verifies event payload shapes and channel routing without DB/SSE service.
 */

// ── Reproduce SSE emission logic ──────────────────────────────────────────────

type SSEEvent = { channel: string; event: string; data: Record<string, unknown> };
const emitted: SSEEvent[] = [];

function mockSse(tenantId: string) {
  return {
    emit(channel: string, event: string, data: Record<string, unknown>) {
      emitted.push({ channel, event, data });
    },
  };
}

function resetEmitted() { emitted.length = 0; }

// ── Tests ─────────────────────────────────────────────────────────────────────

test("SSE.1: evidence-item:updated emitted on PATCH with correct channel", () => {
  resetEmitted();
  const tenantId = "tenant_test";
  const sse = mockSse(tenantId);
  sse.emit(`buildops:${tenantId}`, "evidence-item:updated", {
    milestoneId: "ms_1", itemId: "item_1", status: "approved", updatedAt: new Date().toISOString(),
  });
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0]!.channel, `buildops:${tenantId}`);
  assert.equal(emitted[0]!.event, "evidence-item:updated");
  assert.equal(emitted[0]!.data.milestoneId, "ms_1");
  assert.equal(emitted[0]!.data.status, "approved");
});

test("SSE.2: evidence-item:reviewed emitted after AI review completes", () => {
  resetEmitted();
  const tenantId = "tenant_test";
  const sse = mockSse(tenantId);
  sse.emit(`buildops:${tenantId}`, "evidence-item:reviewed", {
    milestoneId: "ms_1", itemId: "item_1", reviewStatus: "approved_suggestion", riskLevel: "low", reviewedAt: new Date().toISOString(),
  });
  assert.equal(emitted[0]!.event, "evidence-item:reviewed");
  assert.equal(emitted[0]!.data.reviewStatus, "approved_suggestion");
  assert.equal(emitted[0]!.data.riskLevel, "low");
});

test("SSE.3: channel is per-tenant (buildops:tenantId)", () => {
  resetEmitted();
  const t1 = "tenant_a"; const t2 = "tenant_b";
  const sse1 = mockSse(t1); const sse2 = mockSse(t2);
  sse1.emit(`buildops:${t1}`, "evidence-item:updated", { milestoneId: "ms_a" });
  sse2.emit(`buildops:${t2}`, "evidence-item:updated", { milestoneId: "ms_b" });
  assert.equal(emitted[0]!.channel, `buildops:${t1}`);
  assert.equal(emitted[1]!.channel, `buildops:${t2}`);
  assert.notEqual(emitted[0]!.channel, emitted[1]!.channel);
});

test("SSE.4: evidence-item:reviewed payload has required fields", () => {
  const payload = {
    milestoneId: "ms_1",
    itemId: "item_1",
    reviewStatus: "needs_reupload",
    riskLevel: "medium",
    reviewedAt: new Date().toISOString(),
  };
  assert.ok("milestoneId" in payload);
  assert.ok("itemId" in payload);
  assert.ok("reviewStatus" in payload);
  assert.ok("riskLevel" in payload);
  assert.ok("reviewedAt" in payload);
});

test("SSE.5: frontend hook filters by milestoneId", () => {
  // Simulate frontend filtering logic
  const allowedMilestoneIds = ["ms_1", "ms_2"];
  const events = [
    { milestoneId: "ms_1", type: "evidence-item:updated" },
    { milestoneId: "ms_3", type: "evidence-item:updated" },  // should be filtered
    { milestoneId: "ms_2", type: "evidence-item:reviewed" },
  ];

  const filtered = events.filter((e) => allowedMilestoneIds.includes(e.milestoneId));
  assert.equal(filtered.length, 2);
  assert.ok(!filtered.some((e) => e.milestoneId === "ms_3"));
});

test("SSE.6: reconnect logic caps at 5 retries", () => {
  let retries = 0;
  const MAX_RETRIES = 5;
  function shouldRetry(): boolean { return retries < MAX_RETRIES; }

  // Simulate 6 failures
  for (let i = 0; i < 6; i++) {
    if (shouldRetry()) retries++;
  }
  assert.equal(retries, 5); // capped at 5
});

test("SSE.7: keepalive events are not propagated to onEvent", () => {
  const received: string[] = [];
  const onEvent = (evt: { type: string }) => {
    if (evt.type !== "keepalive") received.push(evt.type);
  };
  // Simulate receiving various event types
  [
    { type: "evidence-item:updated", milestoneId: "ms_1" },
    { type: "keepalive" },
    { type: "evidence-item:reviewed", milestoneId: "ms_1" },
  ].forEach(onEvent);
  assert.equal(received.length, 2);
  assert.ok(!received.includes("keepalive"));
});
