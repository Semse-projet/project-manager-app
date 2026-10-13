/**
 * Hotfix DEC-R1 — restaura las membresías de la identidad de servicio del worker.
 *
 * Contexto: desde #877 (`902e4d59`) la API exige, por request, una sesión durable
 * Y una membresía ACTIVE por cada rol en la org de la sesión. El worker
 * (`SEMSE_USER_ID=usr_worker_system`, `SEMSE_ORG_ID=org_admin_001`) obtiene su
 * token con el bootstrap token y roles OPS_ADMIN,WORKER,EVENT_CONSUMER, pero el
 * seed solo crea el User, nunca sus memberships -> 401 "No active organization
 * permission" en cada llamada.
 *
 * Este script NO cambia la lógica de auth ni salta el chequeo: crea las
 * membresías reales que #877 exige. Es idempotente y por defecto solo muestra
 * el plan (dry-run). Solo escribe con --apply.
 *
 * Uso (el DATABASE_URL se lee del entorno; nunca se imprime):
 *   node scripts/ops/ensure-worker-service-membership.mjs            # dry-run
 *   node scripts/ops/ensure-worker-service-membership.mjs --apply    # escribe
 *
 * Límites duros: solo el usuario `usr_worker_system`, solo la org indicada
 * (debe existir y pertenecer al tenant), solo roles OPS_ADMIN/WORKER/EVENT_CONSUMER.
 * No crea User, Org ni Tenant: si faltan, aborta.
 */

export const SERVICE_USER_ID = "usr_worker_system";
export const ALLOWED_ROLES = ["OPS_ADMIN", "WORKER", "EVENT_CONSUMER"];

/**
 * Función pura: dado el estado leído de la BD, devuelve qué falta hacer o por
 * qué se debe abortar. No toca la BD.
 */
export function planServiceMembership({ userId, tenantId, orgId, roles, state }) {
  if (userId !== SERVICE_USER_ID) {
    return { ok: false, reason: `solo se permite ${SERVICE_USER_ID}` };
  }
  const wanted = [...new Set(roles)].filter(Boolean);
  if (!wanted.length || wanted.some((r) => !ALLOWED_ROLES.includes(r))) {
    return { ok: false, reason: `roles permitidos: ${ALLOWED_ROLES.join(", ")}` };
  }
  if (!state.user) return { ok: false, reason: "el User no existe (no se crea)" };
  if (state.user.status !== "active") {
    return { ok: false, reason: `el User está '${state.user.status}', no 'active'` };
  }
  if (!state.org) return { ok: false, reason: "la Org no existe (no se crea)" };
  if (state.org.tenantId !== tenantId) {
    return { ok: false, reason: "la Org pertenece a otro tenant" };
  }

  const existingActive = new Set(state.memberships.filter((m) => m.status === "ACTIVE").map((m) => m.roleKey));
  const existingInactive = new Set(state.memberships.filter((m) => m.status !== "ACTIVE").map((m) => m.roleKey));
  const known = new Set(state.roleKeys);
  return {
    ok: true,
    createRoles: wanted.filter((r) => !known.has(r)),
    createMemberships: wanted.filter((r) => !existingActive.has(r) && !existingInactive.has(r)),
    // Una membresía SUSPENDED/REVOKED es una decisión humana: no se reactiva sola.
    skippedNonActive: wanted.filter((r) => existingInactive.has(r)),
    alreadyActive: wanted.filter((r) => existingActive.has(r)),
  };
}

export async function readState(prisma, { userId, orgId }) {
  const [user, org, memberships, roles] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { status: true } }),
    prisma.org.findUnique({ where: { id: orgId }, select: { tenantId: true } }),
    prisma.membership.findMany({
      where: { userId, orgId },
      select: { status: true, role: { select: { key: true } } },
    }),
    prisma.role.findMany({ where: { key: { in: ALLOWED_ROLES } }, select: { key: true } }),
  ]);
  return {
    user,
    org,
    memberships: memberships.map((m) => ({ status: m.status, roleKey: m.role.key })),
    roleKeys: roles.map((r) => r.key),
  };
}

export async function applyPlan(prisma, { userId, orgId }, plan) {
  await prisma.$transaction(async (tx) => {
    for (const key of plan.createRoles) {
      await tx.role.upsert({ where: { key }, update: {}, create: { key, name: key } });
    }
    for (const key of plan.createMemberships) {
      const role = await tx.role.findUniqueOrThrow({ where: { key }, select: { id: true } });
      await tx.membership.upsert({
        where: { userId_orgId_roleId: { userId, orgId, roleId: role.id } },
        update: {},
        create: { userId, orgId, roleId: role.id, status: "ACTIVE" },
      });
    }
  });
}

async function main() {
  const apply = process.argv.includes("--apply");
  const userId = process.env.SEMSE_USER_ID ?? SERVICE_USER_ID;
  const tenantId = process.env.SEMSE_TENANT_ID ?? "tenant_default";
  const orgId = process.env.SEMSE_ORG_ID ?? "org_admin_001";
  const roles = (process.env.SEMSE_ROLES ?? ALLOWED_ROLES.join(",")).split(",").map((r) => r.trim());

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL es obligatorio");
  const module = await import("@prisma/client");
  const { PrismaClient } = module.default ?? module;
  const prisma = new PrismaClient();
  try {
    const state = await readState(prisma, { userId, orgId });
    const plan = planServiceMembership({ userId, tenantId, orgId, roles, state });
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", userId, tenantId, orgId, plan }, null, 2));
    if (!plan.ok) process.exitCode = 2;
    else if (apply) {
      await applyPlan(prisma, { userId, orgId }, plan);
      console.log("membresías aplicadas");
    }
  } finally {
    await prisma.$disconnect();
  }
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(String(err?.message ?? err));
    process.exit(1);
  });
}
