import test from "node:test";
import assert from "node:assert/strict";
import { ContractorRateService } from "../dist/modules/pricing/contractor-rate.service.js";

function createService() {
  let writes = 0;
  const prisma = {
    contractorRateOverride: {
      async upsert() {
        writes += 1;
        return {
          userId: "worker-1",
          laborRatePerHr: 85,
          materialMarkup: 0.2,
          notes: null,
          updatedAt: new Date("2026-07-25T00:00:00.000Z"),
        };
      },
    },
  };
  return {
    service: new ContractorRateService(prisma as never),
    getWrites: () => writes,
  };
}

for (const laborRatePerHr of [-1, 9.99, 250.01, Number.NaN, Number.POSITIVE_INFINITY]) {
  void test(`contractor rate rejects out-of-policy rate ${String(laborRatePerHr)}`, async () => {
    const { service, getWrites } = createService();
    await assert.rejects(
      service.upsertOverride("worker-1", { laborRatePerHr, materialMarkup: 0.2 }),
      /laborRatePerHr must be between 10 and 250 USD/,
    );
    assert.equal(getWrites(), 0);
  });
}

for (const materialMarkup of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
  void test(`contractor rate rejects out-of-policy markup ${String(materialMarkup)}`, async () => {
    const { service, getWrites } = createService();
    await assert.rejects(
      service.upsertOverride("worker-1", { laborRatePerHr: 85, materialMarkup }),
      /materialMarkup must be between 0 and 1/,
    );
    assert.equal(getWrites(), 0);
  });
}

void test("contractor rate accepts a bounded USD override for the dedicated pricing flow", async () => {
  const { service, getWrites } = createService();
  const result = await service.upsertOverride("worker-1", {
    laborRatePerHr: 85,
    materialMarkup: 0.2,
  });

  assert.equal(getWrites(), 1);
  assert.equal(result.laborRatePerHr, 85);
});
