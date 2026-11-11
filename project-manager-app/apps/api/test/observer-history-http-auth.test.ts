/**
 * PR #1083 — isolated HTTP security regression for GET /v1/ops/observer/history.
 * Run with the existing @semse/api unit runner (which first builds API to dist).
 * Uses Nest/Fastify, signed SEMSE auth tokens, the REAL AuthGuard,
 * AuthService's session validation and RbacGuard. Session repository is mocked.
 * No database, external network, production credentials, or real services.
 *
 * One behavior per test() so a failure names exactly what broke.
 */
import "reflect-metadata";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

import { OpsController } from "../dist/modules/ops/ops.controller.js";

const SECRET = "synthetic-observer-test-secret-2026";

type Session = {
  userId: string;
  tenantId: string;
  orgId: string;
  roles: string[];
  activeRoles?: string[];
  userStatus?: string;
  accessExpiresAt?: Date;
  refreshExpiresAt?: Date;
};

type Snapshot = {
  tenantId: string;
  observedAt: string;
  healthScore: number;
  alerts: Array<{ area: string }>;
  operationalHealth: { criticalSignals: number };
  intelligenceHealth: { embeddingsMode: string };
};

const snapshot = (tenantId: string, observedAt: string, overrides: Partial<Snapshot> = {}): Snapshot => ({
  tenantId,
  observedAt,
  healthScore: 90,
  alerts: [],
  operationalHealth: { criticalSignals: 0 },
  intelligenceHealth: { embeddingsMode: "fts_fallback" },
  ...overrides,
});

const history: Snapshot[] = [
  // tenant-D has more snapshots than the 10-item response window. It goes
  // first so that, if the tenant filter regressed, tenant B's snapshot would
  // still fall inside A's last-10 window and the leak test would catch it.
  ...Array.from({ length: 12 }, (_, i) =>
    snapshot("tenant-D", "D-" + (i + 1), {
      alerts: i === 11 ? [{ area: "d1" }, { area: "d2" }] : [],
    })),
  snapshot("tenant-A", "A-1"),
  snapshot("tenant-B", "B-1", {
    healthScore: 15,
    alerts: [{ area: "B-only" }],
    operationalHealth: { criticalSignals: 777 },
    intelligenceHealth: { embeddingsMode: "private-B" },
  }),
  snapshot("tenant-A", "A-2", { healthScore: 91 }),
];

