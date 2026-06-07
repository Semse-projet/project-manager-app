import { test, expect } from "@playwright/test";

const API_BASE = process.env.SEMSE_API_URL ?? "http://127.0.0.1:4122";
const ACTORS = {
  client: {
    tenantId: "tenant_default",
    orgId: "org_client_001",
    userId: "usr_client_001",
    roles: ["CLIENT"],
  },
  pro: {
    tenantId: "tenant_default",
    orgId: "org_pro_001",
    userId: "usr_worker_001",
    roles: ["PRO"],
  },
  ops: {
    tenantId: "tenant_default",
    orgId: "org_admin_001",
    userId: "usr_admin_001",
    roles: ["OPS_ADMIN"],
  },
};

async function loginAs(page, roleLabel, targetPath) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(roleLabel, "i") }).click();
  await page.getByRole("button", { name: /Ingresar/i }).click();
  await page.waitForURL(new RegExp(targetPath));
}

async function apiDirect(actor, method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": actor.tenantId,
      "x-org-id": actor.orgId,
      "x-user-id": actor.userId,
      "x-roles": actor.roles.join(","),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(`${method} ${path} -> ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload.data;
}

async function api(page, path, init) {
  return page.evaluate(async ({ path: targetPath, init: targetInit }) => {
    const response = await fetch(targetPath, targetInit);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) {
      throw new Error(`${targetPath} -> ${response.status} ${JSON.stringify(payload)}`);
    }
    return payload.data;
  }, { path, init });
}

test("cliente fondea escrow y libera milestone desde pagos", async ({ page }) => {
  const suffix = Date.now();
  const job = await apiDirect(ACTORS.client, "POST", "/v1/jobs", {
      title: `E2E Payments ${suffix}`,
      scope: "Instalacion de prueba para flujo de pagos.",
      description: "Trabajo de prueba para validar fondeo, submit, aprobacion y release.",
      category: "Plomeria",
      budgetMin: 650,
      budgetMax: 950,
      urgency: "medium",
      locationType: "on_site",
      city: "Miami"
  });
  const reservation = await apiDirect(ACTORS.pro, "POST", `/v1/jobs/${job.id}/reservations`, {
    expiresInMinutes: 30
  });
  await apiDirect(ACTORS.client, "POST", `/v1/reservations/${reservation.id}/accept`, {});
  const documentHash = `e2e-contract-${suffix}`;
  const pdfUrl = "https://example.com/contracts/e2e-canonical.pdf";
  const contract = await apiDirect(ACTORS.client, "POST", `/v1/jobs/${job.id}/contracts`, {
    termsJson: {
      currency: "USD",
      releasePolicy: "approved_milestone_only"
    },
  });
  await apiDirect(ACTORS.client, "POST", `/v1/contracts/${contract.id}/sign`, {
    documentHash,
    pdfUrl
  });
  await apiDirect(ACTORS.pro, "POST", `/v1/contracts/${contract.id}/sign`, {
    documentHash,
    pdfUrl
  });

  await loginAs(page, "Cliente", "/client/dashboard");

  await page.goto("/client/payments");
  await page.waitForLoadState("networkidle");

  await expect(page.getByTestId("client-payments-job-filter")).toBeVisible();
  await page.waitForFunction((jobId) => {
    const select = document.querySelector('[data-testid="client-payments-job-filter"]');
    if (!(select instanceof HTMLSelectElement)) return false;
    return Array.from(select.options).some((option) => option.value === jobId);
  }, String(job.id));
  await page.getByTestId("client-payments-job-filter").selectOption(String(job.id));
  await page.getByTestId("client-payments-fund-button").click();
  await page.getByTestId("escrow-fund-amount").fill("650");
  await page.getByTestId("escrow-provider-mock").click();
  await page.getByTestId("escrow-fund-continue").click();
  await page.getByTestId("escrow-fund-confirm").click();
  await expect(page.getByText("¡Escrow fondeado!")).toBeVisible({ timeout: 15000 });

  await page.waitForTimeout(1500);

  const projects = await apiDirect(ACTORS.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.id)}`);
  const project = projects.find((entry) => entry.jobId === job.id);
  expect(project).toBeTruthy();

  const milestone = await apiDirect(ACTORS.ops, "POST", `/v1/projects/${project.id}/milestones`, {
      title: `Milestone Pago ${suffix}`,
      amount: 200,
      sequence: 1
  });

  await apiDirect(ACTORS.pro, "POST", "/v1/evidence", {
      projectId: project.id,
      milestoneId: milestone.id,
      key: `e2e/${suffix}-evidence.jpg`,
      kind: "PHOTO"
  });

  await apiDirect(ACTORS.pro, "POST", `/v1/milestones/${milestone.id}/submit`, {});

  await page.getByTestId("client-payments-refresh-button").click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByTestId("client-payments-milestones-title")).toContainText("1", { timeout: 15000 });
  await page.getByTestId(`client-payments-release-${milestone.id}`).click();

  await page.getByTestId("client-payments-refresh-button").click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("client-payments-tab-pagados")).toBeVisible();
  await page.getByTestId("client-payments-tab-pagados").click();
  await expect(page.getByText(`Liberación – ${job.title}`)).toBeVisible({ timeout: 15000 });
});

test("profesional guarda metodo de cobro y queda persistido", async ({ page }) => {
  await loginAs(page, "Profesional", "/worker/dashboard");

  await page.goto("/worker/payments");
  await page.waitForLoadState("networkidle");

  await page.getByTestId("worker-payments-payout-toggle").click();
  await page.getByTestId("payout-type-paypal").click();
  await page.getByTestId("payout-digital-handle").fill("worker-e2e@semse.test");
  await page.getByTestId("payout-save-button").click();

  await expect(page.getByText(/Método guardado/i)).toBeVisible();

  const payout = await api(page, "/api/semse/workers/payout-method", { method: "GET" });
  expect(payout.type).toBe("paypal");
  expect(payout.email).toBe("worker-e2e@semse.test");
});
