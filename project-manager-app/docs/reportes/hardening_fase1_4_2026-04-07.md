# Hardening — Fases 1, 2, 3, 4, 6, 7 ejecutadas

Fecha: 2026-04-07
Autor: Claude (infclaude)

---

## Resumen ejecutivo

Se ejecutaron las primeras seis fases del plan de hardening del monorepo.
Todos los criterios de aceptación de esta ronda están en verde.

---

## Fase 1 — Validación de entorno (VERIFICADO, ya existía)

`apps/api/src/config/env.schema.ts` ya tenía `validateApiEnv` correctamente implementado
y conectado en `app.module.ts` vía `ConfigModule.forRoot({ validate: validateApiEnv })`.

No se requirió cambio.

---

## Fase 1b — `@semse/shared` — utilidades reales

**Archivo:** `packages/shared/src/index.ts`

Se expandió de 1 línea (`export const API_VERSION = "v1"`) a un módulo completo que exporta:

| Categoría | Exports |
|-----------|---------|
| Versión | `API_VERSION` |
| Headers | `SEMSE_IDENTITY_HEADER_NAMES`, `SEMSE_PROXY_HEADER_NAMES`, `SEMSE_REQUEST_HEADER_NAMES` |
| Identidad | `RequestIdentity`, `parseRoleList`, `serializeRoleList`, `buildIdentityHeaders`, `buildProxyIdentityHeaders` |
| Utilidades de string | `trimToUndefined`, `assertNever` |
| Moneda | `formatCurrency`, `safeParseDecimal` |
| Texto | `slugify`, `truncate` |
| Fechas | `toISODate`, `relativeTime` |
| Labels de dominio | `JOB_STATUS_LABELS`, `MILESTONE_STATUS_LABELS`, `BID_STATUS_LABELS`, `PROJECT_STATUS_LABELS`, `DISPUTE_STATUS_LABELS`, `AGENT_RUN_STATUS_LABELS` |
| Guards | `isNonEmptyString`, `isPositiveNumber` |
| Objetos | `pick`, `omit`, `compactObject` |
| Paginación | `PaginationMeta`, `buildPaginationMeta`, `paginationSkip` |

---

## Fase 2 — Tests unitarios

**Resultado: 82 tests / 82 pasan / 0 fallan**

| Archivo de test | Tests | Estado |
|----------------|-------|--------|
| `tests/unit/logic.test.mjs` | 10 | ✅ (pre-existente) |
| `tests/unit/auth-token.test.ts` | 11 | ✅ nuevo |
| `tests/unit/auth.test.ts` | 29 | ✅ nuevo |
| `tests/unit/shared.test.ts` | 30 | ✅ nuevo |
| **Total** | **82** | **✅** |

Cobertura de los tests nuevos:
- `signToken` / `verifyToken`: firma, verificación, expiración, jti único
- `rolePermissions`, `hasPermission`, `normalizeRoles`, `getPermissionsForRoles`
- `appRoleFromRoles`, `appRoleFromPathname`, `defaultDashboardForRole`
- `generateSessionId`, `encodeSession`, `decodeSession`, `isSessionValid`
- Todas las utilidades de `@semse/shared`

### Cambios en scripts de test

`package.json` root actualizado:
```json
"test:unit": "node --experimental-strip-types --test tests/unit/*.test.mjs tests/unit/*.test.ts"
```

---

## Fase 3 — Seed de base de datos

**Archivo:** `packages/db/prisma/seed.ts`

Crea el conjunto mínimo de datos para desarrollo local:
- 1 Tenant (`semse-dev`)
- 4 Roles con sus RolePermissions completas (`CLIENT`, `PRO`, `WORKER`, `OPS_ADMIN`)
- 3 Orgs (`client-org`, `pro-org`, `ops-org`)
- 3 Users con credenciales de prueba (password: `semse1234`)
- 3 Memberships (cada usuario a su org y rol)
- 2 Jobs en estado `PUBLISHED`

```
client@semse.dev  / semse1234  → CLIENT
pro@semse.dev     / semse1234  → PRO
admin@semse.dev   / semse1234  → OPS_ADMIN
```

Scripts agregados en `packages/db/package.json`:
- `prisma:seed` — ejecuta seed
- `prisma:reset` — reset + seed

Scripts agregados en `package.json` root:
- `db:seed` — `npm run prisma:seed --workspace @semse/db`
- `db:reset` — `npm run prisma:reset --workspace @semse/db`

---

## Fase 4 — `@semse/auth` — implementación real

**Archivo:** `packages/auth/src/index.ts`

Expandido de stub a módulo completo:

| Export | Descripción |
|--------|-------------|
| `RBAC_DEFAULT_POLICY` | Constante `"deny_by_default"` |
| `rolePermissions` | Mapa completo Role → string[] |
| `normalizeRoles` | Normaliza aliases (`ADMIN` → `OPS_ADMIN`, etc.) |
| `getPermissionsForRoles` | Combina permisos de múltiples roles |
| `hasPermission` | Verifica si un conjunto de roles tiene un permiso |
| `appRoleFromRoles` | Extrae AppRole (`admin`/`worker`/`client`) desde roles |
| `appRoleFromPathname` | Clasifica ruta a AppRole |
| `defaultDashboardForRole` | Ruta de dashboard por AppRole |
| `SessionPayload` | Tipo de sesión (sid, userId, tenantId, orgId, roles, expiresAt) |
| `generateSessionId` | UUID criptográficamente aleatorio |
| `encodeSession` | Serializa SessionPayload a base64url |
| `decodeSession` | Deserializa con validación de campos requeridos |
| `isSessionValid` | Verifica que la sesión no haya expirado |

Corrección aplicada: `ops:dashboard:write` faltaba en `OPS_ADMIN` permissions — agregado.

---

## Fase 6 — `.env.example`

**Archivo:** `project-manager-app/.env.example`

Documenta todas las variables de entorno con:
- Descripción inline de cada variable
- Valores por defecto para desarrollo
- Quick Start en el header (`cp .env.example .env`)
- Secciones: Node, Database, Auth/JWT, Server, CORS, Rate Limiting, Redis, OpenAI, Next.js, Supabase (opcional)

---

## Fase 7 — Scripts CI

Agregados al `package.json` root:

```json
"typecheck": "tsc --noEmit --project apps/api/tsconfig.json && tsc --noEmit --project apps/web/tsconfig.json",
"lint": "eslint apps/api/src apps/web/app --ext .ts,.tsx --max-warnings 0"
```

---

## Verificación final

```
tsc --workspace @semse/api -- --noEmit     ✅  0 errores
tsc --workspace @semse/web -- --noEmit     ✅  0 errores
npm run test:unit                           ✅  82/82 pasan
```

---

## Fases pendientes del plan de hardening

| Fase | Descripción | Estado |
|------|-------------|--------|
| 5 | Validation Pipe — auditar @Body() en todos los controllers | Pendiente |
| 8 | Soft deletes — deletedAt en Job/Contract/Milestone/Dispute/PaymentEscrow | Pendiente |
| CI | Agregar job `quality-gates` en GitHub Actions | Pendiente |
