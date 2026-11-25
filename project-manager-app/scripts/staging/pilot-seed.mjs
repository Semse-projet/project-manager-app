#!/usr/bin/env node
/**
 * Siembra sintética del piloto FieldOps / OPEN-18 — SOLO staging aislado.
 *
 * Autorización del propietario (2026-11-25, punto 3): preparar y ejecutar exclusivamente en el
 * entorno `staging` del proyecto Railway «SEMSE AgentRun 1149 Isolated QA», servicio
 * `semse-api-qa`, mediante un preDeployCommand temporal que se retira después.
 *
 * Qué hace (datos sintéticos, ids fijos `pilot_seed_*`, idempotente):
 *  - Org profesional «Piloto FieldOps (sintético)» y Org cliente sintética, en el tenant de la
 *    cuenta PRO.
 *  - Memberships ACTIVE: cuenta PRO → PRO, cuenta WORKER → WORKER, en la Org del piloto.
 *  - Dos Jobs con Project asignado a la Org del piloto (así el reloj los considera asignados):
 *    uno ligado a una obra VERIFICADA (pin manual) y otro a una obra SIN VERIFICAR (geocodificada).
 *  - Las dos obras con su ubicación y un vínculo ACTIVE Job→obra cada una.
 *
 * Qué NO hace: no crea usuarios ni contraseñas (las dos cuentas las registra el propietario),
 * no toca datos reales, no enciende flags, no lee ni imprime secretos. Nunca corre en producción.
 *
 * Modos (PILOT_SEED_MODE): `plan` (por defecto: valida y muestra lo que haría, sin escribir),
 * `apply` (escribe, idempotente) y `rollback` (borra solo filas `pilot_seed_*` y los
 * TimeEntry/GeofenceEvent sintéticos ligados a esos Jobs y obras).
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
  proOrg: "pilot_seed_org_pro",
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
  if ((env.NODE_ENV ?? "").trim().toLowerCase() === "production") reasons.push("NODE_ENV=production");
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

async function activeUser(prisma, email, label) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, status: true } });
  if (!user) throw new Error(`La cuenta ${label} (${mask(email)}) no existe en staging: regístrala antes de sembrar`);
  if (user.status !== "active") throw new Error(`La cuenta ${label} (${mask(email)}) no está activa`);
  return user;
}

async function resolveTenant(prisma, proUserId) {
  const rows = await prisma.membership.findMany({
    where: { userId: proUserId, status: "ACTIVE", orgId: { not: IDS.proOrg } },
    select: { org: { select: { tenantId: true } } },
  });
  const tenants = [...new Set(rows.map((r) => r.org.tenantId))];
  if (tenants.length !== 1) throw new Error(`La cuenta PRO debe pertenecer a exactamente un tenant (encontrados: ${tenants.length})`);
  return tenants[0];
}

async function role(tx, key) {
  return tx.role.upsert({ where: { key }, update: {}, create: { key, name: key } });
}

async function apply(prisma, input) {
  const pro = await activeUser(prisma, input.proEmail, "PRO");
  const worker = await activeUser(prisma, input.workerEmail, "WORKER");
  const tenantId = await resolveTenant(prisma, pro.id);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const [proRole, workerRole] = [await role(tx, "PRO"), await role(tx, "WORKER")];
    await tx.org.upsert({ where: { id: IDS.proOrg }, update: {}, create: { id: IDS.proOrg, tenantId, type: "PRO", name: "Piloto FieldOps (sintético)" } });
    await tx.org.upsert({ where: { id: IDS.clientOrg }, update: {}, create: { id: IDS.clientOrg, tenantId, type: "CLIENT", name: "Cliente piloto (sintético)" } });
    for (const [userId, roleId] of [[pro.id, proRole.id], [worker.id, workerRole.id]]) {
      await tx.membership.upsert({
        where: { userId_orgId_roleId: { userId, orgId: IDS.proOrg, roleId } },
        update: { status: "ACTIVE" },
        create: { userId, orgId: IDS.proOrg, roleId, status: "ACTIVE" },
      });
    }
    const sites = [
      { job: IDS.jobVerified, project: IDS.projectVerified, ws: IDS.worksiteVerified, bind: IDS.bindingVerified,
        title: "Piloto — obra verificada (sintético)", wsName: "Obra piloto verificada", loc: input.verified, verifiedLocation: true },
      { job: IDS.jobUnverified, project: IDS.projectUnverified, ws: IDS.worksiteUnverified, bind: IDS.bindingUnverified,
        title: "Piloto — obra sin verificar (sintético)", wsName: "Obra piloto sin verificar", loc: { ...input.unverified, radiusMeters: 150 }, verifiedLocation: false },
    ];
    for (const s of sites) {
      await tx.job.upsert({ where: { id: s.job }, update: {}, create: { id: s.job, tenantId, clientOrgId: IDS.clientOrg, title: s.title, scope: "Datos sintéticos del piloto FieldOps en staging", status: "IN_PROGRESS" } });
      await tx.project.upsert({ where: { id: s.project }, update: {}, create: { id: s.project, tenantId, jobId: s.job, assignedProOrgId: IDS.proOrg } });
      const location = {
        latitude: s.loc.latitude, longitude: s.loc.longitude, radiusMeters: s.loc.radiusMeters,
        locationSource: s.verifiedLocation ? "manual_pin" : "geocoded",
        locationVerifiedAt: s.verifiedLocation ? now : null,
        locationVerifiedBy: s.verifiedLocation ? pro.id : null,
      };
      await tx.worksite.upsert({ where: { id: s.ws }, update: location, create: { id: s.ws, tenantId, orgId: IDS.proOrg, name: s.wsName, createdBy: pro.id, ...location } });
      const activeTargetKey = `${tenantId}:JOB:${s.job}`;
      await tx.worksiteBinding.upsert({
        where: { id: s.bind },
        update: {},
        create: { id: s.bind, tenantId, orgId: IDS.proOrg, worksiteId: s.ws, kind: "JOB", jobId: s.job, activeTargetKey, createdBy: pro.id },
      });
    }
  }, { timeout: 30_000 });
  return { tenantId, pro: mask(input.proEmail), worker: mask(input.workerEmail) };
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
    removed.memberships = (await tx.membership.deleteMany({ where: { orgId: IDS.proOrg } })).count;
    removed.orgs = (await tx.org.deleteMany({ where: { id: { in: [IDS.proOrg, IDS.clientOrg] } } })).count;
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
  if (input.mode === "plan") {
    console.log(JSON.stringify({ pilotSeed: "plan", ids: IDS, verified: input.verified, unverified: input.unverified,
      pro: mask(input.proEmail), worker: mask(input.workerEmail) }));
    return 0;
  }
  const { PrismaClient } = (await import("@prisma/client")).default ?? (await import("@prisma/client"));
  const prisma = new PrismaClient();
  try {
    const result = input.mode === "apply" ? await apply(prisma, input) : await rollback(prisma);
    console.log(JSON.stringify({ pilotSeed: input.mode, ok: true, at: new Date().toISOString(), ...result }));
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
