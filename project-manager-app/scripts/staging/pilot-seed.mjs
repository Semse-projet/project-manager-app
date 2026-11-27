#!/usr/bin/env node
/**
 * Siembra sintética del piloto FieldOps / OPEN-18 — SOLO staging aislado.
 *
 * Autorización del propietario (2026-11-25, punto 3): preparar y ejecutar exclusivamente en el
 * entorno `staging` del proyecto Railway «SEMSE AgentRun 1149 Isolated QA», servicio
 * `semse-api-qa`, mediante un preDeployCommand temporal que se retira después.
 *
 * Org del piloto = la Org PRO PRINCIPAL de la cuenta PRO (su membresía ACTIVE más antigua, que es
 * la que usa el login). El login no permite cambiar de Org, así que sembrar en otra Org dejaría las
 * obras fuera de la sesión (AC-11). La cuenta WORKER se crea por INVITACIÓN (BO-03) desde esa Org,
 * de modo que su única membresía —y su Org de sesión— es la del piloto (decisión del propietario).
 *
 * Qué hace (datos sintéticos, ids fijos `pilot_seed_*`, idempotente):
 *  - Org cliente sintética en el tenant de la cuenta PRO.
 *  - Dos Jobs con Project asignado a la Org del piloto (así el reloj los considera asignados):
 *    uno ligado a una obra VERIFICADA (pin manual) y otro a una obra SIN VERIFICAR (geocodificada).
 *  - Las dos obras con su ubicación y un vínculo ACTIVE Job→obra cada una.
 *
 * Qué NO hace: no crea usuarios, contraseñas, memberships ni invitaciones; no modifica la Org del
 * PRO; no toca datos reales; no enciende flags; no lee ni imprime secretos. Nunca corre en producción.
 *
 * Modos (PILOT_SEED_MODE): `plan` (por defecto: valida la entrada y comprueba la base en SOLO
 * LECTURA, sin escribir), `apply` (escribe, idempotente) y `rollback` (borra solo filas
 * `pilot_seed_*` y los TimeEntry/GeofenceEvent sintéticos ligados a esos Jobs y obras).
 *
 * Entrada (variables de entorno del servicio, no secretas):
 *   PILOT_SEED_CONFIRM=staging-only            obligatorio para apply/rollback
 *   PILOT_SEED_PRO_EMAIL, PILOT_SEED_WORKER_EMAIL
 *   PILOT_SEED_VERIFIED_LAT, PILOT_SEED_VERIFIED_LNG, PILOT_SEED_VERIFIED_RADIUS (50–1000, def. 150)
 *   PILOT_SEED_UNVERIFIED_LAT, PILOT_SEED_UNVERIFIED_LNG
 */
import { pathToFileURL } from "node:url";

export const EXPECTED = Object.freeze({
  projectId: "dc1754a3-5563-4274-a81d-5be976911064",
  projectName: "SEMSE AgentRun 1149 Isolated QA",
  environmentName: "staging",
  serviceName: "semse-api-qa",
});

export const IDS = Object.freeze({
  clientOrg: "pilot_seed_org_client",
  jobVerified: "pilot_seed_job_verified",
  jobUnverified: "pilot_seed_job_unverified",
  projectVerified: "pilot_seed_project_verified",
  projectUnverified: "pilot_seed_project_unverified",
  worksiteVerified: "pilot_seed_ws_verified",
  worksiteUnverified: "pilot_seed_ws_unverified",
  bindingVerified: "pilot_seed_bind_verified",
  bindingUnverified: "pilot_seed_bind_unverified",
});

