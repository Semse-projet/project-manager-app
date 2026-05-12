import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

loadEnv({ path: path.join(repoRoot, "packages/db/.env") });

const baseUrl = (process.env.SEMSE_WEB_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
const prisma = new PrismaClient();

function buildJsonHeaders(extra = {}) {
  return {
    "content-type": "application/json",
    ...extra,
  };
}

async function readResponse(response) {
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status(), text, json };
}

async function api(request, method, url, options = {}) {
  const response = await request.fetch(url, {
    method,
    failOnStatusCode: false,
    ...options,
  });
  const payload = await readResponse(response);
  return {
    response,
    ...payload,
  };
}

function buildWizardPath({ intakeId, title, description, budgetMin, budgetMax }) {
  const params = new URLSearchParams({
    source: "landing",
    intakeId,
    category: "pintura",
    subcategory: "interior",
    title,
    description,
    locationType: "on_site",
    city: "Miami, FL",
    urgency: "medium",
    budgetType: "range",
    budgetMin: String(budgetMin),
    budgetMax: String(budgetMax),
    step: "3",
  });
  return `/client/jobs/new?${params.toString()}`;
}

async function main() {
  const title = `Smoke Smart Intake ${Date.now()}`;
  const description = "Quiero pintar las paredes interiores del bano principal, reparar pequenos detalles y dejar un acabado limpio en color claro.";

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();
  const request = context.request;

  let intakeId = null;
  let jobId = null;
  let claimResult = null;
  let secondPublishResult = null;
  let intakeCookie = null;
  let localStorageBeforeLogin = null;
  let localStorageAfterRecovery = null;
  let localStorageAfterPublish = null;
  let loginRedirectFrom = null;
  let recoveryBannerVisible = false;

  try {
    await page.goto("/");

    const analyze = await api(request, "POST", "/api/semse/public/intake/analyze", {
      headers: buildJsonHeaders(),
      data: {
        rawDescription: description,
        title,
        category: "pintura",
        subcategory: "interior",
        modality: "on_site",
        city: "Miami, FL",
        urgency: "medium",
      },
    });
    assert.equal(analyze.status, 200, `analyze failed: ${analyze.text}`);
    intakeId = analyze.json?.data?.intakeId;
    assert.ok(intakeId, "analyze did not return intakeId");

    const cookiesAfterAnalyze = await context.cookies();
    intakeCookie = cookiesAfterAnalyze.find((cookie) => cookie.name === "semse_intake_session") ?? null;
    assert.ok(intakeCookie, "semse_intake_session cookie was not set");
    assert.equal(intakeCookie.httpOnly, true, "semse_intake_session cookie must be httpOnly");

    const answers = [
      { questionId: "painting_area", selectedValues: ["other"], customText: "240 sqft", isNotSure: false },
      { questionId: "painting_condition", selectedValues: ["good"], isNotSure: false },
      { questionId: "painting_coats", selectedValues: ["2"], isNotSure: false },
      { questionId: "painting_estimate_preference", selectedValues: ["both"], isNotSure: false },
      { questionId: "painting_pricing_mode", selectedValues: ["per_area"], isNotSure: false },
      { questionId: "painting_duration", selectedValues: ["3_5_days"], isNotSure: false },
    ];

    for (const answer of answers) {
      const result = await api(request, "PATCH", `/api/semse/public/intake/${encodeURIComponent(intakeId)}/answer`, {
        headers: buildJsonHeaders(),
        data: answer,
      });
      assert.equal(result.status, 200, `answer failed for ${answer.questionId}: ${result.text}`);
    }

    const estimate = await api(request, "POST", `/api/semse/public/intake/${encodeURIComponent(intakeId)}/estimate`);
    assert.equal(estimate.status, 200, `estimate failed: ${estimate.text}`);
    const estimateData = estimate.json?.data?.estimate;
    assert.ok(estimateData?.totalRange?.min, "estimate did not return totalRange");

    await page.evaluate((id) => {
      window.localStorage.setItem("intake_draft_id", id);
    }, intakeId);
    localStorageBeforeLogin = await page.evaluate(() => window.localStorage.getItem("intake_draft_id"));
    assert.equal(localStorageBeforeLogin, intakeId, "localStorage should contain intake_draft_id before login");

    const wizardPath = buildWizardPath({
      intakeId,
      title,
      description,
      budgetMin: estimateData.totalRange.min,
      budgetMax: estimateData.totalRange.max,
    });

    await page.goto(wizardPath);
    await page.waitForURL(/\/login\?/);

    const loginUrl = new URL(page.url());
    loginRedirectFrom = loginUrl.searchParams.get("from");
    assert.ok(loginRedirectFrom?.includes("/client/jobs/new"), "login redirect is missing original wizard path");
    assert.ok(loginRedirectFrom?.includes("step=3"), "login redirect does not preserve step=3");

    await page.getByRole("button", { name: /Ingresar/i }).click();
    await page.waitForURL(/\/client\/jobs\/new/);
    await page.getByText("Paso 3 de 4").waitFor({ timeout: 15000 });

    try {
      await page.getByText("Recuperamos el intake de la landing").waitFor({ timeout: 10000 });
      recoveryBannerVisible = true;
    } catch {
      recoveryBannerVisible = false;
    }

    localStorageAfterRecovery = await page.evaluate(() => window.localStorage.getItem("intake_draft_id"));
    assert.equal(localStorageAfterRecovery, null, "intake_draft_id should be cleared after intake recovery");

    const claimed = await api(request, "POST", `/api/semse/intake/${encodeURIComponent(intakeId)}/claim`, {
      headers: buildJsonHeaders(),
      data: {},
    });
    assert.equal(claimed.status, 200, `claim failed without sessionToken body: ${claimed.text}`);
    claimResult = claimed.json?.data ?? null;

    await page.getByRole("button", { name: /^Siguiente/i }).click();
    await page.getByText("Paso 4 de 4").waitFor({ timeout: 10000 });

    await page.getByRole("button", { name: /Publicar trabajo/i }).click();
    await page.waitForURL(/\/client\/jobs\/[^/?#]+$/);

    const finalUrl = new URL(page.url());
    jobId = finalUrl.pathname.split("/").filter(Boolean).at(-1) ?? null;
    assert.ok(jobId, "could not resolve published job id from final URL");

    localStorageAfterPublish = await page.evaluate(() => window.localStorage.getItem("intake_draft_id"));
    assert.equal(localStorageAfterPublish, null, "intake_draft_id should remain cleared after publish");

    const publishAgain = await api(request, "POST", `/api/semse/intake/${encodeURIComponent(intakeId)}/publish`, {
      headers: buildJsonHeaders(),
      data: { confirmEstimate: true },
    });
    assert.equal(publishAgain.status, 200, `second publish failed: ${publishAgain.text}`);
    secondPublishResult = publishAgain.json?.data ?? null;
    assert.equal(secondPublishResult?.jobId, jobId, "second publish should return the same jobId");

    const intakeRow = await prisma.projectIntake.findUnique({ where: { id: intakeId } });
    assert.ok(intakeRow, "ProjectIntake row not found in database");
    assert.equal(intakeRow.status, "published", "ProjectIntake should be published");
    assert.equal(intakeRow.userId, "usr_client_001", "ProjectIntake should be claimed by demo client");
    assert.equal(intakeRow.publishedJobId, jobId, "ProjectIntake should point to the published job");
    assert.ok(intakeRow.claimedAt, "ProjectIntake should have claimedAt");
    assert.ok(intakeRow.publishedAt, "ProjectIntake should have publishedAt");

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    assert.ok(job, "Published job not found in database");
    assert.equal(job.title, title, "Published job title does not match smoke title");

    const sameTitleCount = await prisma.job.count({ where: { title } });
    assert.equal(sameTitleCount, 1, "Publish flow created duplicate jobs for the same smoke title");

    console.log(JSON.stringify({
      ok: true,
      baseUrl,
      intakeId,
      jobId,
      recoveryBannerVisible,
      loginRedirectFrom,
      intakeCookie: intakeCookie
        ? {
            name: intakeCookie.name,
            httpOnly: intakeCookie.httpOnly,
            sameSite: intakeCookie.sameSite,
          }
        : null,
      claimResult,
      secondPublishResult,
      localStorageBeforeLogin,
      localStorageAfterRecovery,
      localStorageAfterPublish,
      database: {
        intakeStatus: intakeRow.status,
        intakeUserId: intakeRow.userId,
        publishedJobId: intakeRow.publishedJobId,
        sameTitleCount,
      },
    }, null, 2));
  } finally {
    await context.close();
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
