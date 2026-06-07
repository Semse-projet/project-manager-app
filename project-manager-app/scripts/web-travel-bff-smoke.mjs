import assert from "node:assert/strict";

const config = {
  webBaseUrl: process.env.SEMSE_WEB_URL ?? "http://127.0.0.1:3000",
};

async function request(method, path, body) {
  const response = await fetch(`${config.webBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: method === "GET" || body === undefined ? undefined : JSON.stringify(body),
  });

  const json = await response.json();
  assert.ok(response.ok, `[${method}] ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  return json.data;
}

async function requestExpectFailure(method, path, body) {
  const response = await fetch(`${config.webBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: method === "GET" || body === undefined ? undefined : JSON.stringify(body),
  });

  const json = await response.json();
  assert.ok(!response.ok, `[${method}] ${path} should fail`);
  return json;
}

async function main() {
  console.log("[smoke:web:travel] starting", config);

  const travel = await request("POST", "/api/semse/travel", {
    jobId: "job_travel_bff_smoke",
    destinationCity: "Guadalajara",
    departureDate: new Date().toISOString(),
    estimatedDays: 2,
    requiresLodging: false,
    approvedBudget: 300,
    mainTransportMode: "bus",
    notes: "web bff smoke",
  });
  assert.ok(travel.id, "travel id required");

  const listed = await request("GET", "/api/semse/travel");
  assert.ok(Array.isArray(listed), "travel list should be array");
  assert.ok(listed.some((item) => item.id === travel.id), "travel should be listed through bff");

  const blocked = await requestExpectFailure("PATCH", `/api/semse/travel/${travel.id}/status`, {
    status: "PENDING_SETTLEMENT",
  });
  assert.ok(JSON.stringify(blocked).includes("liquidación"), "blocked transition should surface through bff");

  await request("POST", `/api/semse/travel/${travel.id}/expenses`, {
    category: "meal",
    description: "bff meal",
    amount: 80,
    expenseDate: new Date().toISOString(),
    vendor: "BFF Smoke",
  });

  const active = await request("PATCH", `/api/semse/travel/${travel.id}/status`, { status: "ACTIVE" });
  assert.equal(active.status, "ACTIVE");

  const pending = await request("PATCH", `/api/semse/travel/${travel.id}/status`, { status: "PENDING_SETTLEMENT" });
  assert.equal(pending.status, "PENDING_SETTLEMENT");

  const settlement = await request("GET", `/api/semse/travel/${travel.id}/settlement`);
  assert.equal(settlement.travelId, travel.id);

  console.log("[smoke:web:travel] success", {
    travelId: travel.id,
    status: pending.status,
    totalSpent: settlement.totalSpent,
  });
}

main().catch((error) => {
  console.error("[smoke:web:travel] failed", error);
  process.exit(1);
});
