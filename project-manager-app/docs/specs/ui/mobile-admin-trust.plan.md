---
type: plan
feature: "Mobile Admin Trust — Fase 7f de apps/mobile"
domain: "ui"
spec: "docs/specs/ui/mobile-admin-trust.spec.md"
version: "1.0"
status: "APPROVED"
branch: "claude/roadmap-continuation-vhmve9"
date: "2026-08-26"
---

# Plan técnico: Mobile Admin Trust — Fase 7f de apps/mobile

> Prerrequisito: spec `APPROVED`.

## 1. Snapshot de verdad

- Rama de trabajo (`claude/roadmap-continuation-vhmve9`) fue reiniciada
  desde `origin/main` tras el merge de PR #586 — trae Fase 7a-7e ya
  mergeadas (PRs #583/#584/#585/#586).
- `docs/specs/ui/mobile-admin-users.spec.md`/`mobile-admin-contractors.spec.md`
  (`IMPLEMENTED`) son el precedente directo — mismo patrón de tab nuevo +
  cliente API dedicado sin BFF, reusando un `GET` ya expuesto.
- **Drift confirmado (no replicado):** `apps/web/app/(app)/admin/trust/page.tsx`
  lee `data.entries` (la API real devuelve `items`), filtra por un nivel
  `"critical"` que `trustOverviewItemSchema` nunca produce, y compara
  `scopeType === "user"` cuando el contrato real solo permite
  `"job" | "project"` — verificado leyendo `ops.service.ts` y
  `packages/schemas/src/ops.schema.ts` directamente.
- **Drift de superficie:** `AdminTrustScreen`/`src/api/trust.ts` no existen
  todavía, confirmado por grep.

## 2. Constitution check

- [x] Spec aprobado antes de código — este documento se escribe con spec ya
      `APPROVED`.
- [x] Tenant/org/ownership y RBAC definidos — spec §3, `ops:risk:read` ya
      otorgado a `OPS_ADMIN`, scoping tenant-wide verificado en
      `ops.repository.ts:listRecentJobsWithProject`.
- [x] Evidence/Payment Governance revisados — sin evidencia ni pagos
      alcanzables desde esta superficie; lectura pura, sin ninguna
      mutación posible (no existe endpoint de escritura para trust
      scores).
- [x] Audit/events definidos — no aplica, `GET` no emite `AuditLog`.
- [x] Tests preceden implementación — Fase A de este plan.
- [x] No se expone secreto ni se agrega backend paralelo.
- [x] Código, CI, merge, deploy y activación se miden por separado.

## 3. Arquitectura y autoridad

- **Módulos afectados (API):** ninguno — se reusa `GET
  /v1/ops/trust-overview` tal cual.
- **Contratos Zod:** ninguno nuevo — `trustOverviewSchema`/
  `trustOverviewItemSchema` ya existen en `packages/schemas/src/ops.schema.ts`
  y ya se exportan desde el barrel del paquete.
- **API/BFF/UI:** solo UI, mismo patrón sin-BFF que el resto de
  `apps/mobile`.
- **ADR requerido:** no — replica el patrón ya establecido por
  `AdminUsersScreen`/`AdminDisputesScreen` (lista + stat cards + filtro).

## 4. Datos y migración

No aplica.

## 5. Seguridad y política

- **Permisos:** `ops:risk:read`, ya otorgado a `OPS_ADMIN` en
  `packages/db/prisma/seed.ts`. Sin permisos nuevos.
- **Tenant/org/resource scope:** delegado 100% al backend existente
  (`listRecentJobsWithProject` ya filtra por `tenantId` sin condición de
  `orgId`), sin lógica de scope nueva del lado cliente.
- **Abuse cases:** ninguno nuevo — superficie es de solo lectura, sin
  ningún endpoint de escritura que alcanzar.

## 6. Eventos, idempotencia y reconstrucción

No aplica.

## 7. Estrategia de implementación

### Fase A — Tests y contratos

- `AdminTrustScreen.test.tsx`: loading/empty/ready/error, cards de conteo,
  listado con nivel+score+flags, filtro por nivel, ausencia del filtro
  fantasma "crítico" y de cualquier acción mutante/trust-passport.

### Fase B — Datos y dominio

No aplica.

### Fase C — API/BFF/UI

- `src/api/trust.ts` — nuevo cliente (`fetchTrustOverview`), tipado con
  `TrustOverview`/`TrustOverviewItem` de `@semse/schemas`.
- `src/screens/admin/AdminTrustScreen.tsx` — nuevo, mismo patrón de cards
  de stats + filtro por chips que `AdminDashboardScreen.tsx`/
  `apps/web`'s Trust page (sin replicar su drift).
- `src/navigation/AdminTabNavigator.tsx` — agregar tab `Trust` entre
  `Contractors` y `Settings`.
- `src/navigation/types.ts` — `AdminTabParamList` gana `Trust: undefined`.
- `apps/mobile/README.md` — actualizar sección Admin.

### Fase D — Verificación local

- `pnpm --filter @semse/mobile test` — suite completa.
- `pnpm --filter @semse/mobile check` (`tsc --noEmit`).
- `pnpm spec:validate:strict`, `pnpm spec:index`.

### Fase E — Integración

- Commit sobre un PR nuevo en la rama designada de esta sesión
  (`claude/roadmap-continuation-vhmve9`).

### Fase F — Producción

- Sin servicio backend que desplegar — build EAS `preview` + smoke manual
  con cuenta `OPS_ADMIN` real que tenga trust scores visibles en más de
  una org, mismo estándar que el resto de Fase 7.
- **Rollback:** no promover el build `preview` a `production` hasta smoke
  manual confirmado; sin flag que revertir.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Confundir este scope acotado (lectura + filtro) con una futura acción sobre trust scores | baja (no existe hoy ningún endpoint de escritura que exponer) | bajo | Este plan solo cubre lo listado en spec §2 "Incluido" | N/A — no hay endpoint de escritura que un PR pudiera exponer por error |
| Replicar el drift de `apps/web`'s Trust page (`entries` vs `items`, nivel `"critical"` fantasma, `scopeType === "user"`) en mobile | baja (ya verificado y documentado en spec §5) | medio (UI mostraría una lista siempre vacía o un filtro que nunca matchea, como en `apps/web`) | `src/api/trust.ts` se tipó con el `trustOverviewSchema` real de `@semse/schemas`, no copiando el tipo local de `apps/web` | Un test que compara contra `data.entries` o un nivel `"critical"` fallaría primero |

## 9. Investigación externa

No aplica.

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (§7 Fase C)
- [x] Migración y rollback definidos — N/A, documentado
- [x] Tests ordenados antes del código (Fase A antes de Fase C)
- [x] Canary/feature flag definidos — sin flag; canary = build EAS preview + smoke manual
- [x] Evidencia requerida para cada estado de entrega
- [x] Scope cabe en un cambio reversible — solo `apps/mobile` + docs, revertible con `git revert`