/** Comprueba que el proceso corre en el staging aislado autorizado. Devuelve los motivos de rechazo. */
export function guardEnvironment(env) {
  const reasons = [];
  // NODE_ENV no se comprueba: Dockerfile.api fija NODE_ENV=production también en staging (es el modo
  // de ejecución de Node, no el entorno). La identidad del despliegue la dan las variables de Railway.
  if (env.RAILWAY_PROJECT_ID !== EXPECTED.projectId) reasons.push("RAILWAY_PROJECT_ID no es el del staging aislado autorizado");
  if (env.RAILWAY_PROJECT_NAME !== EXPECTED.projectName) reasons.push("RAILWAY_PROJECT_NAME no coincide");
  if (env.RAILWAY_ENVIRONMENT_NAME !== EXPECTED.environmentName) reasons.push("RAILWAY_ENVIRONMENT_NAME no es staging");
  if (env.RAILWAY_SERVICE_NAME !== EXPECTED.serviceName) reasons.push("RAILWAY_SERVICE_NAME no es semse-api-qa");
  if (/prod/i.test(env.RAILWAY_ENVIRONMENT ?? "")) reasons.push("RAILWAY_ENVIRONMENT indica producción");
  if (!env.DATABASE_URL) reasons.push("falta DATABASE_URL");
  return reasons;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function coordinate(value, min, max, name, errors) {
  const n = Number(value);
  if (value === undefined || value === "" || !Number.isFinite(n) || n < min || n > max) {
    errors.push(`${name} debe ser un número entre ${min} y ${max}`);
    return null;
  }
  return n;
}

/** Valida la entrada. Nunca incluye los correos en los mensajes de error. */
export function parseInput(env) {
  const errors = [];
  const mode = (env.PILOT_SEED_MODE ?? "plan").trim();
  if (!["plan", "apply", "rollback"].includes(mode)) errors.push("PILOT_SEED_MODE debe ser plan, apply o rollback");
  if (mode !== "plan" && env.PILOT_SEED_CONFIRM !== "staging-only") errors.push("PILOT_SEED_CONFIRM=staging-only es obligatorio para apply y rollback");
  if (mode === "rollback") return { mode, errors };
  const proEmail = (env.PILOT_SEED_PRO_EMAIL ?? "").trim().toLowerCase();
  const workerEmail = (env.PILOT_SEED_WORKER_EMAIL ?? "").trim().toLowerCase();
  if (!EMAIL.test(proEmail)) errors.push("PILOT_SEED_PRO_EMAIL no es un correo válido");
  if (!EMAIL.test(workerEmail)) errors.push("PILOT_SEED_WORKER_EMAIL no es un correo válido");
  if (proEmail && proEmail === workerEmail) errors.push("las cuentas PRO y WORKER deben ser distintas");
  const radius = env.PILOT_SEED_VERIFIED_RADIUS ? Number(env.PILOT_SEED_VERIFIED_RADIUS) : 150;
  if (!Number.isInteger(radius) || radius < 50 || radius > 1000) errors.push("PILOT_SEED_VERIFIED_RADIUS debe ser un entero entre 50 y 1000");
  const verified = {
    latitude: coordinate(env.PILOT_SEED_VERIFIED_LAT, -90, 90, "PILOT_SEED_VERIFIED_LAT", errors),
    longitude: coordinate(env.PILOT_SEED_VERIFIED_LNG, -180, 180, "PILOT_SEED_VERIFIED_LNG", errors),
    radiusMeters: radius,
  };
  const unverified = {
    latitude: coordinate(env.PILOT_SEED_UNVERIFIED_LAT, -90, 90, "PILOT_SEED_UNVERIFIED_LAT", errors),
    longitude: coordinate(env.PILOT_SEED_UNVERIFIED_LNG, -180, 180, "PILOT_SEED_UNVERIFIED_LNG", errors),
  };
  return { mode, errors, proEmail, workerEmail, verified, unverified };
}

const mask = (email) => email.replace(/^(.).*(@.*)$/, "$1***$2");

/** Membresía principal = la ACTIVE más antigua, la misma que elige el login (auth.repository). */
async function primaryMembership(db, userId) {
  return db.membership.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { orgId: true, role: { select: { key: true } }, org: { select: { tenantId: true, type: true } } },
  });
}

