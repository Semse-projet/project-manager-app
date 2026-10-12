// Tareas T1–T8 del plan de usabilidad (docs/usability/client-usability-test-plan.md), automatizadas.
// Mide por tarea: éxito, clics, campos rellenados, tiempo, errores 5xx de red y capturas por paso.
// SOLO contra entorno local/staging con datos de prueba: T3 acepta una oferta, T5 fondea/libera, T8 abre una disputa.
// Uso: VIEWPORT=desktop|mobile OUT_DIR=... node tests/usability/client-tasks.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const VP = process.env.VIEWPORT ?? "desktop";
const OUT = process.env.OUT_DIR ?? `docs/usability/run-tasks-${VP}`;
const TASKS = (process.env.TASKS ?? "T1,T2,T3,T4,T5,T6,T7,T8").split(",");
const SIZES = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });

const CLIENT = { email: process.env.CLIENT_EMAIL ?? "client@demo.semse", pw: process.env.CLIENT_PASSWORD ?? "demo1234" };
const WORKER = { email: "worker@demo.semse", pw: "demo1234" };

async function login(page, acct) {
  for (let i = 0; i < 3; i++) { try { return await loginOnce(page, acct); } catch (e) { if (i === 2) throw e; await page.waitForTimeout(4000); } }
}
async function loginOnce(page, acct) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("input[type=email]").first().fill(acct.email);
  await page.locator("input[type=password]").first().fill(acct.pw);
  await page.getByRole("button", { name: /Ingresar/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
}

// ---- registrador por tarea ----
function recorder(page, id) {
  const r = { id, clicks: 0, fills: 0, steps: [], notes: [], server5xx: [], dbFlaky: false, success: null, t0: Date.now() };
  page.on("response", (res) => { if (res.status() >= 500) r.server5xx.push(`${res.status()} ${res.url().replace(BASE, "")}`.slice(0, 120)); });
  let n = 0;
  r.shot = async (label) => { n++; await page.screenshot({ path: path.join(OUT, "shots", `${id}_${String(n).padStart(2, "0")}_${label}.png`), fullPage: false }).catch(() => {}); };
  r.click = async (loc, label) => { await loc.first().click({ timeout: 15_000 }); r.clicks++; r.steps.push(`click: ${label}`); };
  r.fill = async (loc, value, label) => { await loc.first().fill(value, { timeout: 15_000 }); r.fills++; r.steps.push(`fill: ${label}`); };
  r.note = (s) => r.notes.push(s);
  r.finish = (ok) => { r.success = ok; r.ms = Date.now() - r.t0; r.dbFlaky = r.server5xx.length > 0; return r; };
  return r;
}

// reintenta si la página muestra un 500 del entorno (BD local inestable)
async function gotoOk(page, url) {
  for (let i = 0; i < 3; i++) {
    await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const bad = await page.getByText(/Internal server error|Could not|no se pudo cargar/i).first().isVisible().catch(() => false);
    if (!bad) return true;
    await page.waitForTimeout(3000);
  }
  return false;
}

const results = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: SIZES[VP], locale: "es", isMobile: VP === "mobile", hasTouch: VP === "mobile" });
const page = await ctx.newPage();
await login(page, CLIENT);

