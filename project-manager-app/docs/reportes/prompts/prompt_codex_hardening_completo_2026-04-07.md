# Prompt para Codex — Hardening completo SEMSE OS

> Copia todo lo que está entre `---PROMPT START---` y `---PROMPT END---`

---PROMPT START---

# SEMSE OS — Plan de hardening y mejora continua

Eres un agente de ingeniería senior trabajando en el monorepo **SEMSE OS**. Tu misión es ejecutar un plan completo de hardening, calidad y producción-readiness. Debes trabajar en bucle de mejora: **implementar → verificar → corregir → repetir** hasta que cada fase pase sus criterios de éxito sin errores.

---

## Repositorio

```
/home/yoni/labsemse/project-manager-app/
├── apps/api/          ← NestJS 11 + Fastify (backend)
├── apps/web/          ← Next.js 15 + React 19 (frontend)
├── apps/worker/       ← Node.js + BullMQ (jobs async)
├── packages/db/       ← Prisma 6.4 + PostgreSQL
├── packages/schemas/  ← Zod validators (fuente de verdad de contratos)
├── packages/auth/     ← STUB vacío (solo exporta una constante)
├── packages/shared/   ← STUB vacío (solo exporta API_VERSION)
├── packages/agents/   ← Catálogo de 24 agentes (definiciones, sin lógica real)
├── packages/ui/       ← 5 componentes React funcionales
└── .github/workflows/ ← CI/CD con 4 workflows
```

---

## Contexto técnico real del proyecto

### Lo que YA EXISTE y funciona (no tocar sin razón)

**main.ts ya tiene:**
- `@fastify/helmet` registrado con CSP, HSTS, frameAncestors
- `@fastify/cors` configurado con `CORS_ORIGINS` env var
- `ThrottlerModule` global en `app.module.ts`
- `SemseLoggerService` con structured logging
- `MetricsService` con `recordHttpRequest()`
- Hook `onRequest` con `runWithObservabilityContext()`
- Hook `onResponse` logea `http_request_completed` con durationMs
- `HttpExceptionFilter` con `SemseLoggerService`

**auth.controller.ts ya tiene:**
- `POST /v1/auth/token` con `@Throttle({ default: { limit: 5, ttl: 60_000 } })`
- `POST /v1/auth/refresh` con `@Throttle({ default: { limit: 10, ttl: 60_000 } })`
- `POST /v1/auth/logout`
- `POST /v1/auth/password-reset/request` y `/confirm`
- Zod validation con `parseWithSchema(authTokenBodySchema, body)`

**app.module.ts ya tiene:**
- `ConfigModule.forRoot({ validate: validateApiEnv })`
- `ThrottlerModule.forRoot()`
- `ThrottlerGuard` como `APP_GUARD`
- `AuthGuard` como `APP_GUARD`
- `RbacGuard` como `APP_GUARD`
- `OrganizationsModule`, `RatingsModule`, `UsersModule` registrados

**jobs.controller.ts ya tiene:**
- Zod validation: `listJobsQuerySchema.safeParse(query)`, `createRuntimeJobSchema.safeParse(body)`
- `@RequirePermissions("jobs:read")` y `"jobs:create"`

**RBAC:**
- 4 roles: `CLIENT`, `PRO`, `WORKER`, `OPS_ADMIN`
- 58 permisos específicos en `rbac.ts`
- `hasPermission(roles, permission)` funcional

**Schemas Zod en `packages/schemas/src/`:**
- `api-input.schema.ts`: `authTokenBodySchema`, `authRefreshBodySchema`, `milestoneCreateSchema`, `milestoneReasonSchema`, `ratingCreateSchema`, `userVerificationBodySchema`, `opsIncidentSchema`, `opsAgentRuntimeQuerySchema`, y más
- `job.schema.ts`: `createRuntimeJobSchema`, `listJobsQuerySchema`, `jobRecordSchema`
- Domain events, marketplace, payments, evidence, dispute, trust, ops — todos presentes

**CI/CD:**
- `.github/workflows/ci.yml`: quality-gates (lint API, unit tests, build API, typecheck web) + unit-coverage + e2e Playwright
- `api-integration.yml`, `api-smoke.yml`, `release.yml` funcionando

