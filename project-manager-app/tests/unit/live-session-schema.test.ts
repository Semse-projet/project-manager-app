import test from "node:test";
import assert from "node:assert/strict";
import {
  liveSessionStatusSchema,
  liveSessionCreateSchema,
  liveSessionTransitionSchema,
  liveSessionParticipantRoleSchema,
  liveSessionEventSchema,
  liveSessionRecordViewSchema,
  liveSessionMediaTokenViewSchema,
  canTransitionLiveSession,
  liveSessionTransitionTarget,
  isLiveSessionTerminal,
  LIVE_SESSION_TERMINAL_STATUSES,
  LIVE_SESSION_MEDIA_STATUSES,
  type LiveSessionStatus,
} from "@semse/schemas";

const ALL_STATUSES = liveSessionStatusSchema.options as readonly LiveSessionStatus[];

// FSM source of truth — must match docs/foundation/STATE_MACHINES.md §LiveSession
const VALID: Record<LiveSessionStatus, readonly LiveSessionStatus[]> = {
  REQUESTED: ["PERMISSION_PENDING", "CANCELLED"],
  PERMISSION_PENDING: ["CONNECTING", "CANCELLED"],
  CONNECTING: ["ACTIVE", "FAILED", "CANCELLED"],
  ACTIVE: ["PAUSED", "ENDING"],
  PAUSED: ["ACTIVE", "ENDING"],
  ENDING: ["ENDED", "FAILED"],
  ENDED: [],
  CANCELLED: [],
  FAILED: [],
};

test("canTransitionLiveSession accepts exactly the STATE_MACHINES edges", () => {
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      const expected = VALID[from].includes(to);
      assert.equal(
        canTransitionLiveSession(from, to),
        expected,
        `${from} -> ${to} should be ${expected}`,
      );
    }
  }
});

test("terminal statuses have no outgoing transitions", () => {
  for (const s of LIVE_SESSION_TERMINAL_STATUSES) {
    assert.ok(isLiveSessionTerminal(s));
    for (const to of ALL_STATUSES) {
      assert.equal(canTransitionLiveSession(s, to), false, `${s} is terminal`);
    }
  }
  assert.deepEqual([...LIVE_SESSION_TERMINAL_STATUSES].sort(), [
    "CANCELLED",
    "ENDED",
    "FAILED",
  ]);
});

test("liveSessionTransitionTarget maps user actions to the right target", () => {
  assert.equal(liveSessionTransitionTarget("REQUESTED", "accept"), "PERMISSION_PENDING");
  assert.equal(liveSessionTransitionTarget("ACTIVE", "pause"), "PAUSED");
  assert.equal(liveSessionTransitionTarget("PAUSED", "resume"), "ACTIVE");
  assert.equal(liveSessionTransitionTarget("ACTIVE", "end"), "ENDING");
  assert.equal(liveSessionTransitionTarget("PAUSED", "end"), "ENDING");
  for (const s of ["REQUESTED", "PERMISSION_PENDING", "CONNECTING"] as const) {
    assert.equal(liveSessionTransitionTarget(s, "cancel"), "CANCELLED");
  }
});

test("liveSessionTransitionTarget returns undefined for actions that don't apply", () => {
  assert.equal(liveSessionTransitionTarget("REQUESTED", "pause"), undefined);
  assert.equal(liveSessionTransitionTarget("ACTIVE", "accept"), undefined);
  assert.equal(liveSessionTransitionTarget("ACTIVE", "cancel"), undefined); // cancel only pre-ACTIVE
  assert.equal(liveSessionTransitionTarget("ENDED", "end"), undefined);
  assert.equal(liveSessionTransitionTarget("CANCELLED", "resume"), undefined);
});

test("every user-action target is also a valid FSM edge", () => {
  const actions = liveSessionTransitionSchema.shape.action.options;
  for (const from of ALL_STATUSES) {
    for (const action of actions) {
      const to = liveSessionTransitionTarget(from, action);
      if (to !== undefined) {
        assert.ok(
          canTransitionLiveSession(from, to),
          `${from} --${action}--> ${to} must be a valid edge`,
        );
      }
    }
  }
});

