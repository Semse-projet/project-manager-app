#!/usr/bin/env node
// Smoke autenticado de S0 (T-062) — spec labor.free-project-mutation-guard §8.
//
// Dos usuarios de prueba A y B del MISMO tenant, con field-ops:write:
//   - A no puede leer/editar/archivar/convertir el FreeProject de B (404).
//   - El proyecto de B queda intacto y `status` en PATCH se rechaza (400).
//   - A no puede convertir su proyecto a un Job inexistente (403 genérico).
//   - A sí convierte su propio proyecto a un Job asignado (2xx), el reintento
//     es idempotente y convertir a otro Job después responde 409.
//
// Sólo crea y toca los dos proyectos "SMOKE-S0 <runId>" de esta corrida y al
// final los archiva (DELETE = archivar; nunca borra filas). No toca Jobs,
// TimeEntry ni proyectos ajenos. No imprime correos, contraseñas ni tokens.
//
// Uso (credenciales sólo por variables de entorno, nunca en argumentos):
//   SEMSE_SMOKE_API_URL=https://api.example.com \
//   SEMSE_SMOKE_A_EMAIL=... SEMSE_SMOKE_A_PASSWORD=... \
//   SEMSE_SMOKE_B_EMAIL=... SEMSE_SMOKE_B_PASSWORD=... \
//   SEMSE_SMOKE_JOB_ID=<job asignado a A> \
//   node scripts/labor-s0-free-project-smoke.mjs --yes [--out evidencia.json]
//
// Sin --yes sólo valida la configuración y muestra el plan (no escribe nada).
// Salida: 0 todo PASS · 1 algún FAIL · 2 incompleto (falta el caso P1) ·
// 3 precondición o configuración inválida.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

const SPEC = "labor.free-project-mutation-guard";
const TIMEOUT_MS = 20_000;

class PreconditionError extends Error {}

function parseArgs(argv) {
  const args = { yes: false, out: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--yes") args.yes = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--out") args.out = argv[++i] ?? null;
    else throw new PreconditionError(`Argumento desconocido: ${arg}`);
  }
  return args;
}

function readConfig(env) {
  const missing = [
    "SEMSE_SMOKE_API_URL",
    "SEMSE_SMOKE_A_EMAIL", "SEMSE_SMOKE_A_PASSWORD",
    "SEMSE_SMOKE_B_EMAIL", "SEMSE_SMOKE_B_PASSWORD",
  ].filter((name) => !env[name]?.trim());
  if (missing.length) throw new PreconditionError(`Faltan variables: ${missing.join(", ")}`);

  let base;
  try {
    base = new URL(env.SEMSE_SMOKE_API_URL);
  } catch {
    throw new PreconditionError("SEMSE_SMOKE_API_URL no es una URL válida");
  }
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(base.hostname);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && local)) {
    throw new PreconditionError("SEMSE_SMOKE_API_URL debe usar https (http sólo para localhost)");
  }
  if (env.SEMSE_SMOKE_A_EMAIL.trim().toLowerCase() === env.SEMSE_SMOKE_B_EMAIL.trim().toLowerCase()) {
    throw new PreconditionError("A y B deben ser usuarios distintos");
  }
  return {
    base,
    a: { email: env.SEMSE_SMOKE_A_EMAIL.trim(), password: env.SEMSE_SMOKE_A_PASSWORD },
    b: { email: env.SEMSE_SMOKE_B_EMAIL.trim(), password: env.SEMSE_SMOKE_B_PASSWORD },
    jobId: env.SEMSE_SMOKE_JOB_ID?.trim() || null,
  };
}

