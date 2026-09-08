import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { LiveSessionsService } from "../dist/modules/live-sessions/live-sessions.service.js";
import type {
  LiveSessionRow,
  LiveSessionParticipantRow,
  LiveSessionsRepository,
  CreateLiveSessionInput,
  AddParticipantInput,
} from "../dist/modules/live-sessions/live-sessions.repository.js";
import type {
  LiveSessionResourceAccess,
  ResourceActor,
} from "../dist/modules/live-sessions/live-sessions.resource-access.js";

// ── In-memory doubles ────────────────────────────────────────────────────────

class FakeRepo implements LiveSessionsRepository {
  sessions = new Map<string, LiveSessionRow>();
  participants: LiveSessionParticipantRow[] = [];

  async findByIdempotency(tenantId: string, key: string) {
    return [...this.sessions.values()].find((s) => s.tenantId === tenantId && s.idempotencyKey === key) ?? null;
  }
  async create(input: CreateLiveSessionInput): Promise<LiveSessionRow> {
    const row: LiveSessionRow = {
      id: `ls_${randomUUID()}`,
      tenantId: input.tenantId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      purpose: input.purpose,
      status: "REQUESTED",
      version: 0,
      createdById: input.createdById,
      idempotencyKey: input.idempotencyKey,
      expiresAt: input.expiresAt,
      endedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(row.id, row);
    this.participants.push({
      id: `p_${randomUUID()}`, tenantId: input.tenantId, sessionId: row.id,
      userId: input.ownerUserId, role: "owner", invitedById: input.createdById,
      joinedAt: null, leftAt: null, createdAt: new Date(),
    });
    return row;
  }
  async findById(tenantId: string, sessionId: string) {
    const s = this.sessions.get(sessionId);
    return s && s.tenantId === tenantId ? { ...s } : null;
  }
  async listParticipants(sessionId: string) {
    return this.participants.filter((p) => p.sessionId === sessionId).map((p) => ({ ...p }));
  }
  async findParticipant(sessionId: string, userId: string) {
    return this.participants.find((p) => p.sessionId === sessionId && p.userId === userId) ?? null;
  }
  async addParticipant(input: AddParticipantInput): Promise<LiveSessionParticipantRow> {
    const p: LiveSessionParticipantRow = {
      id: `p_${randomUUID()}`, tenantId: input.tenantId, sessionId: input.sessionId,
      userId: input.userId, role: input.role, invitedById: input.invitedById,
      joinedAt: null, leftAt: null, createdAt: new Date(),
    };
    this.participants.push(p);
    return p;
  }
  async transition(input: { tenantId: string; sessionId: string; expectedVersion: number; toStatus: LiveSessionRow["status"]; endedAt: Date | null }) {
    const s = this.sessions.get(input.sessionId);
    if (!s || s.tenantId !== input.tenantId || s.version !== input.expectedVersion) return null;
    s.status = input.toStatus;
    s.version += 1;
    if (input.endedAt) s.endedAt = input.endedAt;
    return { ...s };
  }
  async listExpired(now: Date, limit: number) {
    return [...this.sessions.values()]
      .filter((s) => s.expiresAt && s.expiresAt <= now && !["ENDED", "CANCELLED", "FAILED"].includes(s.status))
      .slice(0, limit)
      .map((s) => ({ ...s }));
  }
}

class AllowAllAccess implements LiveSessionResourceAccess {
  async canOpenSession(_a: ResourceActor) { return true; }
}
class DenyAllAccess implements LiveSessionResourceAccess {
  async canOpenSession(_a: ResourceActor) { return false; }
}

const auditStub = { append: async () => {} } as any;
const sseStub = { emit: () => {} } as any;

function svc(repo: LiveSessionsRepository, access: LiveSessionResourceAccess) {
  return new LiveSessionsService(repo, access, auditStub, sseStub);
}

const CLIENT = { userId: "u_client", tenantId: "t1", orgId: "o1", roles: ["CLIENT"] };
const PRO = { userId: "u_pro", tenantId: "t1", orgId: "o2", roles: ["PRO"] };
const OTHER_TENANT = { userId: "u_x", tenantId: "t2", orgId: "oX", roles: ["CLIENT"] };
const createBody = { scopeType: "job", scopeId: "job_1", purpose: "inspection", idempotencyKey: "k1" };

// ── create ──────────────────────────────────────────────────────────────────

test("create: seeds the creator as owner and returns REQUESTED v0", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const view = await s.create(CLIENT, "req1", createBody);
  assert.equal(view.status, "REQUESTED");
  assert.equal(view.version, 0);
  const parts = await repo.listParticipants(view.id);
  assert.deepEqual(parts.map((p) => [p.userId, p.role]), [["u_client", "owner"]]);
});