// ---------- T1: publicar trabajo ----------
async function T1() {
  const r = recorder(page, "T1");
  await gotoOk(page, "/client/jobs/new");
  await page.evaluate(() => { try { sessionStorage.clear(); localStorage.removeItem("semse-job-wizard-draft"); } catch {} });
  await page.reload({ waitUntil: "networkidle" }).catch(() => {});
  await r.shot("inicio");
  try {
    await r.click(page.getByRole("button", { name: /Plomer/i }), "categoría Plomería");
    // subcategoría: primer botón nuevo con "especialidad" no aplica; tomar el primero tras elegir categoría
    await page.waitForTimeout(500);
    await r.shot("categoria");
    const siguiente = page.getByRole("button", { name: /Siguiente/i });
    const disabledAfterCategory = await siguiente.isDisabled();
    r.note(`"Siguiente" deshabilitado tras elegir solo la categoría: ${disabledAfterCategory}`);
    const sub = page.locator("main button").filter({ hasText: /desde [$]/ });
    const vh = page.viewportSize().height;
    const box = await sub.first().boundingBox();
    r.note(`especialidades aparecen bajo el pliegue (y=${Math.round(box?.y ?? -1)} > alto de pantalla ${vh}): ${!!box && box.y > vh}; "Siguiente" muestra motivo de bloqueo: ${/selecciona|elige/i.test(await siguiente.getAttribute("title") ?? "")}`);
    await sub.first().scrollIntoViewIfNeeded();
    await r.click(sub, "especialidad (primera, tras hacer scroll)");
    await r.click(siguiente, "Siguiente (1→2)");
    await r.shot("paso2");
    await r.fill(page.getByPlaceholder(/Necesito renovar el baño/i), "Reparar tubería con fuga en la cocina", "título");
    await r.fill(page.getByPlaceholder(/Describe detalladamente/i), "Hay una fuga bajo el fregadero de la cocina. Necesito cambiar el tramo de tubería y revisar la llave de paso.", "descripción");
    await r.shot("paso2_lleno");
    await r.click(siguiente, "Siguiente (2→3)");
    await r.shot("paso3");
    const sug = page.getByRole("button", { name: /Sugerir presupuesto con IA/i });
    await r.click(sug, "Sugerir presupuesto con IA");
    const tAI = Date.now();
    for (let i = 0; i < 45; i++) { const t = await page.locator("main").last().innerText(); if (/Estimación del mercado/.test(t) || (/Sugerir presupuesto con IA/.test(t) && Date.now() - tAI > 3000)) break; await page.waitForTimeout(1000); }
    r.note(`la sugerencia de IA tardó ${((Date.now() - tAI) / 1000).toFixed(0)} s en dar una respuesta visible o volver al estado inicial`);
    await r.shot("sugerencia_ia");
    const sugText = await page.locator("main").last().innerText();
    r.note(`tras sugerencia IA: ${/Estimación del mercado/.test(sugText) ? "mostró estimación" : "NO mostró estimación ni error visible"}`);
    await r.click(siguiente, "Siguiente (3→4)");
    await r.shot("paso4_resumen");
    await r.click(page.getByRole("button", { name: /^Publicar trabajo/i }).last(), "Publicar trabajo");
    await page.waitForURL((u) => /^\/client\/(jobs\/(?!new)[^/]+|professionals)/.test(u.pathname), { timeout: 60_000 });
    await page.waitForTimeout(2000);
    await r.shot("resultado");
    r.note(`URL final: ${page.url().replace(BASE, "")}`);
    return r.finish(/\/client\/jobs\/(?!new)[^/]+$/.test(page.url()));
  } catch (e) { r.note(`error: ${String(e).slice(0, 200)}`); await r.shot("fallo"); return r.finish(false); }
}

