import assert from "node:assert/strict";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? `tnt_travel_${Date.now()}`,
  userId: process.env.SEMSE_USER_ID ?? "usr_travel_ops",
  orgId: process.env.SEMSE_ORG_ID ?? "org_travel_ops",
  roles: process.env.SEMSE_ROLES ?? "OPS_ADMIN,WORKER",
};

async function request(method, path, body) {
  if (!request.accessToken) {
    const authResponse = await fetch(`${config.apiBaseUrl}/v1/auth/token`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        tenantId: config.tenantId,
        userId: config.userId,
        orgId: config.orgId,
        roles: config.roles.split(",").map((entry) => entry.trim()).filter(Boolean),
      }),
    });

    const authJson = await authResponse.json();
    assert.ok(authResponse.ok, `[auth] token failed: ${authResponse.status} ${JSON.stringify(authJson)}`);
    request.accessToken = authJson.data?.accessToken ?? authJson.data?.token;
    assert.ok(request.accessToken, "access token required");
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${request.accessToken}`,
      "x-tenant-id": config.tenantId,
      "x-user-id": config.userId,
      "x-org-id": config.orgId,
      "x-roles": config.roles,
    },
    body: method === "GET" || body === undefined ? undefined : JSON.stringify(body),
  });

  const json = await response.json();
  assert.ok(response.ok, `[${method}] ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  return json.data;
}

async function requestExpectFailure(method, path, body) {
  if (!request.accessToken) {
    await request("GET", "/v1/health");
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${request.accessToken}`,
      "x-tenant-id": config.tenantId,
      "x-user-id": config.userId,
      "x-org-id": config.orgId,
      "x-roles": config.roles,
    },
    body: method === "GET" || body === undefined ? undefined : JSON.stringify(body),
  });

  const json = await response.json();
  assert.ok(!response.ok, `[${method}] ${path} should fail`);
  return json;
}

async function main() {
  console.log("[smoke:travel] starting", config);

  const health = await request("GET", "/v1/health");
  assert.ok(health, "health should respond");

  const job = await request("POST", "/v1/jobs", {
    title: `Travel Smoke Job ${Date.now()}`,
    scope: "Trabajo fuera de ciudad para validar travel ops end-to-end.",
    budgetMin: 1000,
    budgetMax: 3000,
  });
  assert.ok(job.id, "job id required");

  const travel = await request("POST", "/v1/travel", {
    jobId: job.id,
    destinationCity: "Monterrey",
    departureDate: new Date().toISOString(),
    estimatedDays: 3,
    requiresLodging: true,
    approvedBudget: 900,
    mainTransportMode: "bus",
    notes: "travel smoke",
  });
  assert.equal(travel.jobId, job.id);
  assert.equal(travel.destinationCity, "Monterrey");

  const blockedTravel = await request("POST", "/v1/travel", {
    jobId: job.id,
    destinationCity: "Saltillo",
    departureDate: new Date().toISOString(),
    estimatedDays: 2,
    requiresLodging: true,
    approvedBudget: 400,
    mainTransportMode: "bus",
    notes: "blocked transition smoke",
  });
  const blockedPending = await requestExpectFailure("PATCH", `/v1/travel/${blockedTravel.id}/status`, { status: "PENDING_SETTLEMENT" });
  assert.ok(JSON.stringify(blockedPending).includes("liquidación") || JSON.stringify(blockedPending).includes("hospedaje"), "blocked transition should explain why");

  const listed = await request("GET", "/v1/travel");
  assert.ok(Array.isArray(listed), "travel list should be array");
  assert.ok(listed.some((item) => item.id === travel.id), "travel should be listed");

  const lodging = await request("POST", `/v1/travel/${travel.id}/lodging`, {
    name: "Hotel Smoke",
    type: "hotel",
    checkIn: new Date().toISOString(),
    checkOut: new Date(Date.now() + 86400000).toISOString(),
    estimatedTotal: 250,
    paidBy: "worker",
  });
  assert.equal(lodging.travelId, travel.id);

  const expense = await request("POST", `/v1/travel/${travel.id}/expenses`, {
    category: "meal",
    description: "Cena smoke",
    amount: 120,
    expenseDate: new Date().toISOString(),
    vendor: "Restaurante Smoke",
  });
  assert.equal(expense.travelId, travel.id);

  const advance = await request("POST", `/v1/travel/${travel.id}/advances`, {
    amount: 500,
    method: "cash",
    purpose: "Viáticos smoke",
  });
  assert.equal(advance.travelId, travel.id);

  const active = await request("PATCH", `/v1/travel/${travel.id}/status`, { status: "ACTIVE" });
  assert.equal(active.status, "ACTIVE");

  const pending = await request("PATCH", `/v1/travel/${travel.id}/status`, { status: "PENDING_SETTLEMENT" });
  assert.equal(pending.status, "PENDING_SETTLEMENT");

  const settlement = await request("GET", `/v1/travel/${travel.id}/settlement`);
  assert.equal(settlement.travelId, travel.id);
  assert.ok(Number(settlement.totalSpent) >= 370, "settlement should include lodging + expense");

  const closed = await request("POST", `/v1/travel/${travel.id}/settlement/close`, {
    notes: "travel smoke close",
  });
  assert.equal(closed.status, "CLOSED");

  const detail = await request("GET", `/v1/travel/${travel.id}`);
  assert.equal(detail.status, "CLOSED");

  console.log("[smoke:travel] success", {
    jobId: job.id,
    travelId: travel.id,
    settlementId: closed.id,
    totalSpent: settlement.totalSpent,
    balanceDue: settlement.balanceDue,
  });
}

main().catch((error) => {
  console.error("[smoke:travel] failed", error);
  process.exit(1);
});