**Frontend:**
- `middleware.ts` completo con session, role-based routing, headers `x-semse-*`
- `error.tsx` y `loading.tsx` en `(app)/`
- `layout.tsx` con sidebar dinámico por rol

### Lo que FALTA (tu trabajo)

Lee esta lista con atención — es el gap real entre el estado actual y producción-ready.

---

## REGLAS OBLIGATORIAS

1. **Lee antes de escribir** — SIEMPRE lee el archivo completo antes de modificarlo
2. **No romper lo que funciona** — el código existente compila con `tsc --noEmit`. Debe seguir compilando después de cada fase
3. **Verificación en bucle** — después de cada tarea ejecuta los comandos de verificación. Si fallan, corrige y vuelve a verificar
4. **Mismo estilo** — iguala el estilo del archivo que modificas (imports, tipos, naming, ESM `.js` extensions en imports)
5. **ESM obligatorio** — todos los imports internos llevan `.js` al final: `import { Foo } from "./foo.js"`
6. **TypeScript estricto** — sin `any` explícito, sin `@ts-ignore` sin justificación
7. **Reporta al final** — al terminar cada fase, lista los archivos creados/modificados y el resultado de la verificación

---

## COMANDO DE VERIFICACIÓN MASTER

Ejecuta esto después de cada fase. Debe terminar en 0 errores:

```bash
cd /home/yoni/labsemse/project-manager-app

# TypeScript
npm exec tsc --workspace @semse/api -- --noEmit
npm exec tsc --workspace @semse/web -- --noEmit

# Lint API
npm exec eslint --workspace @semse/api -- "src/**/*.ts" --max-warnings 0

# Tests unitarios
node --test tests/unit/*.test.mjs 2>&1 | tail -20
```

---

## PLAN DE EJECUCIÓN — 8 FASES EN BUCLE

---

## FASE 1 — Validación de env vars y `@semse/shared`

**Objetivo:** Que el servidor no arranque con configuración inválida. Que `@semse/shared` tenga utilidades reales.

### 1A — Verificar que `env.schema.ts` existe

Lee `/home/yoni/labsemse/project-manager-app/apps/api/src/config/env.schema.ts`.

Si NO existe, créalo:

```typescript
// apps/api/src/config/env.schema.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  AUTH_SECRET: z.string().min(32).optional(),
  CORS_ORIGINS: z.string().default(""),
  RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(20),
  SEMSE_WORKER_ID: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

export type ApiEnv = z.infer<typeof envSchema>;

export function validateApiEnv(config: Record<string, unknown>): ApiEnv {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const message = Object.entries(errors)
      .map(([key, msgs]) => `${key}: ${msgs?.join(", ")}`)
      .join(" | ");
    throw new Error(`Invalid environment configuration: ${message}`);
  }
  return result.data;
}
```

Si ya existe, léelo y asegúrate de que tiene `validateApiEnv` como export nombrado (lo usa `app.module.ts`).

### 1B — Completar `packages/shared`

Lee el archivo actual. Reemplaza el contenido con utilidades reales:

```typescript
// packages/shared/src/index.ts
export const API_VERSION = "v1" as const;

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function safeParseDecimal(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && typeof (value as { toNumber?: unknown }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  POSTED: "Publicado",
  PUBLISHED: "Publicado",
  RESERVED: "Reservado",
  ACCEPTED: "Aceptado",
  IN_PROGRESS: "En progreso",
  REVIEW: "En revisión",
  DISPUTE: "En disputa",
  COMPLETED: "Completado",
  AWARDED: "Adjudicado",
  CANCELLED: "Cancelado",
};

export const MILESTONE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  AWAITING_REVIEW: "Esperando revisión",
  SUBMITTED: "Enviado",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  PAID: "Pagado",
};

export const DISPUTE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Abierta",
  ASSIGNED: "Asignada",
  UNDER_REVIEW: "En revisión",
  RESOLVED: "Resuelta",
  REJECTED: "Rechazada",
};
```

**Verificación fase 1:**
```bash
npm exec tsc --workspace @semse/api -- --noEmit
```