/**
 * Comprobaciones en SOLO LECTURA. Devuelve { blocking, worker, pilot, existing }.
 * - PRO: existe, activa, y su membresía principal es de rol PRO en una Org PRO → Org del piloto.
 * - WORKER: si aún no existe, queda pendiente de la invitación (no bloquea la siembra). Si existe,
 *   su membresía principal debe ser WORKER en la Org del piloto; si no, bloquea.
 */
export async function inspect(db, input) {
  const blocking = [];
  const pro = await db.user.findUnique({ where: { email: input.proEmail }, select: { id: true, status: true } });
  let pilot = null;
  if (!pro) blocking.push(`La cuenta PRO (${mask(input.proEmail)}) no existe en staging: regístrala antes de sembrar`);
  else if (pro.status !== "active") blocking.push(`La cuenta PRO (${mask(input.proEmail)}) no está activa`);
  else {
    const m = await primaryMembership(db, pro.id);
    if (!m) blocking.push("La cuenta PRO no tiene membresías activas");
    else if (m.role.key !== "PRO" || m.org.type !== "PRO") blocking.push(`La Org de sesión de la cuenta PRO no es una Org PRO con rol PRO (rol ${m.role.key}, tipo ${m.org.type})`);
    else pilot = { proUserId: pro.id, orgId: m.orgId, tenantId: m.org.tenantId };
  }
  let worker = "pending_invitation";
  const w = await db.user.findUnique({ where: { email: input.workerEmail }, select: { id: true, status: true } });
  if (w) {
    const m = await primaryMembership(db, w.id);
    if (w.status !== "active") blocking.push(`La cuenta WORKER (${mask(input.workerEmail)}) no está activa`);
    else if (!pilot || !m || m.orgId !== pilot.orgId || m.role.key !== "WORKER") {
      blocking.push(`La Org de sesión de la cuenta WORKER (${mask(input.workerEmail)}) no es WORKER en la Org del piloto: créala por invitación del PRO (BO-03), no por registro público`);
    } else worker = "ready";
  }
  const existing = {
    jobs: await db.job.count({ where: { id: { in: [IDS.jobVerified, IDS.jobUnverified] } } }),
    worksites: await db.worksite.count({ where: { id: { in: [IDS.worksiteVerified, IDS.worksiteUnverified] } } }),
  };
  if (pilot) {
    const foreign = await db.worksite.count({ where: { id: { in: [IDS.worksiteVerified, IDS.worksiteUnverified] }, orgId: { not: pilot.orgId } } });
    if (foreign) blocking.push("Hay obras pilot_seed_* de otra Org: ejecuta rollback antes de sembrar con otra cuenta PRO");
  }
  return { blocking, worker, pilot, existing };
}

async function apply(prisma, input, pilot) {
  const { tenantId, orgId, proUserId } = pilot;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.org.upsert({ where: { id: IDS.clientOrg }, update: {}, create: { id: IDS.clientOrg, tenantId, type: "CLIENT", name: "Cliente piloto (sintético)" } });
    const sites = [
      { job: IDS.jobVerified, project: IDS.projectVerified, ws: IDS.worksiteVerified, bind: IDS.bindingVerified,
        title: "Piloto — obra verificada (sintético)", wsName: "Obra piloto verificada", loc: input.verified, verifiedLocation: true },
      { job: IDS.jobUnverified, project: IDS.projectUnverified, ws: IDS.worksiteUnverified, bind: IDS.bindingUnverified,
        title: "Piloto — obra sin verificar (sintético)", wsName: "Obra piloto sin verificar", loc: { ...input.unverified, radiusMeters: 150 }, verifiedLocation: false },
    ];
    for (const s of sites) {
      await tx.job.upsert({ where: { id: s.job }, update: {}, create: { id: s.job, tenantId, clientOrgId: IDS.clientOrg, title: s.title, scope: "Datos sintéticos del piloto FieldOps en staging", status: "IN_PROGRESS" } });
      await tx.project.upsert({ where: { id: s.project }, update: {}, create: { id: s.project, tenantId, jobId: s.job, assignedProOrgId: orgId } });
      const location = {
        latitude: s.loc.latitude, longitude: s.loc.longitude, radiusMeters: s.loc.radiusMeters,
        locationSource: s.verifiedLocation ? "manual_pin" : "geocoded",
        locationVerifiedAt: s.verifiedLocation ? now : null,
        locationVerifiedBy: s.verifiedLocation ? proUserId : null,
      };
      await tx.worksite.upsert({ where: { id: s.ws }, update: location, create: { id: s.ws, tenantId, orgId, name: s.wsName, createdBy: proUserId, ...location } });
      const activeTargetKey = `${tenantId}:JOB:${s.job}`;
      await tx.worksiteBinding.upsert({
        where: { id: s.bind },
        update: {},
        create: { id: s.bind, tenantId, orgId, worksiteId: s.ws, kind: "JOB", jobId: s.job, activeTargetKey, createdBy: proUserId },
      });
    }
  }, { timeout: 30_000 });
  return { tenantId, pilotOrgId: orgId, pro: mask(input.proEmail), worker: mask(input.workerEmail) };
}

