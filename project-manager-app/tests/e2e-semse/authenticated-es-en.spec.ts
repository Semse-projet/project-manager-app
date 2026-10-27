/**
 * Authenticated ES/EN smoke + organization isolation (SEMSE quality kit, phase 3).
 * Matrix: docs/semse-kit/test-matrix.md · Rules: docs/semse-kit/security-rules.md
 *
 *   pnpm test:e2e:semse:es-en          # against PLAYWRIGHT_BASE_URL (default http://localhost:3000)
 *
 * For each demo role (OPS_ADMIN, client, professional) it logs in, forces
 * Spanish, switches to English through the real toolbar selector and checks,
 * on the landing dashboard and one more route: no raw dictionary keys on
 * screen, no copy from the other language, `<html lang>` and the stored
 * preference in sync, and no 5xx from the BFF. Then two freshly registered
 * clients (two organizations): the owner creates a job and reads it (positive
 * control), the intruder must get 403/404 and must not see it in its list.
 *
 * Accounts come from SEMSE_E2E_{ADMIN,CLIENT,WORKER}_{EMAIL,PASSWORD}; locally
 * they default to the seeded demo accounts (packages/db/prisma/seed.ts), which
 * the API refuses in production. How to run the local stack:
 * docs/semse-kit/local-stack.md.
 *
 * It writes data (two synthetic users and one job per run), so it only runs
 * against localhost unless SEMSE_E2E_ALLOW_REMOTE=1 is set for an
 * authorized preview. Never point it at production.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { DEMO_CREDENTIALS } from "./utils/test-data";

type Lang = "es" | "en";

const source = readFileSync(fileURLToPath(new URL("../../apps/web/lib/language-context.tsx", import.meta.url)), "utf8");
function dictionary(start: string, end: string): Map<string, string> {
  const block = source.slice(source.indexOf(start), source.indexOf(end));
  return new Map([...block.matchAll(/"([A-Za-z0-9_.-]+)":\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => [m[1], JSON.parse(`"${m[2]}"`)]));
}
const T: Record<Lang, Map<string, string>> = {
  es: dictionary("\n  es: {", "\n  en: {"),
  en: dictionary("\n  en: {", "\nconst LanguageContext"),
};
const KEYS = new Set(T.es.keys());
// Phrases that only exist in one language: if they show up in the other, the screen mixes languages.
const onlyIn = (lang: Lang) => {
  const other = lang === "es" ? T.en : T.es;
  return [...T[lang]].filter(([k, v]) => v.length >= 12 && v.includes(" ") && other.get(k) !== v).map(([, v]) => v);
};
const ONLY = { es: onlyIn("es"), en: onlyIn("en") };

type Role = keyof typeof DEMO_CREDENTIALS;
const ROLES: Array<{ role: Role; label: string; extraRoute: string }> = [
  { role: "admin", label: "OPS_ADMIN", extraRoute: "/admin/mission-control" },
  { role: "client", label: "cliente", extraRoute: "/client/marketplace" },
  { role: "worker", label: "profesional", extraRoute: "/worker/dashboard" },
];

test.beforeAll(({ baseURL }) => {
  const host = new URL(baseURL ?? "http://localhost:3000").hostname;
  test.skip(
    !["localhost", "127.0.0.1"].includes(host) && process.env.SEMSE_E2E_ALLOW_REMOTE !== "1",
    `refusing to write test data to ${host}: set SEMSE_E2E_ALLOW_REMOTE=1 only for an authorized preview`,
  );
});

function credentials(role: Role) {
  const prefix = `SEMSE_E2E_${role.toUpperCase()}`;
  return {
    email: process.env[`${prefix}_EMAIL`] ?? DEMO_CREDENTIALS[role].email,
    password: process.env[`${prefix}_PASSWORD`] ?? DEMO_CREDENTIALS[role].password,
  };
}

// Logs in through the real form (works whether or not the demo presets are shown).
async function login(page: Page, role: Role): Promise<boolean> {
  const { email, password } = credentials(role);
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.locator('form button[type="submit"]').click();
  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

// Already-reported defects: reported as annotations instead of failing the
// whole case, and flagged when they stop reproducing so the entry gets removed.
// Each needs a finding reference in docs/semse-kit/test-matrix.md.
// Empty since #1023: the mission-control stream (KIT-F3-01) now answers its real 403, not 503.
const KNOWN_BFF_FAILURES: Record<string, string> = {};

function watchBff(page: Page) {
  const failures: string[] = [];
  const known = new Map<string, number>();
  const seenOk = new Set<string>();
  page.on("response", (res) => {
    if (!res.url().includes("/api/semse/")) return;
    const path = new URL(res.url()).pathname;
    if (res.status() < 500) {
      if (path in KNOWN_BFF_FAILURES) seenOk.add(path);
      return;
    }
    if (path in KNOWN_BFF_FAILURES) known.set(path, (known.get(path) ?? 0) + 1);
    else failures.push(`${res.status()} ${res.request().method()} ${path}`);
  });
  return {
    failures,
    annotate() {
      for (const [path, count] of known) test.info().annotations.push({ type: "known-defect", description: `${path} ×${count} — ${KNOWN_BFF_FAILURES[path]}` });
      for (const path of seenOk) if (!known.has(path)) test.info().annotations.push({ type: "known-defect-fixed?", description: `${path} answered <500: remove it from KNOWN_BFF_FAILURES if the fix is confirmed` });
    },
  };
}

async function expectLanguage(page: Page, lang: Lang, where: string) {
  await expect(page.getByText(T[lang].get("ui.language")!, { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang), `${where}: <html lang>`).toBe(lang);
  expect(await page.evaluate(() => window.localStorage.getItem("semse-language")), `${where}: stored preference`).toBe(lang);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const text = await page.locator("body").innerText();
  const rawKeys = [...new Set(text.match(/\b[a-zA-Z][\w-]*(?:\.[\w-]+)+\b/g) ?? [])].filter((token) => KEYS.has(token));
  expect(rawKeys, `${where} (${lang}): raw dictionary keys on screen`).toEqual([]);
  const foreign = ONLY[lang === "es" ? "en" : "es"].filter((phrase) => text.includes(phrase));
  expect(foreign, `${where} (${lang}): copy from the other language on screen`).toEqual([]);
}

for (const { role, label, extraRoute } of ROLES) {
  test(`${label}: ES y EN coherentes en el panel y en ${extraRoute}`, async ({ page }) => {
    const bff = watchBff(page);
    const ok = await login(page, role);
    test.skip(!ok, `login de ${label} no disponible: ¿API en :4000, semilla aplicada o SEMSE_E2E_${role.toUpperCase()}_* definidas?`);

    await page.evaluate(() => window.localStorage.setItem("semse-language", "es"));
    for (const route of [page.url(), extraRoute]) {
      await page.goto(route);
      await expectLanguage(page, "es", route);

      // Switch through the real toolbar control, as a user would.
      await page.getByLabel(T.es.get("ui.language")!).selectOption("en");
      await expectLanguage(page, "en", route);

      // The preference must survive a reload.
      await page.reload();
      await expectLanguage(page, "en", `${route} (reload)`);

      await page.getByLabel(T.en.get("ui.language")!).selectOption("es");
    }
    bff.annotate();
    expect(bff.failures, "BFF 5xx responses while browsing").toEqual([]);
  });
}

test("aislamiento: un cliente de otra organización no ve el trabajo privado de la org A", async ({ browser, baseURL }) => {
  // Both actors are synthetic and created here, so the check never depends on seed data or demo accounts.
  const runId = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const owner = await browser.newContext({ baseURL });
  const intruder = await browser.newContext({ baseURL });
  try {
    for (const [ctx, who] of [[owner, "owner"], [intruder, "intruder"]] as const) {
      const registered = await ctx.request.post("/api/semse/auth/register", {
        data: { email: `e2e-${runId}-${who}@example.test`, password: randomBytes(18).toString("base64url"), name: `TEST_${runId}_${who}`, role: "CLIENT" },
      });
      test.skip(registered.status() === 503 || registered.status() === 502, `registro no disponible (${registered.status()}): ¿API en :4000?`);
      expect(registered.ok(), `register synthetic ${who}: ${registered.status()} ${await registered.text()}`).toBeTruthy();
    }

    const title = `TEST_${runId} trabajo privado`;
    const created = await owner.request.post("/api/semse/jobs", {
      data: { title, scope: `Trabajo sintético del test de aislamiento ${runId}.`, category: "general" },
    });
    expect(created.ok(), `owner creates a job: ${created.status()} ${await created.text()}`).toBeTruthy();
    const jobId = ((await created.json()) as { data?: { id?: string } }).data?.id;
    expect(jobId, "created job id").toBeTruthy();

    // Positive control: the owner reads it, so a denial below means isolation, not a broken stack.
    const own = await owner.request.get(`/api/semse/jobs/${jobId}`);
    expect(own.status(), "owner reading its own job").toBe(200);
    expect(await own.text()).toContain(title);

    const detail = await intruder.request.get(`/api/semse/jobs/${jobId}`);
    expect([403, 404], `intruder reading ${jobId}: got ${detail.status()}`).toContain(detail.status());
    expect(await detail.text(), "denied response must not leak the job").not.toContain(title);

    const list = await intruder.request.get("/api/semse/jobs");
    expect(list.status(), "intruder job list").toBe(200);
    expect(await list.text(), "intruder job list must not include the other org's job").not.toContain(jobId!);
  } finally {
    await owner.close();
    await intruder.close();
  }
});