---

## FASE 2 — Tests unitarios del backend

**Objetivo:** Cobertura real de los módulos críticos. Alcanzar mínimo 60% de cobertura en la lógica de negocio.

**Stack de testing:** Node.js `--test` nativo (ya configurado en `package.json`). No instalar Jest ni Vitest adicional.

### 2A — Leer el test existente

Lee `/home/yoni/labsemse/project-manager-app/tests/unit/logic.test.mjs` para entender el patrón exacto de tests que ya se usan.

### 2B — Crear tests para módulos críticos

Crea los siguientes archivos de test usando el mismo patrón del test existente:

#### `tests/unit/auth-token.test.mjs`
Tests para `apps/api/src/common/auth-token.ts`:
- `signToken()` genera token con claims correctos
- `verifyToken()` valida firma correctamente
- `verifyToken()` lanza error en token expirado
- `verifyToken()` lanza error en firma inválida
- `verifyToken()` lanza error en formato inválido
- `timingSafeEqual` protege contra timing attacks (test de concepto)

#### `tests/unit/rbac.test.mjs`
Tests para `apps/api/src/common/rbac.ts`:
- `hasPermission(['CLIENT'], 'jobs:read')` → true
- `hasPermission(['CLIENT'], 'disputes:assign')` → false
- `hasPermission(['OPS_ADMIN'], 'disputes:assign')` → true
- `hasPermission(['WORKER'], 'agents:run:worker')` → true
- `hasPermission([], 'jobs:read')` → false
- `hasPermission(['UNKNOWN_ROLE'], 'jobs:read')` → false
- Multi-role: `hasPermission(['CLIENT', 'OPS_ADMIN'], 'disputes:resolve')` → true

#### `tests/unit/shared.test.mjs`
Tests para `packages/shared/src/index.ts`:
- `formatCurrency(1500)` → formato correcto
- `isNonEmptyString("")` → false
- `isNonEmptyString("hello")` → true
- `safeParseDecimal("123.45")` → 123.45
- `safeParseDecimal(null)` → 0
- `slugify("Hola Mundo")` → "hola-mundo"
- `JOB_STATUS_LABELS["COMPLETED"]` → "Completado"

#### `tests/unit/env-schema.test.mjs`
Tests para `apps/api/src/config/env.schema.ts`:
- `validateApiEnv({ DATABASE_URL: 'postgresql://...' })` → no lanza
- `validateApiEnv({})` → lanza con mensaje descriptivo
- `validateApiEnv({ DATABASE_URL: 'mysql://...' })` → lanza (no es postgresql)
- Defaults: PORT=4000, NODE_ENV="development"

#### `tests/unit/zod-schemas.test.mjs`
Tests para `packages/schemas/src/`:
- `authTokenBodySchema.parse({ userId: 'u1', tenantId: 't1', orgId: 'o1' })` → válido
- `authTokenBodySchema.parse({})` → lanza ZodError
- `createRuntimeJobSchema.parse({ title: 'ab', scope: 'short' })` → lanza (título muy corto)
- `createRuntimeJobSchema.parse({ title: 'Valid title here', scope: 'A'.repeat(20) })` → válido
- `milestoneCreateSchema.parse({ title: 'Hito 1', amount: 1000, sequence: 1 })` → válido
- `ratingCreateSchema.parse({ jobId: 'j1', toUserId: 'u1', score: 6 })` → lanza (score > 5)

**Patrón de import para tests (ESM, rutas relativas desde tests/unit/):**
```javascript
// Para módulos del monorepo usa rutas relativas
import { signToken, verifyToken } from "../../apps/api/src/common/auth-token.js";
import { hasPermission } from "../../apps/api/src/common/rbac.js";
// Para packages usa el nombre del paquete si está en workspaces
import { API_VERSION, formatCurrency } from "../../packages/shared/src/index.js";
```

### 2C — Actualizar el script de tests en package.json

Lee el package.json raíz. El script `test:unit` debe correr todos los archivos:
```json
"test:unit": "node --test tests/unit/*.test.mjs"
```
Verifica que ya esté así. Si no, actualízalo.

