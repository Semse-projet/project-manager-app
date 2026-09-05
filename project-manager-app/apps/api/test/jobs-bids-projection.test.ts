import test from "node:test";
import assert from "node:assert/strict";
import {
  buildJobsBidsProjection,
  isJobsBidsProjectionEnabled,
  isJobsBidsProjectionPersistenceEnabled,
  isJobsBidsProjectionReadthroughEnabled,
} from "../dist/modules/jobs/jobs-bids-projection.js";

const firstNow = new Date("2026-08-26T12:00:00.000Z");
const secondNow = new Date("2026-08-26T12:05:00.000Z");

const baseInput = {
  job: {
    id: "job_1",
    tenantId: "tenant_1",
    clientOrgId: "org_client_1",
    title: "Kitchen remodel",
    status: "ACCEPTED",
    updatedAt: new Date("2026-08-26T11:00:00.000Z"),
  },
  bids: [
    {
      id: "bid_1",
      proOrgId: "org_pro_1",
      professionalUserId: "usr_pro_1",
      amount: 4500,
      etaDays: 10,
      status: "ACCEPTED",
      updatedAt: new Date("2026-08-26T10:55:00.000Z"),
    },
    {
      id: "bid_2",
      proOrgId: "org_pro_2",
      professionalUserId: "usr_pro_2",
      amount: 5200,
      etaDays: 14,
      status: "REJECTED",
      updatedAt: new Date("2026-08-26T10:50:00.000Z"),
    },
    {
      id: "bid_3",
      proOrgId: "org_pro_3",
      professionalUserId: "usr_pro_3",
      amount: 4800,
      etaDays: 12,
      status: "SUBMITTED",
      updatedAt: new Date("2026-08-26T10:45:00.000Z"),
    },
  ],
};

test("projection summarizes bid counts and picks the accepted bid", () => {
  const projection = buildJobsBidsProjection({ ...baseInput, now: firstNow });

  assert.equal(projection.job.id, "job_1");
  assert.equal(projection.job.status, "ACCEPTED");
  assert.equal(projection.bids.total, 3);
  assert.equal(projection.bids.submitted, 1);
  assert.equal(projection.bids.accepted, 1);
  assert.equal(projection.bids.rejected, 1);
  assert.deepEqual(projection.acceptedBid, {
    id: "bid_1",
    proOrgId: "org_pro_1",
    professionalUserId: "usr_pro_1",
    amount: 4500,
    etaDays: 10,
  });
  assert.match(projection.revision, /^jobs-bids\.v1:[a-f0-9]{64}$/);
  assert.equal(projection.sourceUpdatedAt, "2026-08-26T11:00:00.000Z");
});

test("acceptedBid is null when no bid has been accepted yet", () => {
  const projection = buildJobsBidsProjection({
    job: { ...baseInput.job, status: "POSTED" },
    bids: [baseInput.bids[2]!],
    now: firstNow,
  });

  assert.equal(projection.acceptedBid, null);
  assert.equal(projection.bids.total, 1);
  assert.equal(projection.bids.submitted, 1);
});

test("revision is deterministic across generation time and bid array order, changes when bid state changes", () => {
  const first = buildJobsBidsProjection({ ...baseInput, now: firstNow });
  const second = buildJobsBidsProjection({
    ...baseInput,
    bids: [...baseInput.bids].reverse(),
    now: secondNow,
  });

  assert.equal(first.revision, second.revision);
  assert.notEqual(first.generatedAt, second.generatedAt);

  const changed = buildJobsBidsProjection({
    job: baseInput.job,
    bids: [
      ...baseInput.bids.slice(0, 2),
      { ...baseInput.bids[2]!, status: "REJECTED" },
    ],
    now: firstNow,
  });
  assert.notEqual(first.revision, changed.revision);
});

test("sourceUpdatedAt tracks the latest of job and bid updatedAt", () => {
  const projection = buildJobsBidsProjection({
    job: { ...baseInput.job, updatedAt: new Date("2026-08-26T09:00:00.000Z") },
    bids: [
      { ...baseInput.bids[0]!, updatedAt: new Date("2026-08-26T11:30:00.000Z") },
    ],
    now: firstNow,
  });

  assert.equal(projection.sourceUpdatedAt, "2026-08-26T11:30:00.000Z");
});

test("feature flags require both global enablement and tenant allowlist, independently of the persist/readthrough switches", () => {
  assert.equal(isJobsBidsProjectionEnabled("tenant_1", {}), false);
  assert.equal(
    isJobsBidsProjectionEnabled("tenant_1", {
      SEMSE_JOBS_PROJECTION_ENABLED: "true",
      SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS: "tenant_1",
    }),
    true,
  );
  assert.equal(
    isJobsBidsProjectionEnabled("tenant_2", {
      SEMSE_JOBS_PROJECTION_ENABLED: "true",
      SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS: "tenant_1",
    }),
    false,
  );
  assert.equal(
    isJobsBidsProjectionEnabled("tenant_1", {
      SEMSE_JOBS_PROJECTION_ENABLED: "true",
      SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS: "*",
    }),
    true,
  );

  assert.equal(isJobsBidsProjectionPersistenceEnabled({}), false);
  assert.equal(
    isJobsBidsProjectionPersistenceEnabled({ SEMSE_JOBS_PROJECTION_PERSIST_ENABLED: "true" }),
    true,
  );

  assert.equal(isJobsBidsProjectionReadthroughEnabled({}), false);
  assert.equal(
    isJobsBidsProjectionReadthroughEnabled({ SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED: "true" }),
    true,
  );
});
