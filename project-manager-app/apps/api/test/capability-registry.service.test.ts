import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { CapabilityRegistryService } from "../dist/modules/capability-registry/capability-registry.service.js";

const STUB_CAPABILITY = {
  id: "cap_conduit_offset_engine",
  key: "conduit-offset-engine",
  domain: "Electrical/Field",
  description: "Deterministic conduit-offset geometry engine.",
  maturity: "TESTED",
  health: "HEALTHY",
  ownerModule: "packages/tools/src/trades/electrical",
  createdAt: new Date(),
  updatedAt: new Date(),
  evidence: [
    {
      id: "ev_conduit_offset_test",
      capabilityId: "cap_conduit_offset_engine",
      kind: "TEST",
      reference: "packages/tools/test/conduit-offset.test.ts",
      note: null,
      recordedAt: new Date(),
    },
  ],
};

const STUB_GOLDEN_REGRESSION = {
  id: "gr_conduit_offset_6in_30deg",
  key: "conduit-offset-6in-30deg",
  description: "6in offset at a 30-degree bend must yield 12in spacing.",
  expectedResult: "spacingIn = 12",
  testReference: "packages/tools/test/conduit-offset.test.ts",
  status: "PASSING",
  lastCheckedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makePrismaStub(overrides: { capabilities?: any[]; goldenRegressions?: any[] } = {}) {
  const capabilities = overrides.capabilities ?? [STUB_CAPABILITY];
  const goldenRegressions = overrides.goldenRegressions ?? [STUB_GOLDEN_REGRESSION];

  return {
    capability: {
      findMany: async () => capabilities,
      findUnique: async ({ where }: { where: { key: string } }) =>
        capabilities.find((c) => c.key === where.key) ?? null,
    },
    goldenRegression: {
      findMany: async () => goldenRegressions,
    },
  } as any;
}

test("list() returns all capabilities with evidence", async () => {
  const service = new CapabilityRegistryService(makePrismaStub());
  const result = await service.list();
  assert.equal(result.length, 1);
  assert.equal(result[0].key, "conduit-offset-engine");
  assert.equal(result[0].evidence.length, 1);
});

test("getByKey() returns the matching capability", async () => {
  const service = new CapabilityRegistryService(makePrismaStub());
  const result = await service.getByKey("conduit-offset-engine");
  assert.equal(result.id, "cap_conduit_offset_engine");
});

test("getByKey() throws NotFoundException for an unknown key", async () => {
  const service = new CapabilityRegistryService(makePrismaStub());
  await assert.rejects(() => service.getByKey("does-not-exist"), NotFoundException);
});

test("listGoldenRegressions() returns registered golden regressions", async () => {
  const service = new CapabilityRegistryService(makePrismaStub());
  const result = await service.listGoldenRegressions();
  assert.equal(result.length, 1);
  assert.equal(result[0].key, "conduit-offset-6in-30deg");
  assert.equal(result[0].status, "PASSING");
});