**Verificación fase 2:**
```bash
node --test tests/unit/*.test.mjs 2>&1
# Debe mostrar: X passing, 0 failing
```

Si algún test falla por import que no resuelve, ajusta las rutas relativas. Entra en bucle hasta que pasen todos.

---

## FASE 3 — Seed de base de datos

**Objetivo:** Un developer nuevo puede clonar, levantar Docker y tener datos de prueba con un solo comando.

### 3A — Crear `packages/db/prisma/seed.ts`

Lee el schema Prisma completo primero. Luego crea:

```typescript
// packages/db/prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding SEMSE database...");

  // Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "semse-demo" },
    update: {},
    create: {
      id: "tenant_demo",
      slug: "semse-demo",
      name: "SEMSE Demo",
      status: "active",
    },
  });
  console.log(`✅ Tenant: ${tenant.slug}`);

  // Org cliente
  const clientOrg = await prisma.org.upsert({
    where: { id: "org_client_demo" },
    update: {},
    create: {
      id: "org_client_demo",
      tenantId: tenant.id,
      name: "Cliente Demo S.A.",
      type: "CLIENT",
    },
  });

  // Org profesional
  const proOrg = await prisma.org.upsert({
    where: { id: "org_pro_demo" },
    update: {},
    create: {
      id: "org_pro_demo",
      tenantId: tenant.id,
      name: "Profesionales Demo S.A.",
      type: "PROFESSIONAL",
    },
  });
  console.log(`✅ Orgs: ${clientOrg.name}, ${proOrg.name}`);

  // Jobs de demo (uno por estado principal)
  const jobStatuses = [
    { id: "job_posted_1", title: "Pintura de sala principal", status: "POSTED" },
    { id: "job_in_progress_1", title: "Instalación de drywall", status: "IN_PROGRESS" },
    { id: "job_review_1", title: "Reparación de plomería", status: "REVIEW" },
    { id: "job_completed_1", title: "Impermeabilización de azotea", status: "COMPLETED" },
  ] as const;

  for (const jobData of jobStatuses) {
    await prisma.job.upsert({
      where: { id: jobData.id },
      update: {},
      create: {
        id: jobData.id,
        tenantId: tenant.id,
        orgId: clientOrg.id,
        title: jobData.title,
        scope: `Trabajo de ${jobData.title.toLowerCase()} en propiedad ubicada en Ciudad de México. Se requiere experiencia comprobable.`,
        status: jobData.status,
        budgetMin: 5000,
        budgetMax: 15000,
      },
    });
  }
  console.log(`✅ Jobs: ${jobStatuses.length} creados`);

  console.log("✅ Seed completado exitosamente");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

### 3B — Agregar scripts de DB al `packages/db/package.json`

Lee el archivo actual. Agrega o actualiza los scripts:
```json
{
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio",
    "prisma:seed": "tsx prisma/seed.ts",
    "prisma:reset": "prisma migrate reset --force"
  }
}
```

### 3C — Agregar scripts al package.json raíz

Lee el package.json raíz. Agrega estos scripts:
```json
"db:seed": "npm run prisma:seed --workspace @semse/db",
"db:reset": "npm run prisma:reset --workspace @semse/db",
"db:studio": "npm run prisma:studio --workspace @semse/db"
```

### 3D — Agregar índices críticos al schema Prisma

Lee el schema completo. Agrega `@@index` en los modelos con queries frecuentes:

**En el modelo `Job`:** Después del último campo, antes del cierre `}`:
```prisma
@@index([tenantId, status])
@@index([tenantId, orgId])
@@index([tenantId, updatedAt])
```

**En el modelo `AgentRun`:**
```prisma
@@index([tenantId, correlationId])
@@index([tenantId, status])
@@index([tenantId, agentType])
```

**En el modelo `AuditLog`:**
```prisma
@@index([tenantId, occurredAt])
@@index([tenantId, entityType, entityId])
```

**En el modelo `Milestone`:**
```prisma
@@index([tenantId, status])
```

**En el modelo `Dispute`:**
```prisma
@@index([tenantId, status])
```

Después de agregar índices:
```bash
cd /home/yoni/labsemse/project-manager-app
npm run db:generate
```

**Verificación fase 3:**
```bash
npm exec tsc --workspace @semse/api -- --noEmit
# Seed se verifica en CI — solo verificar que el archivo compila sin error
```

---

## FASE 4 — Implementar `@semse/auth` real

**Objetivo:** El paquete `@semse/auth` debe exportar las utilidades de autenticación compartidas entre API y Web, en lugar de ser un stub vacío.

### 4A — Leer contexto

Lee:
- `apps/api/src/common/auth-token.ts` (JWT signing/verifying)
- `apps/web/app/api/semse/auth/token/route.ts`
- `apps/web/src/lib/auth.ts` o `apps/web/lib/auth.ts` si existe

### 4B — Crear `packages/auth/src/index.ts` completo

```typescript
// packages/auth/src/index.ts
import crypto from "node:crypto";

