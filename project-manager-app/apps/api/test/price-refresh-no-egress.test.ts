import test from "node:test";
import assert from "node:assert/strict";
import "reflect-metadata";
import {
  isExternalPriceRefreshEnabled,
  PriceRefreshJob,
} from "../dist/modules/pricing/price-refresh.job.js";

test("automatic BLS refresh stays enabled by default and requires explicit false to stop", () => {
  assert.equal(isExternalPriceRefreshEnabled({}), true);
  assert.equal(isExternalPriceRefreshEnabled({ SEMSE_PRICE_REFRESH_EXTERNAL_ENABLED: "true" }), true);
  assert.equal(isExternalPriceRefreshEnabled({ SEMSE_PRICE_REFRESH_EXTERNAL_ENABLED: "false" }), false);
  assert.equal(isExternalPriceRefreshEnabled({ SEMSE_PRICE_REFRESH_EXTERNAL_ENABLED: "FALSE" }), true);
});

test("no-egress opt-out performs no startup price fetch and schedules no background update", async () => {
  const previous = process.env.SEMSE_PRICE_REFRESH_EXTERNAL_ENABLED;
  let lookedUpStatus = 0;
  let fetchedPrices = 0;
  try {
    process.env.SEMSE_PRICE_REFRESH_EXTERNAL_ENABLED = "false";
    const job = new PriceRefreshJob({
      async getPricingStatus() { lookedUpStatus++; return { stale: true }; },
      async refreshPrices() { fetchedPrices++; return { updated: 1, failed: 0 }; },
    } as never);
    job.onModuleInit();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(lookedUpStatus, 0, "no background status request may start");
    assert.equal(fetchedPrices, 0, "no BLS HTTP refresh may start");
    job.onModuleDestroy();
  } finally {
    if (previous === undefined) delete process.env.SEMSE_PRICE_REFRESH_EXTERNAL_ENABLED;
    else process.env.SEMSE_PRICE_REFRESH_EXTERNAL_ENABLED = previous;
  }
});