async function rollback(prisma) {
  const jobs = [IDS.jobVerified, IDS.jobUnverified];
  const worksites = [IDS.worksiteVerified, IDS.worksiteUnverified];
  return prisma.$transaction(async (tx) => {
    const removed = {};
    removed.timeEntries = (await tx.timeEntry.deleteMany({ where: { jobId: { in: jobs } } })).count;
    removed.geofenceEvents = (await tx.geofenceEvent.deleteMany({ where: { worksiteId: { in: worksites } } })).count;
    removed.bindings = (await tx.worksiteBinding.deleteMany({ where: { id: { in: [IDS.bindingVerified, IDS.bindingUnverified] } } })).count;
    removed.worksites = (await tx.worksite.deleteMany({ where: { id: { in: worksites } } })).count;
    removed.projects = (await tx.project.deleteMany({ where: { id: { in: [IDS.projectVerified, IDS.projectUnverified] } } })).count;
    removed.jobs = (await tx.job.deleteMany({ where: { id: { in: jobs } } })).count;
    removed.orgs = (await tx.org.deleteMany({ where: { id: IDS.clientOrg } })).count;
    return removed;
  }, { timeout: 30_000 });
}

export async function main(env = process.env) {
  const refused = guardEnvironment(env);
  if (refused.length) {
    console.error(`[pilot-seed] RECHAZADO, no se escribe nada: ${refused.join("; ")}`);
    return 2;
  }
  const input = parseInput(env);
  if (input.errors.length) {
    console.error(`[pilot-seed] entrada inválida, no se escribe nada: ${input.errors.join("; ")}`);
    return 2;
  }
  const { PrismaClient } = (await import("@prisma/client")).default ?? (await import("@prisma/client"));
  const prisma = new PrismaClient();
  try {
    if (input.mode === "rollback") {
      const removed = await rollback(prisma);
      console.log(JSON.stringify({ pilotSeed: "rollback", ok: true, at: new Date().toISOString(), removed }));
      return 0;
    }
    const check = await inspect(prisma, input);
    const report = { ids: IDS, verified: input.verified, unverified: input.unverified, pro: mask(input.proEmail),
      worker: mask(input.workerEmail), workerAccount: check.worker, pilotOrgId: check.pilot?.orgId ?? null, existing: check.existing };
    if (check.blocking.length) {
      console.error(`[pilot-seed] ${input.mode} bloqueado, no se escribe nada: ${check.blocking.join("; ")}`);
      console.log(JSON.stringify({ pilotSeed: input.mode, ok: false, ...report }));
      return 1;
    }
    if (input.mode === "plan") {
      console.log(JSON.stringify({ pilotSeed: "plan", ok: true, readOnly: true, ...report }));
      return 0;
    }
    const result = await apply(prisma, input, check.pilot);
    console.log(JSON.stringify({ pilotSeed: "apply", ok: true, at: new Date().toISOString(), workerAccount: check.worker, ...result }));
    return 0;
  } catch (error) {
    console.error(`[pilot-seed] ${input.mode} falló, la transacción se revierte: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().then((code) => { process.exitCode = code; });
}