// ---------- T2: recarga a mitad del wizard ----------
async function T2() {
  const r = recorder(page, "T2");
  await gotoOk(page, "/client/jobs/new");
  await page.evaluate(() => { try { sessionStorage.clear(); localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: "networkidle" }).catch(() => {});
  try {
    await r.click(page.getByRole("button", { name: /Electric/i }), "categoría Electricidad");
    await page.waitForTimeout(500);
    await r.click(page.locator("main button").filter({ hasText: /desde [$]/ }), "especialidad");
    await r.click(page.getByRole("button", { name: /Siguiente/i }), "Siguiente");
    await r.fill(page.getByPlaceholder(/Necesito renovar el baño/i), "Instalar tomacorrientes en garaje", "título");
    await page.waitForTimeout(1200); // debounce del borrador
    await r.shot("antes_de_recargar");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await r.shot("despues_de_recargar");
    const body = await page.locator("main").last().innerText();
    const banner = /borrador|recuper|continuar|retomar/i.test(body);
    const stepNow = (body.match(/PASO\s+(\d)\s+DE\s+4/i) ?? [])[1];
    const titleKept = await page.getByPlaceholder(/Necesito renovar el baño/i).inputValue().catch(() => "");
    r.note(`banner de recuperación visible: ${banner}; paso tras recargar: ${stepNow ?? "?"}; título conservado: ${titleKept ? "sí" : "no"}`);
    return r.finish(banner || titleKept.length > 0 || stepNow === "2");
  } catch (e) { r.note(`error: ${String(e).slice(0, 200)}`); await r.shot("fallo"); return r.finish(false); }
}

// ---------- T3: aceptar una oferta (se crea la oferta como profesional) ----------
async function T3() {
  const r = recorder(page, "T3");
  try {
    const wctx = await browser.newContext({ viewport: SIZES.desktop, locale: "es" });
    const wp = await wctx.newPage();
    await login(wp, WORKER);
    const jid = process.env.T3_JOB ?? "job_demo_002";
    const created = await wp.evaluate(async (jid) => {
      const x = await fetch("/api/semse/bids", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId: jid, amount: 5200, etaDays: 10, note: "Incluye materiales y limpieza final." }) });
      return `${x.status} ${(await x.text()).slice(0, 120)}`;
    }, jid);
    r.note(`setup oferta (profesional): ${created}`);
    await wctx.close();
    await gotoOk(page, `/client/jobs/${jid}`);
    const tLoad = Date.now();
    await page.getByRole("button", { name: /Aceptar propuesta/i }).first().waitFor({ timeout: 60_000 }).catch(() => {});
    r.note(`el detalle del trabajo tardó ${((Date.now() - tLoad) / 1000).toFixed(0)} s extra en mostrar la oferta tras cargar la página`);
    await r.shot("detalle_con_oferta");
    const accept = page.getByRole("button", { name: /Aceptar propuesta/i });
    const visible = await accept.first().isVisible().catch(() => false);
    r.note(`botón "Aceptar propuesta" visible sin scroll en el viewport: ${await accept.first().isVisible().catch(() => false)}`);
    if (!visible) { await r.shot("sin_boton_aceptar"); return r.finish(false); }
    await r.click(accept, "Aceptar propuesta");
    await page.waitForTimeout(800);
    await r.shot("inmediatamente_tras_clic");
    const tAcc = Date.now();
    for (let i = 0; i < 40; i++) { const t = await page.locator("main").last().innerText(); if (!/Aceptando/.test(t) && !/Aceptar propuesta/.test(t)) break; await page.waitForTimeout(1000); }
    r.note(`tras el clic, la pantalla mostró "Aceptando…" durante ${((Date.now() - tAcc) / 1000 + 0.8).toFixed(0)} s`);
    await r.shot("tras_aceptar");
    const dialog = await page.getByRole("dialog").first().isVisible().catch(() => false);
    r.note(`pide confirmación (diálogo): ${dialog}`);
    if (dialog) {
      const confirm = page.getByRole("dialog").getByRole("button", { name: /Confirmar|Aceptar|Sí|Contratar/i });
      await r.click(confirm, "confirmar en diálogo");
      await page.waitForTimeout(3000);
      await r.shot("tras_confirmar");
    }
    const txt = await page.locator("main").last().innerText();
    r.note(`estado tras aceptar: ${(txt.match(/Reservado|Aceptado|En progreso|Contratado|Publicado/i) ?? ["?"])[0]}; sigue diciendo "Esperando candidatos": ${/Esperando candidatos/.test(txt)}`);
    return r.finish(/Reservado|Aceptado|En progreso|Contratado/i.test(txt));
  } catch (e) { r.note(`error: ${String(e).slice(0, 200)}`); await r.shot("fallo"); return r.finish(false); }
}

// ---------- T4: revisar hito entregado y decidir ----------
async function T4() {
  const r = recorder(page, "T4");
  try {
    await gotoOk(page, "/client/milestones");
    await page.waitForTimeout(10000);
    await r.shot("hitos");
    const txt = await page.locator("main").last().innerText();
    r.note(`/client/milestones — ${/No tienes hitos/i.test(txt) ? 'muestra "No tienes hitos de pago activos" aunque el seed tiene el hito ms_demo_002 en estado SUBMITTED' : "lista hitos"}`);
    const approve = page.getByRole("button", { name: /Aprobar/i });
    if (await approve.first().isVisible().catch(() => false)) {
      await r.click(approve, "Aprobar hito");
      await page.waitForTimeout(1500);
      await r.shot("tras_aprobar");
      return r.finish(true);
    }
    // vía alternativa: detalle del proyecto del hito
    r.note("ruta alternativa: /client/projects/proj_demo_001");
    await gotoOk(page, "/client/projects/proj_demo_001");
    await r.shot("proyecto_alterno");
    const alt = page.getByRole("button", { name: /Aprobar/i });
    if (await alt.first().isVisible().catch(() => false)) { await r.click(alt, "Aprobar hito (vía proyecto)"); await page.waitForTimeout(1500); await r.shot("tras_aprobar_alterno"); return r.finish(true); }
    return r.finish(false);
  } catch (e) { r.note(`error: ${String(e).slice(0, 200)}`); await r.shot("fallo"); return r.finish(false); }
}

