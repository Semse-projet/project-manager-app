/**
 * Guard del seed demo.
 *
 * El seed crea cuentas conocidas (client/worker/admin@demo.semse, contraseña pública) y un dataset
 * demo bajo `tenant_default`. En 2026-05-07 se ejecutó contra producción siguiendo DEPLOY.md y dejó
 * esas cuentas activas. Este guard hace que ese error no pueda repetirse en silencio.
 *
 * Reglas (se evalúan en este orden):
 *  1. NODE_ENV=production                       → se rechaza. Sin override.
 *  2. RAILWAY_ENVIRONMENT[_NAME] contiene "prod" → se rechaza. Sin override.
 *     (`railway run` ejecuta el comando en la máquina local con las variables del servicio, por lo
 *     que NODE_ENV puede no estar definido aunque la base sea la de producción.)
 *  3. DATABASE_URL apunta a un host no local     → se rechaza salvo SEMSE_SEED_ALLOW_REMOTE_DB=true
 *     (pensado para staging). Nunca levanta las reglas 1 y 2.
 *
 * Sin dependencias ni sintaxis solo-TypeScript: se importa desde seed.ts (tsx) y desde tests (node).
 */
export type SeedEnv = Record<string, string | undefined>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export type SeedGuardResult = { allowed: true } | { allowed: false; reason: string };

function databaseHost(databaseUrl: string): string | null {
  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function evaluateSeedGuard(env: SeedEnv): SeedGuardResult {
  if (env.NODE_ENV?.trim().toLowerCase() === "production") {
    return { allowed: false, reason: "NODE_ENV=production" };
  }

  for (const name of ["RAILWAY_ENVIRONMENT_NAME", "RAILWAY_ENVIRONMENT"]) {
    if (/prod/i.test(env[name] ?? "")) {
      return { allowed: false, reason: `${name} indica un entorno de producción` };
    }
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  if (databaseUrl) {
    const host = databaseHost(databaseUrl);
    if (host === null) {
      return { allowed: false, reason: "DATABASE_URL no se puede interpretar" };
    }
    if (!LOCAL_HOSTS.has(host) && env.SEMSE_SEED_ALLOW_REMOTE_DB !== "true") {
      return {
        allowed: false,
        reason: `DATABASE_URL apunta a un host no local (${host}); use SEMSE_SEED_ALLOW_REMOTE_DB=true solo en un entorno no productivo`,
      };
    }
  }

  return { allowed: true };
}

/** Lanza si el seed no debe ejecutarse. El mensaje nunca incluye credenciales de la URL. */
export function assertSeedAllowed(env: SeedEnv = process.env): void {
  const result = evaluateSeedGuard(env);
  if (!result.allowed) {
    throw new Error(
      `Seed demo rechazado: ${result.reason}. ` +
        "El seed crea cuentas demo con contraseña pública y no debe ejecutarse contra producción. " +
        "En local, compruebe que apps/api/.env no hereda NODE_ENV=production de .env.example.",
    );
  }
}
