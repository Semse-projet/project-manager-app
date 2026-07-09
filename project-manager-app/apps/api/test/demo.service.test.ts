import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { DemoService } from "../dist/modules/demo/demo.service.js";

// ── Stubs ─────────────────────────────────────────────────────────────────────

function makePrismaStub(options: { existingFarmAgeMs?: number } = {}) {
  const calls: Record<string, number> = {};
  const track = (name: string) => {
    calls[name] = (calls[name] ?? 0) + 1;
  };

  const existingFarm =
    options.existingFarmAgeMs === undefined
      ? null
      : {
          id: "farm_demo_existing",
          ownerId: "usr_demo",
          name: "Finca Demostración SEMSE",
          createdAt: new Date(Date.now() - options.existingFarmAgeMs),
        };

  return {
    _calls: calls,
    tenant: {
      upsert: async () => {
        track("tenant.upsert");
        return { id: "ten_demo", slug: "semse-demo" };
      },
    },
    org: {
      findFirst: async () => {
        track("org.findFirst");
        return { id: "org_demo", tenantId: "ten_demo", type: "demo" };
      },
      create: async () => {
        track("org.create");
        return { id: "org_demo", tenantId: "ten_demo", type: "demo" };
      },
    },
    user: {
      upsert: async () => {
        track("user.upsert");
        return { id: "usr_demo", email: "demo-agro@semse.internal" };
      },
    },
    agroFarm: {
      findFirst: async () => {
        track("agroFarm.findFirst");
        return existingFarm;
      },
      delete: async () => {
        track("agroFarm.delete");
        return existingFarm;
      },
      create: async (input: any) => {
        track("agroFarm.create");
        return { id: "farm_demo_new", createdAt: new Date(), ...input.data };
      },
    },
    agroFarmUnit: {
      create: async (input: any) => {
        track("agroFarmUnit.create");
        return { id: `unit_${calls["agroFarmUnit.create"]}`, ...input.data };
      },
    },
    agroAnimal: { createMany: async () => track("agroAnimal.createMany") },
    agroInventoryItem: {
      create: async (input: any) => {
        track("agroInventoryItem.create");
        return { id: `item_${calls["agroInventoryItem.create"]}`, ...input.data };
      },
    },
    agroInventoryMovement: { create: async () => track("agroInventoryMovement.create") },
    agroFarmTask: { createMany: async () => track("agroFarmTask.createMany") },
    agroCostEntry: { createMany: async () => track("agroCostEntry.createMany") },
  } as any;
}

function makeAuthStub() {
  const issued: any[] = [];
  return {
    _issued: issued,
    issueSession: async (input: any) => {
      issued.push(input);
      return {
        token: "demo-token",
        accessToken: "demo-token",
        refreshToken: "demo-refresh",
        sessionId: "sess_demo",
        accessExpiresAt: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
        refreshExpiresAt: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
      };
    },
  } as any;
}

function withDemoEnabled<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.DEMO_MODE_ENABLED;
  process.env.DEMO_MODE_ENABLED = "true";
  return fn().finally(() => {
    if (prev === undefined) delete process.env.DEMO_MODE_ENABLED;
    else process.env.DEMO_MODE_ENABLED = prev;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("demo session is 404 when DEMO_MODE_ENABLED is off", async () => {
  delete process.env.DEMO_MODE_ENABLED;
  const service = new DemoService(makePrismaStub(), makeAuthStub());
  await assert.rejects(
    () => service.createDemoSession({ vertical: "agro", requestId: "req_1" }),
    NotFoundException,
  );
});

test("demo session rejects unsupported verticals", async () => {
  await withDemoEnabled(async () => {
    const service = new DemoService(makePrismaStub(), makeAuthStub());
    await assert.rejects(
      () => service.createDemoSession({ vertical: "buildops", requestId: "req_1" }),
      NotFoundException,
    );
  });
});

test("demo session seeds a farm and issues a 30-minute DEMO_AGRO session", async () => {
  await withDemoEnabled(async () => {
    const prisma = makePrismaStub(); // sin granja previa
    const auth = makeAuthStub();
    const service = new DemoService(prisma, auth);

    const session = await service.createDemoSession({ vertical: "agro", requestId: "req_1" });

    assert.equal(session.demo, true);
    assert.equal(session.vertical, "agro");
    assert.equal(session.farmId, "farm_demo_new");
    assert.equal(session.userId, "usr_demo");
    assert.equal(session.tenantId, "ten_demo");
    assert.equal(session.orgId, "org_demo");
    assert.deepEqual(session.roles, ["DEMO_AGRO"]);
    assert.equal(session.expiresInSeconds, 1800);

    assert.equal(auth._issued.length, 1);
    assert.deepEqual(auth._issued[0].roles, ["DEMO_AGRO"]);
    assert.equal(auth._issued[0].ttlSeconds, 1800);

    // Seed completo: granja, unidades, animales, inventario, tareas y costos
    assert.equal(prisma._calls["agroFarm.create"], 1);
    assert.equal(prisma._calls["agroFarmUnit.create"], 3);
    assert.equal(prisma._calls["agroAnimal.createMany"], 1);
    assert.equal(prisma._calls["agroInventoryItem.create"], 3);
    assert.equal(prisma._calls["agroInventoryMovement.create"], 3);
    assert.equal(prisma._calls["agroFarmTask.createMany"], 1);
    assert.equal(prisma._calls["agroCostEntry.createMany"], 1);
  });
});

test("fresh demo farm is reused without reset", async () => {
  await withDemoEnabled(async () => {
    const prisma = makePrismaStub({ existingFarmAgeMs: 60 * 60 * 1000 }); // 1h
    const service = new DemoService(prisma, makeAuthStub());

    const session = await service.createDemoSession({ vertical: "agro", requestId: "req_1" });

    assert.equal(session.farmId, "farm_demo_existing");
    assert.equal(prisma._calls["agroFarm.delete"], undefined);
    assert.equal(prisma._calls["agroFarm.create"], undefined);
  });
});

test("stale demo farm (>6h) is deleted and re-seeded", async () => {
  await withDemoEnabled(async () => {
    const prisma = makePrismaStub({ existingFarmAgeMs: 7 * 60 * 60 * 1000 }); // 7h
    const service = new DemoService(prisma, makeAuthStub());

    const session = await service.createDemoSession({ vertical: "agro", requestId: "req_1" });

    assert.equal(prisma._calls["agroFarm.delete"], 1);
    assert.equal(prisma._calls["agroFarm.create"], 1);
    assert.equal(session.farmId, "farm_demo_new");
  });
});
