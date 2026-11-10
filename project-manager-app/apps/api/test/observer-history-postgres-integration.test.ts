/**
 * O.HI5: real PostgreSQL sessions and memberships + signed HTTP observer
 * history. CI-only; no Railway resources, production DB or real Observer data.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

// Runs only in isolated CI. In CI a missing DATABASE_URL is a hard failure,
// never a silent skip, so the regression cannot quietly stop running.
const inCi = process.env.CI === "true";
const dbTest = inCi
  ? test
  : (name: string, fn: (t: any) => Promise<void>) =>
    test(name, { skip: "O.HI5 runs only in isolated CI (CI=true + local Postgres :5433)" }, fn);

dbTest("O.HI5: PostgreSQL session and membership enforce tenant-only observer HTTP history", async (t) => {
  // A DB URL is not sufficient authorization to run this against external data.
  assert.ok(process.env.DATABASE_URL, "O.HI5 requires DATABASE_URL in CI; refusing to skip silently");
  const dbUrl = new URL(process.env.DATABASE_URL);
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
    const params = Reflect.getMetadata("design:paramtypes", OpsController) as any[];
    assert.ok(Array.isArray(params) && params.length >= 5);
    const mocks = [...new Set(params.filter(Boolean))].map((token) => ({
      provide: token,
      useValue: token.name === "SystemObserverService" ? { getHistory: () => history } : {},
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
    const call = async (token?: string, forgedTenant?: string) => {
      const res = await fastify.inject({
        method: "GET", url: "/v1/ops/observer/history",
        headers: {
          ...(token ? { authorization: "Bearer " + token } : {}),
          ...(forgedTenant ? { "x-tenant-id": forgedTenant } : {}),
        },
      });
      return { status: res.statusCode, body: JSON.parse(res.body) };
    };

    // Read-only cases first; the state-mutating cases at the end are ordered
    // on purpose and each mutates a different actor's rows.
    await t.test("tenant A sees only its snapshots despite a forged tenant header", async () => {
      const a = await call(tokenOf(actors[0]), tenants[1].id);
      assert.equal(a.status, 200, JSON.stringify(a.body));
      assert.equal(a.body.data.count, 2);
      assert.deepEqual(a.body.data.snapshots.map((s: any) => s.observedAt), ["A-1", "A-2"]);
      // Payload only: the envelope requestId is a random UUID that can contain "888".
      const raw = JSON.stringify(a.body.data);
      for (const leaked of ["B-1", "B-private", "B-only", "888"]) {
        assert.ok(!raw.includes(leaked), "B metadata reached A: " + leaked);
      }
    });

    await t.test("tenant B sees only its snapshot", async () => {
      const b = await call(tokenOf(actors[1]), tenants[0].id);
      assert.equal(b.status, 200, JSON.stringify(b.body));
      assert.equal(b.body.data.count, 1);
      assert.deepEqual(b.body.data.snapshots.map((s: any) => s.observedAt), ["B-1"]);
    });

    await t.test("tenant C with no history gets an empty list", async () => {
      const c = await call(tokenOf(actors[2]), tenants[0].id);
      assert.equal(c.status, 200, JSON.stringify(c.body));
      assert.equal(c.body.data.count, 0);
      assert.deepEqual(c.body.data.snapshots, []);
    });

    await t.test("no bearer denies a caller-supplied tenant (401)", async () => {
      assert.equal((await call(undefined, tenants[0].id)).status, 401);
    });

    await t.test("WORKER cannot read ops history (403)", async () => {
      assert.equal((await call(tokenOf(actors[3]))).status, 403);
    });

    await t.test("tampered signature is rejected (401)", async () => {
      assert.equal((await call(tokenOf(actors[0]) + "tampered")).status, 401);
    });

    await t.test("token for tenant B bound to tenant A's stored session is rejected (401)", async () => {
      const crossTenant = signToken({
        userId: actors[0].userId, tenantId: tenants[1].id, orgId: actors[0].orgId,
        roles: ["OPS_ADMIN"], sid: actors[0].sid, typ: "access",
      }, secret, 120);
      assert.equal((await call(crossTenant)).status, 401);
    });

    await t.test("expired access window in PostgreSQL fails the next request (401)", async () => {
      await prisma.authSession.update({ where: { id: actors[2].sid }, data: { accessExpiresAt: new Date(Date.now() - 1_000) } });
      assert.equal((await call(tokenOf(actors[2]))).status, 401);
    });

    await t.test("revoked session in PostgreSQL fails the next request (401)", async () => {
      await prisma.authSession.update({ where: { id: actors[0].sid }, data: { status: "REVOKED", revokedAt: new Date() } });
      assert.equal((await call(tokenOf(actors[0]))).status, 401);
    });

    await t.test("suspended membership in PostgreSQL fails the next request (401)", async () => {
      await prisma.membership.update({
        where: { userId_orgId_roleId: { userId: actors[1].userId, orgId: actors[1].orgId, roleId: roles.OPS_ADMIN! } },
        data: { status: "SUSPENDED" },
      });
      assert.equal((await call(tokenOf(actors[1]))).status, 401);
    });
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
