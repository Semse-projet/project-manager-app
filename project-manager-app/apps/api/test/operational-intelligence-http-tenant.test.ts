/**
 * core.header-identity-fail-closed — AC-HI-06..09 over real HTTP.
 *
 * OperationalIntelligenceController must take the tenant from the verified
 * auth context (AuthGuard + AuthService session check), never from a
 * caller-supplied x-tenant-id header. Uses the REAL AuthGuard, AuthService
 * session validation and RbacGuard; services and session repo are mocked.
 */
import "reflect-metadata";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

import { OperationalIntelligenceController } from "../dist/modules/operational-intelligence/operational-intelligence.controller.js";

const SECRET = "synthetic-oi-tenant-test-secret-2026";

describe("operational-intelligence uses the verified tenant over HTTP", () => {
  const priorSecret = process.env.AUTH_SECRET;
  const priorEnv = process.env.NODE_ENV;
  const calls: Array<{ method: string; tenantId: unknown; id?: unknown }> = [];
  let app: any;
  let fastify: any;
  let tokenFor: (tenantId: string, roles?: string[]) => string;

  before(async () => {
    process.env.AUTH_SECRET = SECRET;
    process.env.NODE_ENV = "test";

    const [{ Module }, { APP_GUARD, NestFactory }, { FastifyAdapter },
      { AuthGuard }, { AuthService }, { RbacGuard }, { signToken }, { OperationalSignalsService },
      { IntelligenceRunsService }, { PrometeoBriefService }] = await Promise.all([
      import("@nestjs/common"),
      import("@nestjs/core"),
      import("@nestjs/platform-fastify"),
      import("../dist/common/auth.guard.js"),
      import("../dist/modules/auth/auth.service.js"),
      import("../dist/common/rbac.guard.js"),
      import("../dist/common/auth-token.js"),
      import("../dist/modules/operational-intelligence/operational-signals.service.js"),
      import("../dist/modules/operational-intelligence/intelligence-runs.service.js"),
      import("../dist/modules/operational-intelligence/prometeo-brief.service.js"),
    ]);

    const sessions = new Map<string, { tenantId: string; roles: string[] }>();
    const authRepository = {
      async findActiveSessionAuthorization(sid: string) {
        const entry = sessions.get(sid);
        if (!entry) return null;
        return {
          userStatus: "active",
          session: {
            userId: "oi-user", orgId: "oi-org", tenantId: entry.tenantId, roles: entry.roles,
            accessExpiresAt: new Date(Date.now() + 60_000),
            refreshExpiresAt: new Date(Date.now() + 3_600_000),
          },
          activeRoles: entry.roles,
        };
      },
    };
    let sidCounter = 0;
    tokenFor = (tenantId, roles = ["OPS_ADMIN"]) => {
      const sid = "oi_session_" + (++sidCounter);
      sessions.set(sid, { tenantId, roles });
      return signToken({ userId: "oi-user", tenantId, orgId: "oi-org", roles, sid, typ: "access" }, SECRET);
    };

    const record = (method: string) => async (...args: unknown[]) => {
      if (method === "list") calls.push({ method, tenantId: (args[0] as { tenantId?: unknown }).tenantId });
      else if (method === "listRecent" || method === "generateBrief") calls.push({ method, tenantId: args[0] });
      else if (method === "upsertSignal") calls.push({ method, tenantId: (args[0] as { tenantId?: unknown }).tenantId });
      else calls.push({ method, id: args[0], tenantId: args[1] });
      if (method === "upsertSignal") return { created: true };
      if (method === "generateBrief") return { summary: "ok" };
      return method === "list" || method === "listRecent" ? [] : undefined;
    };

    class OiTenantTestModule {}
    Module({
      controllers: [OperationalIntelligenceController],
      providers: [
        { provide: OperationalSignalsService, useValue: {
          list: record("list"), acknowledge: record("acknowledge"), resolve: record("resolve"),
          dismiss: record("dismiss"), upsertSignal: record("upsertSignal"),
        } },
        { provide: IntelligenceRunsService, useValue: { listRecent: record("listRecent") } },
        { provide: PrometeoBriefService, useValue: { generateBrief: record("generateBrief") } },
        { provide: AuthService, useValue: new AuthService(authRepository as never, {} as never, {} as never, {} as never) },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: RbacGuard },
      ],
    })(OiTenantTestModule);

    app = await NestFactory.create(OiTenantTestModule, new FastifyAdapter(), { logger: false });
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

  /** Tenant A's bearer plus forged identity headers pointing at tenant B. */
  const asTenantAForgingB = async (method: string, url: string, roles?: string[]) => {
    calls.length = 0;
    const res = await fastify.inject({
      method, url,
      headers: {
        authorization: "Bearer " + tokenFor("tenant-A", roles),
        "x-tenant-id": "tenant-B", "x-org-id": "org-B", "x-user-id": "intruder", "x-roles": "OPS_ADMIN",
      },
    });
    return { status: res.statusCode, raw: res.body as string };
  };

  const cases: Array<[string, string, string]> = [
    ["GET", "/v1/operational-intelligence/signals", "list"],
    ["GET", "/v1/operational-intelligence/runs", "listRecent"],
    ["GET", "/v1/operational-intelligence/brief", "generateBrief"],
    ["PATCH", "/v1/operational-intelligence/signals/sig_B/acknowledge", "acknowledge"],
    ["PATCH", "/v1/operational-intelligence/signals/sig_B/resolve", "resolve"],
    ["PATCH", "/v1/operational-intelligence/signals/sig_B/dismiss", "dismiss"],
    ["POST", "/v1/operational-intelligence/seed-test", "upsertSignal"],
  ];

  for (const [method, url, serviceMethod] of cases) {
    test(method + " " + url + " answers 200 and scopes the service to tenant A, not the forged tenant B", async () => {
      const res = await asTenantAForgingB(method, url);
      assert.equal(res.status, method === "POST" ? 201 : 200, res.raw);
      const forService = calls.filter((call) => call.method === serviceMethod);
      assert.ok(forService.length > 0, serviceMethod + " was not called");
      for (const call of forService) {
        assert.equal(call.tenantId, "tenant-A", serviceMethod + " received a tenant that is not the verified one");
      }
    });
  }

  test("a PATCH on another tenant's signal id still carries tenant A to the service", async () => {
    await asTenantAForgingB("PATCH", "/v1/operational-intelligence/signals/sig_B/resolve");
    assert.deepEqual(calls, [{ method: "resolve", id: "sig_B", tenantId: "tenant-A" }]);
  });

  test("forged headers without a bearer are rejected (401)", async () => {
    calls.length = 0;
    const res = await fastify.inject({
      method: "GET", url: "/v1/operational-intelligence/signals",
      headers: { "x-tenant-id": "tenant-B", "x-org-id": "org-B", "x-user-id": "intruder", "x-roles": "OPS_ADMIN" },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(calls.length, 0);
  });

  test("WORKER is denied ops:dashboard:read (403) and no service is called", async () => {
    const res = await asTenantAForgingB("GET", "/v1/operational-intelligence/signals", ["WORKER"]);
    assert.equal(res.status, 403);
    assert.equal(calls.length, 0);
  });

  test("seed-test stays blocked in production (403)", async () => {
    const saved = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      const res = await asTenantAForgingB("POST", "/v1/operational-intelligence/seed-test");
      assert.equal(res.status, 403);
      assert.equal(calls.length, 0);
    } finally {
      process.env.NODE_ENV = saved;
    }
  });
});