test("create: no resource access -> 404 (NotFoundException), no session written", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new DenyAllAccess());
  await assert.rejects(() => s.create(CLIENT, "req", createBody), /not found/i);
  assert.equal(repo.sessions.size, 0);
});

test("create: same idempotencyKey + same attrs -> returns existing", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const a = await s.create(CLIENT, "r", createBody);
  const b = await s.create(CLIENT, "r", createBody);
  assert.equal(a.id, b.id);
  assert.equal(repo.sessions.size, 1);
});

test("create: same idempotencyKey + different scope -> 409", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  await s.create(CLIENT, "r", createBody);
  await assert.rejects(
    () => s.create(CLIENT, "r", { ...createBody, scopeId: "job_2" }),
    /idempotency key is bound to another/i,
  );
});

// ── get / isolation (spec §13.1) ────────────────────────────────────────────

test("get: a participant sees the session", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const created = await s.create(CLIENT, "r", createBody);
  const got = await s.get(CLIENT, created.id);
  assert.equal(got.id, created.id);
});

test("get: same tenant, NOT a participant -> 404", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const created = await s.create(CLIENT, "r", createBody);
  await assert.rejects(() => s.get(PRO, created.id), /not found/i);
});

test("get: other tenant -> 404 (identical)", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const created = await s.create(CLIENT, "r", createBody);
  await assert.rejects(() => s.get(OTHER_TENANT, created.id), /not found/i);
});

// ── transition + FSM + concurrency ─────────────────────────────────────────

async function toActive(repo: FakeRepo, s: LiveSessionsService) {
  const created = await s.create(CLIENT, "r", createBody);
  // add the PRO as a participant so they can accept
  await s.addParticipant(CLIENT, "r", created.id, { userId: "u_pro", role: "inspector", expectedVersion: 0 });
  await s.transition(PRO, "r", created.id, { action: "accept", expectedVersion: 0 }); // -> PERMISSION_PENDING v1
  await s.markReady(PRO, "r", created.id, 1); // -> CONNECTING v2
  await s.driveFromWebhook("t1", created.id, "ACTIVE", "wh"); // -> ACTIVE v3
  return created.id;
}

test("transition: creator cannot 'accept' their own session", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const created = await s.create(CLIENT, "r", createBody);
  await assert.rejects(
    () => s.transition(CLIENT, "r", created.id, { action: "accept", expectedVersion: 0 }),
    /creator cannot accept/i,
  );
});

test("transition: illegal action from state -> 409", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const created = await s.create(CLIENT, "r", createBody);
  await assert.rejects(
    () => s.transition(CLIENT, "r", created.id, { action: "pause", expectedVersion: 0 }),
    /Cannot pause LiveSession from REQUESTED/i,
  );
});

test("transition: stale expectedVersion -> 409", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const id = await toActive(repo, s); // now at v3
  await assert.rejects(
    () => s.transition(CLIENT, "r", id, { action: "pause", expectedVersion: 0 }),
    /version conflict/i,
  );
});

test("transition: full happy path REQUESTED -> ... -> ENDED", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const id = await toActive(repo, s);
  const paused = await s.transition(CLIENT, "r", id, { action: "pause", expectedVersion: 3 });
  assert.equal(paused.status, "PAUSED");
  const ending = await s.transition(CLIENT, "r", id, { action: "end", expectedVersion: 4 });
  assert.equal(ending.status, "ENDING");
  await s.driveFromWebhook("t1", id, "ENDED", "wh");
  const final = await s.get(CLIENT, id);
  assert.equal(final.status, "ENDED");
  assert.ok(final.endedAt);
});

