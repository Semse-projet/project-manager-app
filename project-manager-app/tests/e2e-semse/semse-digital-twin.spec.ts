import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";

const MAP_PATH = "/semse-consciousness-map";
const TEST_SESSION_SECRET = "local-digital-twin-test-only";
const EVIDENCE_DIR = "artifacts/evidence/digital-twin";

async function openReadyMap(page: Page) {
  await page.goto(MAP_PATH);
  const scene = page.getByTestId("digital-twin-3d");
  await expect(scene).toHaveAttribute("data-scene-ready", "true", { timeout: 20_000 });
  await expect.poll(async () => Number(await scene.locator("canvas").getAttribute("data-render-count"))).toBeGreaterThan(0);
  return scene;
}

async function addAdminSession(page: Page, baseURL: string | undefined) {
  const payload = Buffer.from(JSON.stringify({
    userId: "usr_digital_twin_e2e",
    tenantId: "tenant_digital_twin_e2e",
    orgId: "org_digital_twin_e2e",
    roles: ["OPS_ADMIN"],
    sessionId: "session_digital_twin_e2e",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString("base64url");
  const signature = createHmac("sha256", TEST_SESSION_SECRET).update(payload).digest("base64url");
  await page.context().addCookies([{
    name: "semse_session",
    value: `${payload}.${signature}`,
    url: baseURL ?? "http://localhost:3000",
    httpOnly: true,
    sameSite: "Lax",
  }]);
}

const consciousnessFixture = {
  generatedAt: "2026-11-15T12:00:00.000Z",
  version: "controlled-e2e",
  identity: {
    name: "SEMSE Consciousness E2E",
    purpose: "Respuesta controlada para validar el adaptador; no es producción.",
    coreLoop: ["Intake", "Evidence", "Payment"],
    operatingPrinciples: ["Read only"],
    autonomyLevel: 1,
    autonomyDescription: "Fixture E2E controlado",
  },
  memory: {
    ragStatus: {
      provider: "controlled", model: "none", available: false, totalDocuments: 0,
      totalChunks: 0, chunksWithEmbeddings: 0, retrievalMode: "none",
    },
    auditLogActive: false,
    operationalSignalsActive: false,
    memoryLayers: [],
  },
  brains: {
    providers: [], routingPolicy: { defaultProvider: "none", fallbackChain: [] },
    totalLLMCalls: 0, totalFallbacks: 0,
  },
  maturity: {
    globalScore: 70,
    byModule: [
      { module: "BuildOps", score: 73, status: "functional", gaps: [] },
      { module: "Payment Governance", score: 66, status: "partial", gaps: [] },
      { module: "Unknown Registry Module", score: 42, status: "partial", gaps: [] },
    ],
    strongestAreas: ["BuildOps"], weakestAreas: ["Payment Governance"],
  },
  risks: { critical: [], high: [], medium: [], low: [] },
  operationalState: {
    openSignals: 0, criticalSignals: 0, monetizableFlowReady: false,
    monetizableFlowStatus: "Sin evaluar en fixture E2E",
  },
  recommendations: { nextBestActions: [], doNotDoYet: [], strategicWarnings: [] },
  observation: {
    observedAt: "2026-11-15T12:00:00.000Z", healthScore: 88, infraHealthy: true,
    alertCount: 0, alertSummary: [], ragMode: "none", ollamaAvailable: false,
  },
};

test.describe("SEMSE Ecosystem Digital Twin", () => {
  test("3D renderiza 33 instancias, permanece en reposo y admite teclado/reset", async ({ page }) => {
    const runtimeErrors: string[] = [];
    const failedResponses: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
    });

    const scene = await openReadyMap(page);
    const canvas = scene.locator("canvas");
    await expect(canvas).toHaveAttribute("data-node-count", "33");
    await expect.poll(async () => Number(await canvas.getAttribute("data-draw-calls"))).toBeGreaterThan(0);
    expect(Number(await canvas.getAttribute("data-dpr"))).toBeLessThanOrEqual(1.75);

    await canvas.focus();
    await expect(canvas).toHaveCSS("outline-color", "rgb(103, 232, 249)");
    await page.keyboard.press("Home");
    await expect(scene).toHaveAttribute("data-selected-node", "landing");
    await page.keyboard.press("ArrowRight");
    await expect(scene).toHaveAttribute("data-selected-node", "smart_intake");
    await page.keyboard.press("End");
    await expect(scene).toHaveAttribute("data-selected-node", "railway");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Railway Deployment" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(scene).toHaveAttribute("data-selected-node", "");

    const beforeReset = Number(await canvas.getAttribute("data-render-count"));
    await page.getByRole("button", { name: "Restablecer cámara" }).click();
    await expect.poll(async () => Number(await canvas.getAttribute("data-render-count"))).toBeGreaterThan(beforeReset);
    await page.waitForTimeout(250);
    const idleCount = Number(await canvas.getAttribute("data-render-count"));
    await page.waitForTimeout(500);
    expect(Number(await canvas.getAttribute("data-render-count"))).toBe(idleCount);

    const metrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      return {
        requests: resources.length,
        encodedBytes: resources.reduce((sum, resource) => sum + resource.encodedBodySize, 0),
      };
    });
    await test.info().attach("digital-twin-performance", {
      body: JSON.stringify({
        ...metrics,
        drawCalls: Number(await canvas.getAttribute("data-draw-calls")),
        triangles: Number(await canvas.getAttribute("data-triangles")),
        idleRenderCount: idleCount,
      }),
      contentType: "application/json",
    });
    expect(runtimeErrors).toEqual([]);
    expect(failedResponses).toEqual([]);
  });

  test("2D y lista conservan búsqueda, filtro, selección y estado vacío", async ({ page }) => {
    await openReadyMap(page);
    await page.getByRole("button", { name: "Lista", exact: true }).click();
    await expect(page.locator('[data-testid^="digital-twin-node-"]')).toHaveCount(33);

    await page.getByPlaceholder("Buscar módulo, descripción o señal…").fill("Payment Governance");
    await expect(page.locator('[data-testid^="digital-twin-node-"]')).toHaveCount(1);
    await page.getByTestId("digital-twin-node-payment_governance").click();
    await expect(page.getByRole("heading", { name: "Payment Governance" })).toBeVisible();

    await page.getByRole("button", { name: "2D", exact: true }).click();
    await expect(page.getByTestId("digital-twin-2d")).toBeVisible();
    await expect(page.locator('g[role="button"][tabindex="0"]')).toHaveCount(1);
    const node2d = page.getByRole("button", { name: /Payment Governance, SEMSE Payments/ });
    await node2d.focus();
    await page.keyboard.press("Space");
    await expect(node2d).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(node2d).toHaveAttribute("aria-pressed", "false");

    await page.getByRole("button", { name: "Lista", exact: true }).click();
    await page.getByPlaceholder("Buscar módulo, descripción o señal…").fill("no-existe-en-el-ecosistema");
    await expect(page.getByText("No hay módulos que coincidan")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
    await page.getByLabel("Filtrar por dominio").selectOption("semse-agro");
    await expect(page.getByText("No hay módulos que coincidan")).toBeVisible();
    await page.getByLabel("Filtrar por dominio").selectOption("all");
    await expect(page.locator('[data-testid^="digital-twin-node-"]')).toHaveCount(33);
  });

  test("los tres flujos terminan y pueden repetirse sin loop", async ({ page }) => {
    const scene = await openReadyMap(page);
    await page.getByRole("button", { name: "Flujos de valor" }).click();
    const selector = page.getByLabel("Flujo de valor");
    const play = page.getByTestId("digital-twin-play-flow");

    for (const flowId of ["intake_to_contract", "execution_to_evidence", "evidence_to_payment"]) {
      await selector.selectOption(flowId);
      await play.click();
      await expect(play).toBeDisabled();
      await expect(play).toHaveText("Repetir flujo", { timeout: 9_000 });
      await expect(play).toBeEnabled();
      await expect(scene).toHaveAttribute("data-playback-phase", "idle");
    }
  });

  test("reduced motion llega al estado final sin impulso SMIL", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openReadyMap(page);
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await page.getByRole("button", { name: "Flujos de valor" }).click();
    await page.getByTestId("digital-twin-play-flow").click();
    await expect(page.getByTestId("digital-twin-play-flow")).toHaveText("Repetir flujo");
    await expect(page.locator("animateMotion")).toHaveCount(0);
  });

  test("WebGL ausente y pérdida de contexto cambian a 2D sin pantalla en blanco", async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
        if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
        return original.call(this, type, ...args);
      } as typeof original;
    });
    await page.goto(MAP_PATH);
    await expect(page.getByText(/WebGL no está disponible/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("digital-twin-2d")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar 3D" })).toBeVisible();
    await page.getByRole("button", { name: "Reintentar 3D" }).click();
    await expect(page.getByTestId("digital-twin-2d")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Reintentar 3D" })).toBeVisible();
  });

  test("el evento webglcontextlost ofrece fallback y el unmount elimina el canvas", async ({ page }) => {
    const scene = await openReadyMap(page);
    await scene.locator("canvas").evaluate((canvasElement) => {
      const canvas = canvasElement as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      const extension = gl?.getExtension("WEBGL_lose_context");
      if (extension) extension.loseContext();
      else canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });
    await expect(page.getByText(/WebGL no está disponible/)).toBeVisible();
    await expect(page.getByTestId("digital-twin-2d")).toBeVisible();
    await expect(page.getByTestId("semse-digital-twin").locator("canvas")).toHaveCount(0);

    await page.getByRole("button", { name: "Reintentar 3D" }).click();
    await expect(page.getByTestId("digital-twin-3d")).toHaveAttribute("data-scene-ready", "true");
    await expect(page.getByTestId("semse-digital-twin").locator("canvas")).toHaveCount(1);
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await expect(page.getByTestId("semse-digital-twin").locator("canvas")).toHaveCount(0);
  });

  test("desktop y móvil no desbordan; resize vuelve a renderizar y controles son táctiles", async ({ page }) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const scene = await openReadyMap(page);
    await page.screenshot({ path: `${EVIDENCE_DIR}/desktop-3d.png`, fullPage: true });

    for (const width of [375, 768, 1024, 1440]) {
      const before = Number(await scene.locator("canvas").getAttribute("data-render-count"));
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      await expect.poll(async () => Number(await scene.locator("canvas").getAttribute("data-render-count"))).toBeGreaterThan(before);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width === 375) {
        for (const name of ["3D", "2D", "Lista"]) {
          const box = await page.getByRole("button", { name, exact: true }).boundingBox();
          expect(box?.height).toBeGreaterThanOrEqual(44);
        }
        const sceneBox = await scene.boundingBox();
        expect(sceneBox).not.toBeNull();
        for (const label of await scene.locator("[data-domain-label]").all()) {
          const labelBox = await label.boundingBox();
          expect(labelBox).not.toBeNull();
          expect(labelBox!.x).toBeGreaterThanOrEqual(sceneBox!.x - 1);
          expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(sceneBox!.x + sceneBox!.width + 1);
        }
        await page.screenshot({ path: `${EVIDENCE_DIR}/mobile-3d.png`, fullPage: true });
        await page.getByRole("button", { name: "Lista", exact: true }).click();
        await page.screenshot({ path: `${EVIDENCE_DIR}/mobile-list.png`, fullPage: true });
        await page.getByRole("button", { name: "3D", exact: true }).click();
        await expect(page.getByTestId("digital-twin-3d")).toHaveAttribute("data-scene-ready", "true");
      }
    }
  });

  test("admin compone una respuesta controlada sin convertir registro en runtime", async ({ page, baseURL }) => {
    await addAdminSession(page, baseURL);
    await page.route("**/api/semse/ops/consciousness", (route) => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({ data: consciousnessFixture }),
    }));
    await page.route("**/api/semse/ops/recommendations", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {
        generatedAt: consciousnessFixture.generatedAt, systemScore: 70, totalActions: 0,
        recommendations: [], topPriority: null, autonomyLevel: 2, autonomyPolicy: "controlled-e2e",
      } }),
    }));
    await page.route("**/api/semse/ops/simulation?limit=6", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {
        patchCount: 0, safePatchCount: 0, patches: [], autonomyLevel: 3,
        autonomyPolicy: "controlled-e2e", guardrails: [],
      } }),
    }));

    await page.goto("/admin/consciousness");
    await expect(page.getByTestId("semse-digital-twin")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Salud global observada · 88/100")).toBeVisible();
    await page.getByRole("button", { name: "Lista", exact: true }).click();
    await page.getByTestId("digital-twin-node-buildops").click();
    const details = page.getByLabel("Detalle del módulo");
    await expect(details.getByRole("heading", { name: "BuildOps" })).toBeVisible();
    await expect(details.getByText("73/100 · registro estático backend")).toBeVisible();
    await expect(details.getByText("null · no medida por este contrato")).toBeVisible();
    await expect(page.getByText(/1 módulos de registro sin correspondencia/)).toBeVisible();
    await page.locator("summary").filter({ hasText: "módulos de registro sin correspondencia" }).click();
    await expect(page.getByTestId("semse-digital-twin").getByText("Unknown Registry Module")).toBeVisible();

    await page.unroute("**/api/semse/ops/consciousness");
    await page.route("**/api/semse/ops/consciousness", (route) => route.fulfill({
      status: 403, contentType: "application/json", body: JSON.stringify({ error: "controlled-forbidden" }),
    }));
    await page.getByRole("button", { name: "Actualizar" }).click();
    await expect(page.getByText(/HTTP 403 — verifica que la API/)).toBeVisible();
    await expect(page.getByTestId("semse-digital-twin")).toBeVisible();
  });
});