test("media-token statuses are the non-terminal connected ones", () => {
  assert.deepEqual([...LIVE_SESSION_MEDIA_STATUSES], ["CONNECTING", "ACTIVE", "PAUSED"]);
  for (const s of LIVE_SESSION_MEDIA_STATUSES) {
    assert.equal(isLiveSessionTerminal(s), false);
  }
});

test("liveSessionCreateSchema validates and rejects", () => {
  const ok = liveSessionCreateSchema.parse({
    scopeType: "job",
    scopeId: "job_123",
    purpose: "inspection",
    idempotencyKey: "k-1",
  });
  assert.equal(ok.purpose, "inspection");

  assert.throws(() =>
    liveSessionCreateSchema.parse({
      scopeType: "job",
      scopeId: "",
      purpose: "inspection",
      idempotencyKey: "k-1",
    }),
  );
  assert.throws(() =>
    liveSessionCreateSchema.parse({
      scopeType: "team",
      scopeId: "x",
      purpose: "inspection",
      idempotencyKey: "k-1",
    }),
  );
  assert.throws(() =>
    liveSessionCreateSchema.parse({
      scopeType: "job",
      scopeId: "x",
      purpose: "inspection",
      idempotencyKey: "x".repeat(201),
    }),
  );
});

test("liveSessionTransitionSchema requires a non-negative integer expectedVersion", () => {
  assert.equal(
    liveSessionTransitionSchema.parse({ action: "end", expectedVersion: 0 }).expectedVersion,
    0,
  );
  assert.throws(() => liveSessionTransitionSchema.parse({ action: "end", expectedVersion: -1 }));
  assert.throws(() => liveSessionTransitionSchema.parse({ action: "end", expectedVersion: 1.5 }));
  assert.throws(() => liveSessionTransitionSchema.parse({ action: "nope", expectedVersion: 0 }));
  assert.throws(() =>
    liveSessionTransitionSchema.parse({ action: "end", expectedVersion: 0, reason: "x".repeat(501) }),
  );
});

test("liveSessionParticipantRoleSchema enumerates owner/inspector/assistant/observer", () => {
  assert.deepEqual(
    [...liveSessionParticipantRoleSchema.options].sort(),
    ["assistant", "inspector", "observer", "owner"],
  );
});

test("liveSessionEventSchema pins version, aggregateType and payload shape", () => {
  const base = {
    eventId: "e1",
    eventType: "live_session.status_changed.v1" as const,
    version: 1 as const,
    tenantId: "t1",
    aggregateType: "LiveSession" as const,
    aggregateId: "ls1",
    actorType: "user" as const,
    actorId: "u1",
    correlationId: "req-1",
    occurredAt: "2026-09-08T00:00:00.000Z",
    payload: {
      sessionId: "ls1",
      scopeType: "job" as const,
      scopeId: "job_1",
      previousStatus: "CONNECTING" as const,
      status: "ACTIVE" as const,
      sessionVersion: 2,
    },
  };
  assert.equal(liveSessionEventSchema.parse(base).payload.status, "ACTIVE");
  assert.throws(() => liveSessionEventSchema.parse({ ...base, version: 2 }));
  assert.throws(() => liveSessionEventSchema.parse({ ...base, aggregateType: "Job" }));
  assert.throws(() => liveSessionEventSchema.parse({ ...base, eventType: "live_session.made_up.v1" }));
});

test("liveSessionRecordView accepts nullable expiresAt/endedAt", () => {
  const v = liveSessionRecordViewSchema.parse({
    id: "ls1",
    tenantId: "t1",
    scopeType: "project",
    scopeId: "p1",
    purpose: "assist",
    status: "REQUESTED",
    version: 0,
    createdById: "u1",
    expiresAt: null,
    endedAt: null,
    createdAt: "2026-09-08T00:00:00.000Z",
  });
  assert.equal(v.status, "REQUESTED");
});

test("liveSessionMediaTokenView requires a URL and non-empty token", () => {
  assert.throws(() =>
    liveSessionMediaTokenViewSchema.parse({
      token: "",
      url: "https://livekit.example/room",
      room: "r1",
      expiresAt: "2026-09-08T00:00:00.000Z",
    }),
  );
  assert.throws(() =>
    liveSessionMediaTokenViewSchema.parse({
      token: "tkn",
      url: "not-a-url",
      room: "r1",
      expiresAt: "2026-09-08T00:00:00.000Z",
    }),
  );
});
