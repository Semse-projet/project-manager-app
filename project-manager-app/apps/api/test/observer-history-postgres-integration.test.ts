/**
 * O.HI5: real PostgreSQL sessions and memberships + signed HTTP observer
 * history. CI-only; no Railway resources, production DB or real Observer data.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { TenantObservationHistory } from "../dist/modules/ops/observer.service.js";

const dbTest = process.env.DATABASE_URL ? test : test.skip;

dbTest("O.HI5: PostgreSQL session and membership enforce tenant-only observer HTTP history", async () => {
  // A DB URL is not sufficient authorization to run this against external data.
  assert.equal(process.env.CI, "true", "O.HI5 is restricted to isolated CI");
  const dbUrl = new URL(process.env.DATABASE_URL!);
  assert.equal(dbUrl.hostname, "127.0.0.1");
  assert.equal(dbUrl.port, "5433");
  assert.equal(dbUrl.pathname, "/semse");

  const previousSecret = process.env.AUTH_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;
  const secret = "observer-ohi5-ci-only-signing-secret";
  process.env.AUTH_SECRET = secret;
  process.env.NODE_ENV = "test";

  const suffix = randomUUID().replaceAll("-", "").slice(0, 14);
  const id = (part: string) => "ohi5_" + part + "_" + suffix;
  const tenants = ["a", "b", "c"].map((n) => ({ id: id("tenant_" + n), slug: id("slug_" + n) }));
  const actors = [
    { name: "A", tenantId: tenants[0].id, orgId: id("org_a"), userId: id("user_a"), sid: id("sid_a"), role: "OPS_ADMIN" },
    { name: "B", tenantId: tenants[1].id, orgId: id("org_b"), userId: id("user_b"), sid: id("sid_b"), role: "OPS_ADMIN" },
    { name: "C", tenantId: tenants[2].id, orgId: id("org_c"), userId: id("user_c"), sid: id("sid_c"), role: "OPS_ADMIN" },
    { name: "WORKER", tenantId: tenants[0].id, orgId: id("org_a"), userId: id("user_worker"), sid: id("sid_worker"), role: "WORKER" },
  ];
  const prisma = new PrismaClient();
  let app: any;

  try {
    const [{ Module }, { APP_GUARD, NestFactory }, { FastifyAdapter },
      { AuthGuard }, { RbacGuard }, { AuthService }, { AuthRepository },
      { OpsController }, { signToken }] = await Promise.all([
        import("@nestjs/common"),
        import("@nestjs/core"),
        import("@nestjs/platform-fastify"),
        import("../dist/common/auth.guard.js"),
        import("../dist/common/rbac.guard.js"),
        import("../dist/modules/auth/auth.service.js"),
        import("../dist/modules/auth/auth.repository.js"),
        import("../dist/modules/ops/ops.controller.js"),
        import("../dist/common/auth-token.js"),
      ]);

    // Persist temporary sessions/memberships in the real CI PostgreSQL.
    for (const tenant of tenants) {
      await prisma.tenant.create({ data: { id: tenant.id, slug: tenant.slug, name: "O.HI5 synthetic" } });
    }
    for (const [name, tenantId] of [["a", tenants[0].id], ["b", tenants[1].id], ["c", tenants[2].id]] as const) {
      await prisma.org.create({ data: { id: id("org_" + name), tenantId, type: "test", name: "O.HI5 org " + name } });
    }
    const roles: Record<string, string> = {};
    for (const name of ["OPS_ADMIN", "WORKER"]) {
      const role = await prisma.role.upsert({ where: { key: name }, create: { key: name, name }, update: {} });
      roles[name] = role.id;
    }
    for (const actor of actors) {
      await prisma.user.create({ data: { id: actor.userId, email: actor.userId + "@example.invalid", status: "active" } });
      await prisma.membership.create({ data: { userId: actor.userId, orgId: actor.orgId, roleId: roles[actor.role]!, status: "ACTIVE" } });
      await prisma.authSession.create({ data: {
        id: actor.sid, userId: actor.userId, orgId: actor.orgId, tenantId: actor.tenantId,
        roles: [actor.role], refreshTokenHash: id("refresh_" + actor.name),
        accessExpiresAt: new Date(Date.now() + 120_000),
        refreshExpiresAt: new Date(Date.now() + 3_600_000), status: "ACTIVE",
      } });
    }

    const history = [
      { tenantId: tenants[0].id, observedAt: "A-1", healthScore: 91, alerts: [],
        operationalHealth: { criticalSignals: 1 }, intelligenceHealth: { embeddingsMode: "A-private" } },
      { tenantId: tenants[1].id, observedAt: "B-1", healthScore: 12, alerts: [{ area: "B-only" }],
        operationalHealth: { criticalSignals: 888 }, intelligenceHealth: { embeddingsMode: "B-private" } },
      { tenantId: tenants[0].id, observedAt: "A-2", healthScore: 92, alerts: [],
        operationalHealth: { criticalSignals: 2 }, intelligenceHealth: { embeddingsMode: "A-private" } },
    ];
    // Real tenant-local retention coupled to real PostgreSQL-backed AuthRepository.
    const store = new TenantObservationHistory<(typeof history)[number]>();
    for (const snapshot of history) assert.equal(store.append(snapshot), true);
    const params = Reflect.getMetadata("design:paramtypes", OpsController) as any[];
    assert.ok(Array.isArray(params) && params.length >= 5);
    const mocks = [...new Set(params.filter(Boolean))].map((token) => ({
      provide: token,
      useValue: token.name === "SystemObserverService"
        ? {
            getHistory: (tenantId: string) => store.getHistory(tenantId),
            getLatest: (tenantId: string) => store.getLatest(tenantId),
            observe: async (tenantId: string) => ({
              ...history[0]!, tenantId, observedAt: tenantId + "-fresh",
            }),
          }
        : {},
    }));
    assert.ok(mocks.some((x) => x.provide.name === "SystemObserverService"));

    const authService = new AuthService(new AuthRepository(prisma as never), {} as never, {} as never, {} as never);
    class ObserverPostgresTestModule {}
    Module({ controllers: [OpsController], providers: [
      ...mocks,
      { provide: AuthService, useValue: authService },
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_GUARD, useClass: RbacGuard },
    ] })(ObserverPostgresTestModule);
    app = await NestFactory.create(ObserverPostgresTestModule, new FastifyAdapter(), { logger: false });
    await app.init();
    const fastify = app.getHttpAdapter().getInstance();
    await fastify.ready();

    const tokenOf = (actor: typeof actors[number]) => signToken({
      userId: actor.userId, tenantId: actor.tenantId, orgId: actor.orgId,
      roles: [actor.role], sid: actor.sid, typ: "access",
    }, secret, 120);
    const call = async (token?: string, forgedTenant?: string, endpoint = "history") => {
      const res = await fastify.inject({
        method: "GET", url: "/v1/ops/observer/" + endpoint,
        headers: {
          ...(token ? { authorization: "Bearer " + token } : {}),
          ...(forgedTenant ? { "x-tenant-id": forgedTenant } : {}),
        },
      });
      return { status: res.statusCode, body: JSON.parse(res.body) };
    };

    const a = await call(tokenOf(actors[0]), tenants[1].id);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(a.body.data.count, 2);
    assert.deepEqual(a.body.data.snapshots.map((s: any) => s.observedAt), ["A-1", "A-2"]);
    assert.ok(!JSON.stringify(a.body).includes("B-private"), "B metadata cannot reach A");

    const b = await call(tokenOf(actors[1]), tenants[0].id);
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.equal(b.body.data.count, 1);
    assert.deepEqual(b.body.data.snapshots.map((s: any) => s.observedAt), ["B-1"]);

    const c = await call(tokenOf(actors[2]), tenants[0].id);
    assert.equal(c.status, 200, JSON.stringify(c.body));
    assert.equal(c.body.data.count, 0);
    assert.deepEqual(c.body.data.snapshots, []);

    const latestA = await call(tokenOf(actors[0]), tenants[1].id, "latest");
    assert.equal(latestA.status, 200, JSON.stringify(latestA.body));
    assert.equal(latestA.body.data.observedAt, "A-2");
    assert.equal(latestA.body.data.tenantId, tenants[0].id);
    assert.equal(latestA.body.data.fromCache, true);

    const latestB = await call(tokenOf(actors[1]), tenants[0].id, "latest");
    assert.equal(latestB.status, 200, JSON.stringify(latestB.body));
    assert.equal(latestB.body.data.observedAt, "B-1");
    assert.equal(latestB.body.data.fromCache, true);

    const latestC = await call(tokenOf(actors[2]), tenants[0].id, "latest");
    assert.equal(latestC.status, 200, JSON.stringify(latestC.body));
    assert.equal(latestC.body.data.tenantId, tenants[2].id);
    assert.equal(latestC.body.data.fromCache, false);

    assert.equal((await call(undefined, tenants[0].id, "latest")).status, 401,
      "latest must reject an unauthenticated tenant header");
    assert.equal((await call(tokenOf(actors[3]), tenants[0].id, "latest")).status, 403,
      "latest must enforce ops:dashboard:read");
    assert.equal((await call()).status, 401, "No bearer must deny caller-supplied tenant");
    assert.equal((await call(tokenOf(actors[3]))).status, 403, "WORKER cannot read ops history");
    assert.equal((await call(tokenOf(actors[0]) + "tampered")).status, 401);

    await prisma.authSession.update({ where: { id: actors[0].sid }, data: { status: "REVOKED", revokedAt: new Date() } });
    assert.equal((await call(tokenOf(actors[0]))).status, 401, "Revoked session must fail next request");

    await prisma.membership.update({
      where: { userId_orgId_roleId: { userId: actors[1].userId, orgId: actors[1].orgId, roleId: roles.OPS_ADMIN! } },
      data: { status: "SUSPENDED" },
    });
    assert.equal((await call(tokenOf(actors[1]))).status, 401, "Suspended membership must fail next request");
  } finally {
    if (app) await app.close();
    try {
      await prisma.authSession.deleteMany({ where: { id: { in: actors.map((a) => a.sid) } } });
      await prisma.membership.deleteMany({ where: { userId: { in: actors.map((a) => a.userId) } } });
      await prisma.user.deleteMany({ where: { id: { in: actors.map((a) => a.userId) } } });
      await prisma.org.deleteMany({ where: { id: { in: [...new Set(actors.map((a) => a.orgId))] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: tenants.map((t) => t.id) } } });
    } finally {
      await prisma.$disconnect();
      if (previousSecret === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = previousSecret;
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  }
});