describe("O.HI4: signed HTTP observer history enforces RBAC and tenant scope", () => {
  const priorSecret = process.env.AUTH_SECRET;
  const priorEnv = process.env.NODE_ENV;
  const sessions = new Map<string, Session>();
  let app: any;
  let fastify: any;
  let signToken: (claims: Record<string, unknown>, secret: string, ttlSeconds?: number) => string;

  before(async () => {
    process.env.AUTH_SECRET = SECRET;
    process.env.NODE_ENV = "test";

    const [{ Module }, { APP_GUARD, NestFactory }, { FastifyAdapter },
      { AuthGuard }, { AuthService }, { RbacGuard }, tokenModule] = await Promise.all([
      import("@nestjs/common"),
      import("@nestjs/core"),
      import("@nestjs/platform-fastify"),
      import("../dist/common/auth.guard.js"),
      import("../dist/modules/auth/auth.service.js"),
      import("../dist/common/rbac.guard.js"),
      import("../dist/common/auth-token.js"),
    ]);
    signToken = tokenModule.signToken as typeof signToken;

    const authRepository = {
      async findActiveSessionAuthorization(sid: string) {
        const entry = sessions.get(sid);
        if (!entry) return null;
        return {
          userStatus: entry.userStatus ?? "active",
          session: {
            userId: entry.userId,
            tenantId: entry.tenantId,
            orgId: entry.orgId,
            roles: entry.roles,
            accessExpiresAt: entry.accessExpiresAt ?? new Date(Date.now() + 60_000),
            refreshExpiresAt: entry.refreshExpiresAt ?? new Date(Date.now() + 3_600_000),
          },
          activeRoles: entry.activeRoles ?? entry.roles,
        };
      },
    };
    const authService = new AuthService(authRepository as never, {} as never, {} as never, {} as never);

    // Build the REAL controller with mocked dependencies so its own route
    // decorators and RequirePermissions metadata are exercised over HTTP.
    const tokens = Reflect.getMetadata("design:paramtypes", OpsController) as any[];
    assert.ok(Array.isArray(tokens) && tokens.length >= 5,
      "OpsController must retain Nest constructor metadata");
    const providerMocks = [...new Set(tokens.filter(Boolean))].map((token) => ({
      provide: token,
      useValue: token.name === "SystemObserverService" ? { getHistory: () => history } : {},
    }));
    assert.ok(providerMocks.some((entry) => entry.provide.name === "SystemObserverService"),
      "SystemObserverService must be injected with test history");

    class ObserverHistoryTestModule {}
    Module({
      controllers: [OpsController],
      providers: [
        ...providerMocks,
        { provide: AuthService, useValue: authService },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: RbacGuard },
      ],
    })(ObserverHistoryTestModule);

    app = await NestFactory.create(ObserverHistoryTestModule, new FastifyAdapter(), { logger: false });
    await app.init();
    fastify = app.getHttpAdapter().getInstance();
    await fastify.ready();
  });

  after(async () => {
    if (app) await app.close();
    if (priorSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = priorSecret;
    if (priorEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorEnv;
  });

  let sidCounter = 0;
  /** Registers a server session and returns a token bound to it. */
  const signed = (
    tenantId: string,
    roles: string[] = ["OPS_ADMIN"],
    opts: { session?: Partial<Session>; claims?: Record<string, unknown>; ttl?: number; secret?: string } = {},
  ) => {
    const sid = "session_" + tenantId + "_" + (++sidCounter);
    sessions.set(sid, { userId: "observer-user", tenantId, orgId: "observer-org", roles, ...opts.session });
    const token = signToken({ userId: "observer-user", tenantId, orgId: "observer-org", roles,
      sid, typ: "access", ...opts.claims }, opts.secret ?? SECRET, opts.ttl);
    return { token, sid };
  };

  const request = async (token?: string, spoofedTenant = "tenant-B") => {
    const res = await fastify.inject({
      method: "GET",
      url: "/v1/ops/observer/history",
      headers: {
        ...(token ? { authorization: "Bearer " + token } : {}),
        "x-tenant-id": spoofedTenant,
      },
    });
    return { status: res.statusCode, data: JSON.parse(res.body), raw: res.body as string };
  };

  // ── Tenant scope ────────────────────────────────────────────────────────

  test("tenant A sees only its own snapshots despite a forged x-tenant-id", async () => {
    const res = await request(signed("tenant-A").token, "tenant-B");
    assert.equal(res.status, 200, res.raw);
    assert.equal(res.data.data.count, 2);
    assert.deepEqual(res.data.data.snapshots.map((s: any) => s.observedAt), ["A-1", "A-2"]);
    assert.ok(res.data.data.snapshots.every((s: any) => s.ragMode === "fts_fallback"));
  });

  test("no tenant B value (alerts, signals, RAG mode) leaks into tenant A", async () => {
    const { status, data, raw } = await request(signed("tenant-A").token, "tenant-B");
    assert.equal(status, 200, raw);
    // Scan only the payload: the envelope's requestId is a random UUID that can
    // contain "777" by chance and made this check flaky (main CI, 2026-11-08).
    const payload = JSON.stringify(data.data);
    for (const leaked of ["B-1", "B-only", "private-B", "777"]) {
      assert.ok(!payload.includes(leaked), "tenant B value leaked to tenant A: " + leaked);
    }
  });

  test("tenant B sees only its own snapshot", async () => {
    const res = await request(signed("tenant-B").token, "tenant-A");
    assert.equal(res.status, 200, res.raw);
    assert.equal(res.data.data.count, 1);
    assert.deepEqual(res.data.data.snapshots.map((s: any) => s.observedAt), ["B-1"]);
    assert.equal(res.data.data.snapshots[0].alerts, 1, "alerts is a count, not the alert list");
  });

  test("tenant with no history gets an empty list, not someone else's", async () => {
    const res = await request(signed("tenant-C").token, "tenant-A");
    assert.equal(res.status, 200, res.raw);
    assert.equal(res.data.data.count, 0);
    assert.deepEqual(res.data.data.snapshots, []);
  });

  test("count is the tenant total while snapshots are capped at the last 10", async () => {
    const res = await request(signed("tenant-D").token, "tenant-A");
    assert.equal(res.status, 200, res.raw);
    assert.equal(res.data.data.count, 12);
    assert.deepEqual(res.data.data.snapshots.map((s: any) => s.observedAt),
      Array.from({ length: 10 }, (_, i) => "D-" + (i + 3)));
    assert.equal(res.data.data.snapshots.at(-1).alerts, 2);
  });

  // ── RBAC ────────────────────────────────────────────────────────────────

  test("WORKER is denied ops:dashboard:read (403)", async () => {
    assert.equal((await request(signed("tenant-A", ["WORKER"]).token)).status, 403);
  });

  test("a token claiming OPS_ADMIN is not elevated when the server session only grants WORKER", async () => {
    const { token } = signed("tenant-A", ["OPS_ADMIN"], { session: { roles: ["WORKER"], activeRoles: ["WORKER"] } });
    assert.equal((await request(token)).status, 401,
      "roles must be the intersection of token, session and active membership");
  });

  // ── Token integrity ─────────────────────────────────────────────────────

  test("an x-tenant-id header alone does not authenticate (401)", async () => {
    assert.equal((await request()).status, 401);
  });

  test("a token with a corrupted signature is rejected (401)", async () => {
    assert.equal((await request(signed("tenant-A").token + "tampered")).status, 401);
  });

  test("a payload edited to another tenant while keeping the original signature is rejected (401)", async () => {
    const { token } = signed("tenant-A");
    const dot = token.lastIndexOf(".");
    const claims = JSON.parse(Buffer.from(token.slice(0, dot), "base64url").toString("utf8"));
    claims.tenantId = "tenant-B";
    const forged = Buffer.from(JSON.stringify(claims)).toString("base64url") + token.slice(dot);
    assert.equal((await request(forged)).status, 401);
  });

  test("a token signed with a different secret is rejected (401)", async () => {
    const { token } = signed("tenant-A", ["OPS_ADMIN"], { secret: "attacker-controlled-secret" });
    assert.equal((await request(token)).status, 401);
  });

  test("an expired token is rejected even with a live server session (401)", async () => {
    const { token } = signed("tenant-A", ["OPS_ADMIN"], { ttl: -60 });
    assert.equal((await request(token)).status, 401);
  });

  test("a non-access token type (refresh) cannot be used as bearer (401)", async () => {
    const { token } = signed("tenant-A", ["OPS_ADMIN"], { claims: { typ: "refresh" } });
    assert.equal((await request(token)).status, 401);
  });

  test("a token without a session id is rejected (401)", async () => {
    const token = signToken({ userId: "observer-user", tenantId: "tenant-A", orgId: "observer-org",
      roles: ["OPS_ADMIN"], typ: "access" }, SECRET);
    assert.equal((await request(token)).status, 401);
  });

  // ── Server session binding ──────────────────────────────────────────────

  test("a signed token whose session does not exist is rejected (401)", async () => {
    const token = signToken({ userId: "observer-user", tenantId: "tenant-A", orgId: "observer-org",
      roles: ["OPS_ADMIN"], sid: "missing-session", typ: "access" }, SECRET);
    assert.equal((await request(token)).status, 401);
  });

  test("a token for tenant B bound to a tenant A session is rejected (401)", async () => {
    const { sid } = signed("tenant-A");
    const token = signToken({ userId: "observer-user", tenantId: "tenant-B", orgId: "observer-org",
      roles: ["OPS_ADMIN"], sid, typ: "access" }, SECRET);
    assert.equal((await request(token)).status, 401);
  });

  test("an expired server access window is rejected even if the token is not expired (401)", async () => {
    const { token } = signed("tenant-A", ["OPS_ADMIN"], { session: { accessExpiresAt: new Date(Date.now() - 1_000) } });
    assert.equal((await request(token)).status, 401);
  });

  test("an expired server refresh window is rejected (401)", async () => {
    const { token } = signed("tenant-A", ["OPS_ADMIN"], { session: { refreshExpiresAt: new Date(Date.now() - 1_000) } });
    assert.equal((await request(token)).status, 401);
  });

  test("an inactive user is rejected (401)", async () => {
    const { token } = signed("tenant-A", ["OPS_ADMIN"], { session: { userStatus: "suspended" } });
    assert.equal((await request(token)).status, 401);
  });

  test("replaying a valid token after its session is revoked is rejected (401)", async () => {
    const { token, sid } = signed("tenant-A");
    assert.equal((await request(token)).status, 200, "token must work while the session is active");
    sessions.delete(sid);
    assert.equal((await request(token)).status, 401, "same token must fail once the session is gone");
  });

  // ── Configuration ───────────────────────────────────────────────────────

  test("production without AUTH_SECRET fails closed (503), never trusting headers", async () => {
    const savedSecret = process.env.AUTH_SECRET;
    const savedEnv = process.env.NODE_ENV;
    try {
      delete process.env.AUTH_SECRET;
      process.env.NODE_ENV = "production";
      assert.equal((await request()).status, 503, "header-only request");
      assert.equal((await request(signed("tenant-A").token)).status, 503, "bearer request");
    } finally {
      process.env.AUTH_SECRET = savedSecret;
      process.env.NODE_ENV = savedEnv;
    }
  });
});