export const RBAC_DEFAULT_POLICY = "deny_by_default" as const;

export const SESSION_COOKIE = "semse_session" as const;

export type SessionPayload = {
  userId: string;
  tenantId: string;
  orgId: string;
  roles: string[];
  sessionId?: string;
  exp: number;
};

export type AppRole = "worker" | "client" | "admin";

export function roleFromRoles(roles: string[]): AppRole {
  if (roles.includes("OPS_ADMIN")) return "admin";
  if (roles.includes("PRO") || roles.includes("WORKER")) return "worker";
  return "client";
}

export function defaultDashboardForRole(role: AppRole): string {
  switch (role) {
    case "admin":  return "/admin/dashboard";
    case "worker": return "/worker/dashboard";
    default:       return "/client/dashboard";
  }
}

export function encodeSession(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeSession(token: string): SessionPayload | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const payload = JSON.parse(raw) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function generateSessionId(): string {
  return `sid_${crypto.randomUUID()}`;
}

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  CLIENT: [
    "jobs:read", "jobs:create", "bids:read", "bids:accept",
    "milestones:read", "milestones:create", "milestones:approve",
    "evidence:read", "evidence:write",
    "disputes:read", "disputes:create",
    "projects:read", "projects:financials:read", "projects:financials:write",
    "reservations:read", "reservations:accept", "reservations:release",
    "contracts:create", "contracts:read", "contracts:sign",
    "ratings:read", "ratings:create",
    "org:read", "org:members:read", "users:read",
  ],
  PRO: [
    "jobs:read", "bids:create",
    "milestones:read", "milestones:submit",
    "evidence:read", "evidence:write",
    "disputes:read",
    "projects:read",
    "reservations:create", "reservations:read", "reservations:release",
    "contracts:read", "contracts:sign",
    "ratings:read", "ratings:create",
    "org:read", "users:read",
  ],
  WORKER: ["agents:run:worker"],
  OPS_ADMIN: [
    "jobs:read", "jobs:create", "bids:read", "bids:create", "bids:accept",
    "milestones:read", "milestones:create", "milestones:submit",
    "milestones:approve", "milestones:reject",
    "evidence:read", "evidence:write",
    "disputes:read", "disputes:create", "disputes:assign", "disputes:resolve",
    "projects:read", "projects:financials:read", "projects:financials:write",
    "reservations:create", "reservations:read", "reservations:accept",
    "reservations:release", "reservations:expire",
    "contracts:create", "contracts:read", "contracts:sign",
    "ratings:read", "ratings:create",
    "org:read", "org:members:read", "org:members:manage",
    "users:read", "users:verify", "users:memberships:read",
    "ops:audit:read", "ops:dashboard:read", "ops:dashboard:write",
    "ops:risk:read", "ops:alerts:ack", "ops:runbooks:execute", "ops:incidents:create",
    "domain-events:read", "domain-events:emit",
    "agents:run:create", "agents:run:retry", "agents:run:manage", "agents:run:worker",
  ],
};