function createClient(base, runId) {
  let seq = 0;
  return async function call(method, route, { token, body } = {}) {
    seq += 1;
    const requestId = `smoke-s0-${runId}-${String(seq).padStart(2, "0")}`;
    const res = await fetch(new URL(route, base), {
      method,
      headers: {
        accept: "application/json",
        "x-request-id": requestId,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { /* cuerpo no JSON */ }
    return { status: res.status, data: payload?.data, payload, text, requestId };
  };
}

const is2xx = (status) => status >= 200 && status < 300;
// http-exception.filter envuelve getResponse() de Nest: { error: { message: { message } } }.
const errorMessage = (r) => {
  const m = r.payload?.error?.message;
  const text = typeof m === "string" ? m : m?.message;
  return typeof text === "string" ? text : "";
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Ver el encabezado de scripts/labor-s0-free-project-smoke.mjs y docs/runbooks/LABOR_S0_FREE_PROJECT_SMOKE.md");
    return 0;
  }
  const config = readConfig(process.env);
  const runId = randomUUID().replaceAll("-", "").slice(0, 10);
  const call = createClient(config.base, runId);
  const fakeJobId = `job_smoke_s0_inexistente_${runId}`;
  const otherFakeJobId = `job_smoke_s0_otro_${runId}`;

  console.log(`Smoke S0 (${SPEC}) · run ${runId} · API ${config.base.origin}`);
  console.log(`Job para P1: ${config.jobId ? "definido" : "NO definido (P1 quedará NOT_RUN)"}`);
  if (!args.yes) {
    console.log("\nModo plan: no se escribe nada. Ejecuta con --yes para correr el smoke.");
    console.log("Crea 2 FreeProject sintéticos (uno de A, uno de B), prueba los rechazos,");
    console.log("convierte el de A al Job indicado y archiva ambos al final.");
    return 0;
  }

  const checks = [];
  const record = (id, description, expected, response, pass, note = "") => {
    checks.push({ id, description, expected, actual: response?.status ?? null, pass, requestId: response?.requestId ?? null, note });
    const mark = pass ? "PASS" : "FAIL";
    console.log(`${mark}  ${id.padEnd(10)} ${description} — esperado ${expected}, obtenido ${response?.status ?? "—"}${note ? ` (${note})` : ""}`);
  };
  const expectStatus = (id, description, expected, response) => {
    const pass = expected === "2xx" ? is2xx(response.status) : response.status === expected;
    record(id, description, String(expected), response, pass);
    return pass;
  };

  const tokens = {};
  const created = { a: null, b: null };
  let p1State = "NOT_RUN";

  try {
    // ── Sesiones y precondiciones ─────────────────────────────────────────
    for (const key of ["a", "b"]) {
      const login = await call("POST", "/v1/auth/login", { body: config[key] });
      if (login.status === 429) throw new PreconditionError("Login limitado (429): espera un minuto y reintenta");
      if (!is2xx(login.status) || !login.data?.accessToken) {
        throw new PreconditionError(`Login de ${key.toUpperCase()} falló con ${login.status}`);
      }
      tokens[key] = login.data.accessToken;
    }
    const meA = await call("GET", "/v1/auth/me", { token: tokens.a });
    const meB = await call("GET", "/v1/auth/me", { token: tokens.b });
    if (!is2xx(meA.status) || !is2xx(meB.status)) throw new PreconditionError("No se pudo leer /v1/auth/me");
    if (meA.data.userId === meB.data.userId) throw new PreconditionError("A y B resuelven al mismo usuario");
    if (meA.data.tenantId !== meB.data.tenantId) throw new PreconditionError("A y B deben pertenecer al mismo tenant");
    console.log("Precondición: A y B son usuarios distintos del mismo tenant.\n");

    if (config.jobId) {
      const jobs = await call("GET", "/v1/time-tracker/jobs", { token: tokens.a });
      const ids = Array.isArray(jobs.data) ? jobs.data.map((job) => job?.id) : [];
      if (!ids.includes(config.jobId)) {
        throw new PreconditionError("SEMSE_SMOKE_JOB_ID no aparece entre los trabajos asignados a A (/v1/time-tracker/jobs)");
      }
    }

    // ── Proyectos sintéticos ──────────────────────────────────────────────
    const nameB = `SMOKE-S0 ${runId} B`;
    const createB = await call("POST", "/v1/labor/free-projects", { token: tokens.b, body: { name: nameB, color: "#64748b" } });
    if (!is2xx(createB.status) || !createB.data?.id) throw new PreconditionError(`B no pudo crear su proyecto (${createB.status})`);
    created.b = createB.data.id;
    const createA = await call("POST", "/v1/labor/free-projects", { token: tokens.a, body: { name: `SMOKE-S0 ${runId} A`, color: "#64748b" } });
    if (!is2xx(createA.status) || !createA.data?.id) throw new PreconditionError(`A no pudo crear su proyecto (${createA.status})`);
    created.a = createA.data.id;

    // ── A contra el proyecto de B: todo 404, sin filtrar datos ───────────
    const pathB = `/v1/labor/free-projects/${encodeURIComponent(created.b)}`;
    const readLeak = await call("PATCH", pathB, { token: tokens.a, body: {} });
    record("N1-lectura", "A: PATCH vacío al proyecto de B no devuelve sus datos", "404", readLeak,
      readLeak.status === 404 && !readLeak.text.includes(nameB));
    expectStatus("N1", "A: PATCH name al proyecto de B", 404,
      await call("PATCH", pathB, { token: tokens.a, body: { name: `SMOKE-S0 ${runId} alterado` } }));
    expectStatus("N2", "A: DELETE (archivar) el proyecto de B", 404,
      await call("DELETE", pathB, { token: tokens.a }));
    expectStatus("N1-conv", "A: convertir el proyecto de B", 404,
      await call("POST", `${pathB}/convert`, { token: tokens.a, body: { jobId: config.jobId ?? fakeJobId } }));

    const listB = await call("GET", "/v1/labor/free-projects", { token: tokens.b });
    const ownB = Array.isArray(listB.data) ? listB.data.find((p) => p?.id === created.b) : null;
    record("B-intacto", "El proyecto de B sigue igual (nombre, active, sin Job)", "sin cambios", listB,
      Boolean(ownB) && ownB.name === nameB && ownB.status === "active" && !ownB.convertedJobId);

    // ── Contrato de PATCH y edición propia ────────────────────────────────
    expectStatus("N12", "B: PATCH con status es rechazado", 400,
      await call("PATCH", pathB, { token: tokens.b, body: { status: "archived" } }));
    expectStatus("Propio", "B: editar su propio proyecto sigue funcionando", "2xx",
      await call("PATCH", pathB, { token: tokens.b, body: { name: `${nameB} editado` } }));

    // ── Destino de la conversión ──────────────────────────────────────────
    const pathA = `/v1/labor/free-projects/${encodeURIComponent(created.a)}`;
    const invalidJob = await call("POST", `${pathA}/convert`, { token: tokens.a, body: { jobId: fakeJobId } });
    record("N5", "A: convertir su proyecto a un Job inexistente", "403", invalidJob,
      invalidJob.status === 403 && errorMessage(invalidJob) === "This job is not assigned to you.");

    if (config.jobId) {
      const convert = await call("POST", `${pathA}/convert`, { token: tokens.a, body: { jobId: config.jobId } });
      const converted = is2xx(convert.status) && convert.data?.status === "converted" && convert.data?.convertedJobId === config.jobId;
      record("P1", "A: convertir su proyecto a un Job asignado", "2xx + converted", convert, converted);
      const retry = await call("POST", `${pathA}/convert`, { token: tokens.a, body: { jobId: config.jobId } });
      record("P2", "A: reintento al mismo Job es idempotente", "2xx", retry,
        is2xx(retry.status) && retry.data?.convertedJobId === config.jobId);
      expectStatus("N9", "A: reconvertir a otro Job", 409,
        await call("POST", `${pathA}/convert`, { token: tokens.a, body: { jobId: otherFakeJobId } }));
      p1State = converted ? "RUN" : "FAILED";
    } else {
      console.log("SKIP  P1/P2/N9   sin SEMSE_SMOKE_JOB_ID");
    }
  } finally {
    // ── Limpieza: sólo los proyectos de esta corrida; archivar, nunca borrar ─
    for (const key of ["b", "a"]) {
      if (!created[key] || !tokens[key]) continue;
      const path = `/v1/labor/free-projects/${encodeURIComponent(created[key])}`;
      try {
        const archived = await call("DELETE", path, { token: tokens[key] });
        if (key === "b") {
          expectStatus("Archivar", "B: archivar su proyecto", "2xx", archived);
          expectStatus("P2-arch", "B: archivar de nuevo es idempotente", "2xx", await call("DELETE", path, { token: tokens.b }));
        } else if (!is2xx(archived.status)) {
          console.log(`WARN  no se pudo archivar el proyecto de A (${archived.status}); id ${created.a}`);
        }
      } catch (error) {
        console.log(`WARN  limpieza del proyecto de ${key.toUpperCase()} falló: ${error.message}`);
      }
    }
    for (const key of ["a", "b"]) {
      if (tokens[key]) await call("POST", "/v1/auth/logout", { token: tokens[key] }).catch(() => undefined);
    }
  }

  const failed = checks.filter((c) => !c.pass);
  const verdict = failed.length ? "FAIL" : p1State === "NOT_RUN" ? "INCOMPLETE" : "PASS";
  const evidence = {
    spec: SPEC,
    task: "T-062",
    runId,
    executedAt: new Date().toISOString(),
    apiOrigin: config.base.origin,
    sameTenant: true,
    p1: p1State,
    syntheticProjects: created,
    checks,
    verdict,
  };
  console.log(`\nResultado: ${verdict} (${checks.length - failed.length}/${checks.length} PASS)`);
  if (args.out) {
    writeFileSync(args.out, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    console.log(`Evidencia sin datos personales: ${args.out}`);
  }
  return verdict === "PASS" ? 0 : verdict === "INCOMPLETE" ? 2 : 1;
}

main().then(
  (code) => { process.exitCode = code; },
  (error) => {
    if (error instanceof PreconditionError) {
      console.error(`Precondición: ${error.message}`);
      process.exitCode = 3;
    } else {
      console.error(`Error inesperado: ${error?.message ?? error}`);
      process.exitCode = 1;
    }
  },
);
