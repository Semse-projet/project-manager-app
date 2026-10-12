// Recorrido automatizado de usabilidad — web Cliente (/client/*).
// Uso: AXE_PATH=<ruta a axe.min.js> node tests/usability/client-walkthrough.mjs
// Env: BASE_URL (default http://localhost:3000), OUT_DIR (default docs/usability/run-<fecha>)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT_DIR ?? `docs/usability/run-${new Date().toISOString().slice(0, 10)}`;
const AXE = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, "utf8") : null;
fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });

const STATIC = [
  "dashboard", "leads", "jobs", "jobs/new", "projects", "milestones", "professionals",
  "marketplace", "bids", "protools", "documents", "reviews", "review", "payments", "finance",
  "proposals", "change-orders", "disputes", "account",
];
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const slug = (s) => s.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  const preset = page.getByRole("button", { name: /Cliente/i }).first();
  if (await preset.isVisible().catch(() => false)) await preset.click();
  else {
    // build de producción: sin botones demo, credenciales del seed local
    await page.locator("input[type=email],input[name=email]").first().fill(process.env.CLIENT_EMAIL ?? "client@demo.semse");
    await page.locator("input[type=password]").first().fill(process.env.CLIENT_PASSWORD ?? "demo1234");
  }
  await page.getByRole("button", { name: /Ingresar/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
}

async function audit(page, vpName, route) {
  const res = { route, viewport: vpName, errors: [], failedRequests: [], consoleErrors: [] };
  const onConsole = (m) => m.type() === "error" && res.consoleErrors.push(m.text().slice(0, 300));
  const onResp = (r) => r.status() >= 400 && res.failedRequests.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, "")}`.slice(0, 200));
  page.on("console", onConsole);
  page.on("response", onResp);
  const t0 = Date.now();
  try {
    const resp = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    res.status = resp?.status();
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => (res.networkIdle = false));
    res.loadMs = Date.now() - t0;
    res.finalUrl = page.url().replace(BASE, "");
    res.redirected = res.finalUrl !== route;
    res.title = await page.title();
    await page.screenshot({ path: path.join(OUT, "shots", `${slug(route)}__${vpName}.png`), fullPage: true });

    Object.assign(res, await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
      const name = (el) => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.getAttribute("alt") || "").trim();
      const interactive = [...document.querySelectorAll("a[href],button,[role=button],input:not([type=hidden]),select,textarea")].filter(vis);
      const small = interactive.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 24 || r.height < 24; });
      const smallMobile = interactive.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; });
      return {
        h1: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim().slice(0, 80)),
        landmarks: { main: !!document.querySelector("main,[role=main]"), nav: !!document.querySelector("nav,[role=navigation]") },
        lang: document.documentElement.lang,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        interactiveCount: interactive.length,
        targetsUnder24: small.length,
        targetsUnder44: smallMobile.length,
        unnamedControls: interactive.filter((el) => !name(el) && !el.labels?.length).slice(0, 8).map((el) => el.outerHTML.slice(0, 120)),
        imgsNoAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
        inputsNoLabel: [...document.querySelectorAll("input:not([type=hidden]),select,textarea")].filter((i) => vis(i) && !i.labels?.length && !i.getAttribute("aria-label") && !i.getAttribute("aria-labelledby")).length,
        emptyStateText: /no hay|sin |a[uú]n no|empty|vac[ií]o/i.test(document.body.innerText),
        rawErrorText: (document.body.innerText.match(/(undefined|NaN|\[object Object\]|Authentication required|Internal Server Error|Application error)/g) ?? []).slice(0, 5),
        bodyChars: document.body.innerText.length,
      };
    }));

    if (AXE) {
      await page.evaluate(AXE);
      const axe = await page.evaluate(() => window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }));
      res.axe = axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, sample: v.nodes[0]?.target?.join(" ").slice(0, 120) }));
    }
  } catch (e) {
    res.errors.push(String(e).slice(0, 300));
  } finally {
    page.off("console", onConsole);
    page.off("response", onResp);
  }
  return res;
}

const browser = await chromium.launch();
const results = [];
const ONLY = process.env.VIEWPORT; // "desktop" | "mobile"; vacío = ambos
for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  if (ONLY && ONLY !== vpName) continue;
  const ctx = await browser.newContext({ viewport, locale: "es", isMobile: vpName === "mobile", hasTouch: vpName === "mobile" });
  const page = await ctx.newPage();
  await login(page);
  const routes = STATIC.map((r) => `/client/${r}`);
  // descubrir rutas dinámicas desde las listas
  for (const [list, prefix] of [["/client/jobs", "/client/jobs/"], ["/client/projects", "/client/projects/"]]) {
    await page.goto(`${BASE}${list}`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href"))).catch(() => []);
    const hit = hrefs.find((h) => h?.startsWith(prefix) && !h.endsWith("/new") && h.split("/").length === 4);
    if (hit) {
      routes.push(hit);
      if (prefix.includes("jobs")) routes.push(`${hit}/timeline`, `${hit}/rate`);
      else routes.push(`${hit}/copilot`);
    }
  }
  const only = process.env.ONLY_ROUTES?.split(","); // p.ej. /client/jobs/job_demo_005,/client/payments
  for (const route of only ?? routes) {
    const r = await audit(page, vpName, route);
    results.push(r);
    console.log(`${vpName.padEnd(7)} ${route.padEnd(48)} ${r.status ?? "ERR"} ${String(r.loadMs ?? "-").padStart(5)}ms  axe:${r.axe?.length ?? "-"} err:${r.consoleErrors.length + r.failedRequests.length}`);
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
console.log(`\nGuardado en ${OUT}/results.json`);