export function hasPermission(roles: string[], permission: string): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission));
}
```

### 4C — Verificar que Web puede importar de `@semse/auth`

Lee `apps/web/package.json`. Si `@semse/auth` no está en dependencies, agrégalo:
```json
"@semse/auth": "*"
```

**Verificación fase 4:**
```bash
npm exec tsc --workspace @semse/api -- --noEmit
npm exec tsc --workspace @semse/web -- --noEmit
```

---

## FASE 5 — Validation Pipe global con Zod

**Objetivo:** Todos los controllers validan su input automáticamente. Eliminar el patrón manual `schema.safeParse(body)` donde sea posible.

### 5A — Leer el helper `zod-validation.ts` si existe

Lee `apps/api/src/common/zod-validation.ts`. Si NO existe, créalo:

```typescript
// apps/api/src/common/zod-validation.ts
import { BadRequestException } from "@nestjs/common";
import type { ZodSchema } from "zod";

export function parseWithSchema<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestException({
      message: "Validation failed",
      errors: result.error.flatten().fieldErrors,
    });
  }
  return result.data;
}
```

Si ya existe, confirma que exporta `parseWithSchema`.

### 5B — Auditar controllers sin validación Zod

Lee estos controllers y verifica si usan `parseWithSchema` o `schema.safeParse()`:
- `apps/api/src/modules/milestones/milestones.controller.ts`
- `apps/api/src/modules/disputes/disputes.controller.ts`
- `apps/api/src/modules/evidence/evidence.controller.ts`
- `apps/api/src/modules/payments/payments.controller.ts`
- `apps/api/src/modules/reservations/reservations.controller.ts`
- `apps/api/src/modules/contracts/contracts.controller.ts`
- `apps/api/src/modules/ratings/ratings.controller.ts`
- `apps/api/src/modules/users/users.controller.ts`
- `apps/api/src/modules/organizations/organizations.controller.ts`

Para cada controller que reciba un `@Body()` sin validación, agrega la validación usando el schema Zod correspondiente de `@semse/schemas`.

**Mapeo de schemas disponibles:**
```typescript
// En @semse/schemas (packages/schemas/src/api-input.schema.ts):
milestoneCreateSchema       → POST /milestones
milestoneReasonSchema       → POST reject/request-changes
ratingCreateSchema          → POST /ratings
userVerificationBodySchema  → POST /users/:id/verify
opsIncidentSchema           → POST /ops/incidents
authTokenBodySchema         → POST /auth/token (ya implementado)
authRefreshBodySchema       → POST /auth/refresh (ya implementado)
```

Para endpoints sin schema en `@semse/schemas`, créalos en el archivo correspondiente o usa inline Zod.

**Verificación fase 5:**
```bash
npm exec tsc --workspace @semse/api -- --noEmit
```

---

## FASE 6 — `.env.example` completo + documentación de setup

**Objetivo:** Un developer nuevo sabe exactamente qué variables necesita sin leer el código.

### 6A — Crear `.env.example` en la raíz del monorepo

Busca si existe `/home/yoni/labsemse/project-manager-app/.env.example`. Si no, créalo:

```bash
# ──────────────────────────────────────────
# SEMSE OS — Environment Variables Reference
# ──────────────────────────────────────────
# Copia este archivo como .env (o packages/db/.env para la DB)
# y rellena los valores reales.

# ── Base de datos ──────────────────────────
# Requerido. PostgreSQL connection string.
# Con Docker local: postgresql://semse:semse@localhost:5433/semse?schema=public
DATABASE_URL=postgresql://semse:semse@localhost:5433/semse?schema=public

# ── Servidor API ──────────────────────────
PORT=4000
HOST=0.0.0.0
NODE_ENV=development

# ── Seguridad ─────────────────────────────
# Requerido en producción. Mínimo 32 caracteres.
# Genera con: openssl rand -hex 32
AUTH_SECRET=change-me-to-a-real-secret-of-at-least-32-chars

# ── CORS ──────────────────────────────────
# Lista separada por comas de orígenes permitidos.
# Vacío = bloquear todos los orígenes externos.
CORS_ORIGINS=http://localhost:3000

# ── Rate limiting ──────────────────────────
RATE_LIMIT_TTL_SECONDS=60
RATE_LIMIT_LIMIT=20

# ── Redis (worker + BullMQ) ───────────────
REDIS_URL=redis://localhost:6379