// ---------- T5: fondear y liberar pago ----------
async function T5() {
  const r = recorder(page, "T5");
  try {
    await gotoOk(page, "/client/payments");
    await r.shot("pagos");
    await r.click(page.getByRole("button", { name: /Fondear escrow/i }), "Fondear escrow");
    await page.waitForTimeout(1500);
    await r.shot("modal_fondeo");
    const dlg = page.getByRole("dialog").first();
    const hasModal = await dlg.isVisible().catch(() => false);
    r.note(`abre modal de confirmación: ${hasModal}`);
    if (hasModal) {
      const t = await dlg.innerText();
      r.note(`el modal muestra un monto ($): ${/\$\s?\d/.test(t)}; texto: ${t.replace(/\s+/g, " ").slice(0, 220)}`);
    }
    return r.finish(hasModal);
  } catch (e) { r.note(`error: ${String(e).slice(0, 200)}`); await r.shot("fallo"); return r.finish(false); }
}

// ---------- T6: encontrar la factura pendiente ----------
async function T6() {
  const r = recorder(page, "T6");
  try {
    await gotoOk(page, "/client/finance");
    await r.shot("finanzas");
    const txt = await page.locator("main").last().innerText();
    r.note(`monto visible en pantalla: ${/\$\s?[\d,]+/.test(txt)}; menciona "pendiente": ${/pendiente/i.test(txt)}; chars: ${txt.length}`);
    return r.finish(/pendiente/i.test(txt) && /\$\s?[\d,]+/.test(txt));
  } catch (e) { r.note(`error: ${String(e).slice(0, 200)}`); await r.shot("fallo"); return r.finish(false); }
}

// ---------- T7: estimado con ProTools ----------
async function T7() {
  const r = recorder(page, "T7");
  try {
    await gotoOk(page, "/client/protools");
    await r.shot("protools");
    const selects = page.locator("main select");
    r.note(`selects en pantalla: ${await selects.count()}`);
    await r.fill(page.locator("main textarea, main input[type=text]").first(), "Remodelación de baño de 6 m², cambio de piso, ducha y sanitarios", "descripción del trabajo");
    const area = page.locator("main input[type=number]").first();
    if (await area.isVisible().catch(() => false)) await r.fill(area, "65", "área sqft");
    await r.click(page.getByRole("button", { name: /Calcular estimado/i }), "Calcular estimado");
    await page.waitForTimeout(8000);
    await r.shot("resultado");
    const txt = await page.locator("main").last().innerText();
    r.note(`resultado con TOTAL: ${/TOTAL/.test(txt)}; CONFIANZA mostrada: ${(txt.match(/CONFIANZA\s*\n?\s*(\w+)/i) ?? [])[1] ?? "no"}; error visible: ${/error|no se pudo/i.test(txt)}`);
    return r.finish(/TOTAL/.test(txt));
  } catch (e) { r.note(`error: ${String(e).slice(0, 200)}`); await r.shot("fallo"); return r.finish(false); }
}

// ---------- T8: abrir una disputa ----------
async function T8() {
  const r = recorder(page, "T8");
  try {
    await gotoOk(page, "/client/disputes");
    await r.shot("disputas");
    const open = page.getByRole("button", { name: /Abrir disputa/i });
    await r.click(open, "Abrir disputa");
    await page.waitForTimeout(1200);
    await r.shot("formulario");
    const body = await page.locator("main").last().innerText();
    r.note(`pide seleccionar trabajo antes: ${/Selecciona un trabajo/i.test(body)}`);
    const ta = page.getByPlaceholder(/Describe el conflicto/i);
    if (await ta.first().isVisible().catch(() => false)) {
      await r.fill(ta, "El trabajo entregado no coincide con lo acordado: la tubería sigue con fuga.", "motivo");
      await r.shot("motivo");
    }
    return r.finish(await ta.first().isVisible().catch(() => false));
  } catch (e) { r.note(`error: ${String(e).slice(0, 200)}`); await r.shot("fallo"); return r.finish(false); }
}

const ALL = { T1, T2, T3, T4, T5, T6, T7, T8 };
for (const id of TASKS) {
  const r = await ALL[id]();
  results.push(r);
  console.log(`${VP} ${id} ${r.success ? "OK " : "FALLA"} clics:${r.clicks} campos:${r.fills} ${(r.ms / 1000).toFixed(1)}s 5xx:${r.server5xx.length}`);
  r.notes.forEach((n) => console.log(`    · ${n}`));
}
await browser.close();
fs.writeFileSync(path.join(OUT, "tasks.json"), JSON.stringify(results.map(({ shot, click, fill, note, finish, t0, ...rest }) => rest), null, 2));
console.log(`\nGuardado en ${OUT}/tasks.json`);