test("transition: 'cancel' only by the owner", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const created = await s.create(CLIENT, "r", createBody);
  await s.addParticipant(CLIENT, "r", created.id, { userId: "u_pro", role: "inspector", expectedVersion: 0 });
  await assert.rejects(
    () => s.transition(PRO, "r", created.id, { action: "cancel", expectedVersion: 0 }),
    /only the session owner can cancel/i,
  );
  const cancelled = await s.transition(CLIENT, "r", created.id, { action: "cancel", expectedVersion: 0 });
  assert.equal(cancelled.status, "CANCELLED");
});

// ── media-token gate (spec §13.3) ─────────────────────────────────────────

test("assertCanIssueMediaToken: rejects while REQUESTED, allows while ACTIVE", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const created = await s.create(CLIENT, "r", createBody);
  await assert.rejects(() => s.assertCanIssueMediaToken(CLIENT, created.id), /media is not available/i);
  const id = await toActive(repo, s);
  const row = await s.assertCanIssueMediaToken(CLIENT, id);
  assert.equal(row.status, "ACTIVE");
});

test("assertCanIssueMediaToken: rejects a non-participant with 404", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const id = await toActive(repo, s);
  await assert.rejects(() => s.assertCanIssueMediaToken(OTHER_TENANT, id), /not found/i);
});

test("assertCanIssueMediaToken: rejects an expired session with 409", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const id = await toActive(repo, s);
  repo.sessions.get(id)!.expiresAt = new Date(Date.now() - 1000);
  await assert.rejects(() => s.assertCanIssueMediaToken(CLIENT, id), /expired/i);
});

// ── webhook driver ────────────────────────────────────────────────────────

test("driveFromWebhook: ignores an invalid edge", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const created = await s.create(CLIENT, "r", createBody); // REQUESTED
  await s.driveFromWebhook("t1", created.id, "ENDED", "wh"); // REQUESTED->ENDED not valid
  const got = await s.get(CLIENT, created.id);
  assert.equal(got.status, "REQUESTED");
});

// ── expiry sweep (spec §13.4) ────────────────────────────────────────────

test("sweepExpired: non-terminal expired session -> CANCELLED, ACTIVE -> ... stays if not expired", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const a = await s.create(CLIENT, "r", { ...createBody, idempotencyKey: "ka" });
  repo.sessions.get(a.id)!.expiresAt = new Date(Date.now() - 1000);
  const b = await s.create(CLIENT, "r", { ...createBody, idempotencyKey: "kb" }); // not expired
  const closed = await s.sweepExpired();
  assert.equal(closed, 1);
  assert.equal(repo.sessions.get(a.id)!.status, "CANCELLED");
  assert.equal(repo.sessions.get(b.id)!.status, "REQUESTED");
});

test("sweepExpired: expired CONNECTING -> FAILED", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const created = await s.create(CLIENT, "r", createBody);
  await s.addParticipant(CLIENT, "r", created.id, { userId: "u_pro", role: "inspector", expectedVersion: 0 });
  await s.transition(PRO, "r", created.id, { action: "accept", expectedVersion: 0 });
  await s.markReady(PRO, "r", created.id, 1); // CONNECTING
  repo.sessions.get(created.id)!.expiresAt = new Date(Date.now() - 1000);
  await s.sweepExpired();
  assert.equal(repo.sessions.get(created.id)!.status, "FAILED");
});

// ── add participant ──────────────────────────────────────────────────────

test("addParticipant: only the owner; target must have resource access", async () => {
  const repo = new FakeRepo();
  const s = svc(repo, new AllowAllAccess());
  const created = await s.create(CLIENT, "r", createBody);
  // non-owner cannot
  await s.addParticipant(CLIENT, "r", created.id, { userId: "u_pro", role: "inspector", expectedVersion: 0 });
  await assert.rejects(
    () => s.addParticipant(PRO, "r", created.id, { userId: "u_z", role: "observer", expectedVersion: 0 }),
    /only the session owner/i,
  );
});

test("addParticipant: denied resource access for the target -> 400", async () => {
  const repo = new FakeRepo();
  // owner can open (AllowAll for create), but the target check uses DenyAll
  const access = {
    calls: 0,
    async canOpenSession() { this.calls++; return this.calls === 1; },
  } as any;
  const s = svc(repo, access);
  const created = await s.create(CLIENT, "r", createBody);
  await assert.rejects(
    () => s.addParticipant(CLIENT, "r", created.id, { userId: "u_pro", role: "inspector", expectedVersion: 0 }),
    /no access to the session's resource/i,
  );
});