# ── MinIO / Storage ────────────────────────
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=semse
MINIO_SECRET_KEY=semse123
MINIO_BUCKET=semse-evidence

# ── Worker ─────────────────────────────────
SEMSE_API_URL=http://localhost:4000
SEMSE_WORKER_ID=worker-local-01
SEMSE_TENANT_ID=tenant_demo
SEMSE_ORG_ID=org_ops_demo
SEMSE_USER_ID=user_worker_01
SEMSE_ROLES=WORKER

# ── Frontend (Next.js) ────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
SEMSE_API_BASE_URL=http://localhost:4000
```

### 6B — Actualizar `packages/db/.env.example`

Asegúrate de que `packages/db/.env.example` tenga al menos:
```bash
DATABASE_URL=postgresql://semse:semse@localhost:5433/semse?schema=public
```

### 6C — Agregar sección "Quick Start" al README

Lee el README actual. Agrega al inicio (después del título/descripción):

```markdown
## Quick Start

```bash
# 1. Infraestructura local
docker compose -f infra/docker/compose.semse-mvp.yml up -d

# 2. Variables de entorno
cp .env.example packages/db/.env
# editar: AUTH_SECRET debe ser al menos 32 chars en producción

# 3. Instalar dependencias
npm run bootstrap:semse

# 4. Base de datos
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. Desarrollo
npm run dev:api    # NestJS en :4000
npm run dev:web    # Next.js en :3000
npm run dev:worker # Worker en background
```
```

**Verificación fase 6:**
```bash
# Verificar que los archivos existen y tienen contenido
ls /home/yoni/labsemse/project-manager-app/.env.example
ls /home/yoni/labsemse/project-manager-app/packages/db/prisma/seed.ts
```

---

## FASE 7 — CI/CD quality gates completos

**Objetivo:** El pipeline de CI valida TypeScript, lint y tests en cada PR. Nada llega a main sin pasar los gates.

### 7A — Leer el CI actual completo

Lee `/home/yoni/labsemse/project-manager-app/.github/workflows/ci.yml`.

### 7B — Verificar que el CI tiene estos pasos en `quality-gates`

El job `quality-gates` debe incluir (en orden):

1. `npm run lint` en `@semse/api` → `npm exec eslint --workspace @semse/api -- "src/**/*.ts" --max-warnings 0`
2. `tsc --noEmit` en `@semse/api` → `npm exec tsc --workspace @semse/api -- --noEmit`
3. `tsc --noEmit` en `@semse/web` → `npm exec tsc --workspace @semse/web -- --noEmit`
4. Build del API → `npm run build:api`

Si alguno de estos no está, agrégalo.

### 7C — Agregar script de lint unificado al package.json raíz

Lee package.json raíz. Agrega:
```json
"lint": "npm run lint --workspace @semse/api && npm run lint --workspace @semse/web",
"typecheck": "npm exec tsc --workspace @semse/api -- --noEmit && npm exec tsc --workspace @semse/web -- --noEmit"
```

### 7D — Crear `.eslintrc.json` para la API si no existe

Busca `apps/api/.eslintrc.json` o `apps/api/eslint.config.js`. Si no existe ninguno:

```json
// apps/api/.eslintrc.json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json",
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": "warn"
  },
  "ignorePatterns": ["dist/", "node_modules/"]
}
```

**Verificación fase 7:**
```bash
npm run typecheck
# Debe terminar en 0 errores
npm run build:api 2>&1 | tail -10
```

---

## FASE 8 — Soft deletes y índices de auditoría

**Objetivo:** Los registros críticos no se borran permanentemente. Se puede recuperar un job/contract/milestone borrado accidentalmente.

### 8A — Agregar `deletedAt` a modelos críticos

Lee el schema Prisma completo. Agrega campo `deletedAt DateTime?` a:
- `Job`
- `Contract`
- `Milestone`
- `Dispute`
- `PaymentEscrow`

Patrón (agregar antes del cierre `}` de cada modelo):
```prisma
deletedAt  DateTime?
```

### 8B — Crear migration

```bash
cd /home/yoni/labsemse/project-manager-app
npm run db:generate
```

Luego en `packages/db/`:
```bash
npx prisma migrate dev --name add_soft_delete_fields
```

### 8C — Actualizar repositories para excluir soft-deleted

Lee `apps/api/src/modules/jobs/jobs.repository.ts`. Agrega `where: { ..., deletedAt: null }` en los métodos `findMany` de los repositories de Job, Contract, Milestone, Dispute.

**Patrón:**
```typescript
// Antes:
where: { tenantId: input.tenantId }
// Después:
where: { tenantId: input.tenantId, deletedAt: null }
```

**Verificación fase 8:**
```bash
npm exec tsc --workspace @semse/api -- --noEmit
node --test tests/unit/*.test.mjs 2>&1 | tail -10
```

---

## BUCLE DE MEJORA CONTINUA

Después de completar las 8 fases, ejecuta este ciclo:

```
CICLO 1 — Verificación completa
  1. npm exec tsc --workspace @semse/api -- --noEmit
  2. npm exec tsc --workspace @semse/web -- --noEmit
  3. node --test tests/unit/*.test.mjs
  4. npm run build:api

  ¿Hay errores? → corregir → volver al paso 1
  ¿Todo verde? → continuar a CICLO 2

CICLO 2 — Calidad de código
  1. npm run lint (si está configurado)
  2. Buscar con grep: "any" en apps/api/src/ — eliminar cada uno
  3. Buscar: "TODO" en apps/api/src/ — resolver o documentar
  4. Verificar que TODOS los controllers con @Body() tienen validación Zod

  ¿Hay warnings? → corregir → volver al paso 1
  ¿Todo verde? → continuar a CICLO 3

CICLO 3 — Integridad de contratos
  1. Verificar que cada endpoint POST tiene su schema en @semse/schemas
  2. Verificar que packages/schemas/src/index.ts exporta todos los schemas
  3. Verificar que apps/web/app/semse-api.ts usa los tipos de @semse/schemas donde existen
  4. Verificar que packages/auth/src/index.ts y apps/api/src/common/rbac.ts tienen los mismos ROLE_PERMISSIONS

  ¿Hay divergencias? → sincronizar → volver a CICLO 1
  ¿Todo alineado? → el proyecto está en estado producción-ready
```

---

## CRITERIOS DE ÉXITO FINAL

El trabajo está completo cuando se cumplen TODOS estos criterios simultáneamente:

```
□ tsc --noEmit @semse/api  → 0 errores
□ tsc --noEmit @semse/web  → 0 errores
□ node --test tests/unit/* → 0 failing, mínimo 20 tests passing
□ npm run build:api        → 0 errores
□ packages/auth/src/index.ts → exporta SessionPayload, encodeSession, decodeSession, ROLE_PERMISSIONS
□ packages/shared/src/index.ts → exporta formatCurrency, safeParseDecimal, JOB_STATUS_LABELS
□ packages/db/prisma/seed.ts → existe y compila
□ .env.example → existe en raíz con todas las vars documentadas
□ tests/unit/*.test.mjs → mínimo 4 archivos, mínimo 20 tests
□ apps/api/src/config/env.schema.ts → existe con validateApiEnv
□ Schema Prisma → tiene @@index en Job, AgentRun, AuditLog, Milestone, Dispute
□ Schema Prisma → Job, Contract, Milestone, Dispute tienen deletedAt
□ Repositories de Job → filtra deletedAt: null
□ Todos los controllers con @Body() → usan parseWithSchema o safeParse
```

Si algún criterio no se cumple, entra en bucle de corrección hasta que todos estén en verde.

---

## NOTAS FINALES

- **No reinstales dependencias** que ya están en `node_modules`. Usa las que hay.
- **No cambies el runtime del worker** — funciona bien con HTTP polling, no migres a BullMQ directo sin instrucción explícita.
- **No toques main.ts ni app.module.ts** salvo para agregar el lint script — ya están bien configurados.
- **Si encuentras un error de TypeScript** que no sabes cómo resolver sin introducir `any`, busca el tipo correcto en el código existente del mismo módulo antes de usar un workaround.
- **Prioriza compilación correcta** sobre elegancia — primero que funcione y compile, luego mejora el estilo.

---PROMPT END---
