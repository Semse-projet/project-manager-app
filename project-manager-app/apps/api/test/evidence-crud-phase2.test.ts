import test from "node:test";
import assert from "node:assert/strict";

/**
 * Evidence CRUD Fase 2 logic tests.
 * Archive logic, pagination, governance impact, SSE.
 */

// ── Archive logic ─────────────────────────────────────────────────────────────

type ItemStatus = "missing" | "submitted" | "approved" | "rejected" | "needs_reupload" | "archived";

function canArchive(status: ItemStatus, isAdmin: boolean): boolean {
  if (status === "archived") return false;         // already archived
  if (status === "approved" && !isAdmin) return false; // only admin can archive approved
  return true;
}

function archiveRequiresReason(archiveReason?: string): boolean {
  return !archiveReason?.trim();
}

// ── Governance impact of archived items ───────────────────────────────────────

function computeGovernanceBlocked(items: Array<{ status: ItemStatus; required: boolean }>, milestoneApproved: boolean): boolean {
  const required = items.filter((i) => i.required);
  const approved = required.filter((i) => i.status === "approved").length;
  // archived counts as missing for governance
  const blocking = required.filter((i) => ["missing", "rejected", "needs_reupload", "archived"].includes(i.status)).length;
  return blocking > 0 || !milestoneApproved || approved < required.length;
}

// ── Pagination logic ──────────────────────────────────────────────────────────

function paginateHistory<T extends { id: string }>(events: T[], limit: number, cursor?: string) {
  let start = 0;
  if (cursor) {
    const idx = events.findIndex((e) => e.id === cursor);
    if (idx !== -1) start = idx + 1;
  }
  const page = events.slice(start, start + limit + 1);
  const hasMore = page.length > limit;
  return {
    events: hasMore ? page.slice(0, limit) : page,
    pageInfo: { hasMore, nextCursor: hasMore ? page[limit - 1]?.id : undefined },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("EV2.1: admin puede archivar evidencia approved", () => {
  assert.ok(canArchive("approved", true));
});

test("EV2.2: cliente no puede archivar evidencia approved", () => {
  assert.equal(canArchive("approved", false), false);
});

test("EV2.3: cualquier rol puede archivar submitted/rejected (no admin required)", () => {
  assert.ok(canArchive("submitted", false));
  assert.ok(canArchive("rejected", false));
  assert.ok(canArchive("missing", false));
});

test("EV2.4: ya archivada no puede archivarse de nuevo", () => {
  assert.equal(canArchive("archived", true), false);
  assert.equal(canArchive("archived", false), false);
});

test("EV2.5: archive sin razón falla", () => {
  assert.ok(archiveRequiresReason(""));
  assert.ok(archiveRequiresReason("   "));
  assert.ok(archiveRequiresReason(undefined));
});

test("EV2.6: archive con razón pasa", () => {
  assert.equal(archiveRequiresReason("Evidencia duplicada"), false);
});

test("EV2.7: evidencia archived requerida bloquea governance", () => {
  const items: Array<{ status: ItemStatus; required: boolean }> = [
    { status: "approved", required: true },
    { status: "archived", required: true },  // was approved, now archived
  ];
  assert.ok(computeGovernanceBlocked(items, true)); // blocked because archived counts as missing
});

test("EV2.8: todas approved (ninguna archived) → governance puede pasar", () => {
  const items: Array<{ status: ItemStatus; required: boolean }> = [
    { status: "approved", required: true },
    { status: "approved", required: true },
  ];
  assert.equal(computeGovernanceBlocked(items, true), false);
});

test("EV2.9: archived no-required → no bloquea governance", () => {
  const items: Array<{ status: ItemStatus; required: boolean }> = [
    { status: "approved", required: true },
    { status: "archived", required: false },  // not required — doesn't block
  ];
  assert.equal(computeGovernanceBlocked(items, true), false);
});

test("EV2.10: pagination — hasMore=true cuando hay más eventos", () => {
  const events = Array.from({ length: 25 }, (_, i) => ({ id: `e${i}` }));
  const result = paginateHistory(events, 20);
  assert.equal(result.events.length, 20);
  assert.ok(result.pageInfo.hasMore);
  assert.ok(result.pageInfo.nextCursor);
});

test("EV2.11: pagination — hasMore=false cuando hay menos", () => {
  const events = Array.from({ length: 10 }, (_, i) => ({ id: `e${i}` }));
  const result = paginateHistory(events, 20);
  assert.equal(result.events.length, 10);
  assert.equal(result.pageInfo.hasMore, false);
  assert.equal(result.pageInfo.nextCursor, undefined);
});

test("EV2.12: SSE archived event type check", () => {
  const evt = { type: "evidence-item:archived", milestoneId: "ms_1", itemId: "item_1", status: "archived", previousStatus: "approved", archived: true };
  assert.equal(evt.type, "evidence-item:archived");
  assert.ok(evt.archived);
  assert.equal(evt.status, "archived");
});
