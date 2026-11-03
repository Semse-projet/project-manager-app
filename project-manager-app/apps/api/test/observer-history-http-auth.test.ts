/**
 * PR #1083 — isolated HTTP security regression for GET /v1/ops/observer/history.
 * Copy to project-manager-app/apps/api/test/observer-history-http-auth.test.ts.
 * Run with the existing @semse/api unit runner (which first builds API to dist).
 * Uses Nest/Fastify, signed SEMSE auth tokens, the REAL AuthGuard,
 * AuthService's session validation and RbacGuard. Session repository is mocked.
 * No database, external network, production credentials, or real services.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";

import { OpsController } from "../dist/modules/ops/ops.controller.js";

test("O.HI4: signed HTTP observer history enforces RBAC and tenant scope", async () => {
  const priorSecret = process.env.AUTH_SECRET;
  const priorEnv = process.env.NODE_ENV;
  const secret = "synthetic-observer-test-secret-2026";
  process.env.AUTH_SECRET = secret;
  process.env.NODE_ENV = "test";
  let app: any;

  try {
    const [{ Module }, { APP_GUARD, NestFactory }, { FastifyAdapter },
      { AuthGuard }, { AuthService }, { RbacGuard }, { signToken }] = await Promise.all([
      import("@nestjs/common"),
      import("@nestjs/core"),
      import("@nestjs/platform-fastify"),
      import("../dist/common/auth.guard.js"),
      import("../dist/modules/auth/auth.service.js"),
      import("../dist/common/rbac.guard.js"),
      import("../dist/common/auth-token.js"),
    ]);

    const history = [
      { tenantId: "tenant-A", observedAt: "A-1", healthScore: 90, alerts: [],
        operationalHealth: { criticalSignals: 0 }, intelligenceHealth: { embeddingsMode: "fts_fallback" } },
      { tenantId: "tenant-B", observedAt: "B-1", healthScore: 15, alerts: [{ area: "B-only" }],
        operationalHealth: { criticalSignals: 777 }, intelligenceHealth: { embeddingsMode: "private-B" } },
      { tenantId: "tenant-A", observedAt: "A-2", healthScore: 91, alerts: [],
        operationalHealth: { criticalSignals: 0 }, intelligenceHealth: { embeddingsMode: "fts_fallback" } },
    ];

    type Session = { userId: string; tenantId: string; orgId: string; roles: string[] };
    const sessions = new Map<string, Session>();
    const authRepository = {
      async findActiveSessionAuthorization(sid: string) {
        const entry = sessions.get(sid);
        if (!entry) return null;
        return {
          userStatus: "active",
          session: {
            ...entry,
            accessExpiresAt: new Date(Date.now() + 60_000),
            refreshExpiresAt: new Date(Date.now() + 3_600_000),
          },
          activeRoles: entry.roles,
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
    const fastify = app.getHttpAdapter().getInstance();
    await fastify.ready();

    const signed = (tenantId: string, roles: string[] = ["OPS_ADMIN"]) => {
      const sid = "session_" + tenantId + "_" + roles.join("_");
      sessions.set(sid, { userId: "observer-user", tenantId, orgId: "observer-org", roles });
      return signToken({ userId: "observer-user", tenantId, orgId: "observer-org", roles,
        sid, typ: "access" }, secret);
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
      return { status: res.statusCode, data: JSON.parse(res.body) };
    };

    const tenantA = await request(signed("tenant-A"), "tenant-B");
    assert.equal(tenantA.status, 200, JSON.stringify(tenantA.data));
    assert.equal(tenantA.data.data.count, 2);
    assert.deepEqual(tenantA.data.data.snapshots.map((s: any) => s.observedAt), ["A-1", "A-2"]);
    assert.ok(tenantA.data.data.snapshots.every((s: any) => s.ragMode === "fts_fallback"));

    const tenantB = await request(signed("tenant-B"), "tenant-A");
    assert.equal(tenantB.status, 200, JSON.stringify(tenantB.data));
    assert.equal(tenantB.data.data.count, 1);
    assert.deepEqual(tenantB.data.data.snapshots.map((s: any) => s.observedAt), ["B-1"]);

    const tenantC = await request(signed("tenant-C"), "tenant-A");
    assert.equal(tenantC.status, 200, JSON.stringify(tenantC.data));
    assert.equal(tenantC.data.data.count, 0);
    assert.deepEqual(tenantC.data.data.snapshots, []);

    assert.equal((await request(signed("tenant-A", ["WORKER"]))).status, 403,
      "WORKER must not access ops:dashboard:read");
    assert.equal((await request()).status, 401,
      "An x-tenant-id header alone must not authenticate a user");
    assert.equal((await request(signed("tenant-A") + "tampered")).status, 401,
      "Tampered bearer token must be rejected");
    const revokedSession = signToken({ userId: "observer-user", tenantId: "tenant-A",
      orgId: "observer-org", roles: ["OPS_ADMIN"], sid: "revoked-session", typ: "access" }, secret);
    assert.equal((await request(revokedSession)).status, 401,
      "Real AuthService must reject signed tokens without an active server session");
  } finally {
    if (app) await app.close();
    if (priorSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = priorSecret;
    if (priorEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorEnv;
  }
});