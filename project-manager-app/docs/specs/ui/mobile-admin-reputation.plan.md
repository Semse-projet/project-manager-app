---
type: plan
feature: "Mobile Admin Reputation — Fase 7h de apps/mobile"
domain: "ui"
spec: "docs/specs/ui/mobile-admin-reputation.spec.md"
version: "1.0"
status: "APPROVED"
branch: "claude/roadmap-continuation-vhmve9"
date: "2026-08-26"
---

# Plan técnico: Mobile Admin Reputation — Fase 7h de apps/mobile

> Prerrequisito: spec `APPROVED`.

## 1. Snapshot de verdad

- Rama de trabajo (`claude/roadmap-continuation-vhmve9`) fue reiniciada
  desde `origin/main` tras el merge de PR #588 — trae Fase 7a-7f ya
  mergeadas (PRs #583/#584/#585/#586/#587) y el spec `DRAFT` de Fase 7g
  (`mobile-admin-disputes-resolution.spec.md`, sin implementar, sin
  código asociado).
- `docs/specs/ui/mobile-admin-trust.spec.md` (`IMPLEMENTED`) es el
  precedente directo — mismo patrón de tab nuevo + cliente API dedicado
  reusando un contrato Zod ya existente en `@semse/schemas`.
- **Drift confirmado (no replicado):** `apps/web/app/(app)/admin/
  reputation/page.tsx` declara un campo opcional `user?: { email }` que
  `reputation.service.ts:computeForUser` nunca puebla — verificado leyendo
  el `return` del servicio. Su UI cae siempre al fallback de id truncado.
- **Drift de superficie:** `AdminReputationScreen`/`src/api/reputation.ts`
  no existen todavía, confirmado por grep.

## 2. Constitution check

- [x] Spec aprobado antes de código — este documento se escribe con spec ya
      `APPROVED`.
- [x] Tenant/org/ownership y RBAC definidos — spec §3, `ratings:read` ya
      otorgado a `OPS_ADMIN`, scoping tenant-wide verificado en
      `reputation.service.ts:computeBatchForTenant`.
- [x] Evidence/Payment Governance revisados — sin evidencia ni pagos
      alcanzables desde esta superficie; lectura pura, sin ninguna
      mutación posible (no existe endpoint de escritura para reputación).
- [x] Audit/events definidos — no aplica, `GET` no emite `AuditLog`.
- [x] Tests preceden implementación — Fase A de este plan.
- [x] No se expone secreto ni se agrega backend paralelo.
- [x] Código, CI, merge, deploy y activación se miden por separado.

## 3. Arquitectura y autoridad

- **Módulos afectados (API):** ninguno — se reusa `GET
  /v1/ratings/reputation` tal cual.
- **Contratos Zod:** ninguno nuevo — `reputationScoreViewSchema` ya existe
  en `packages/schemas/src/reputation.schema.ts` y ya se exporta desde el
  barrel del paquete.
- **API/BFF/UI:** solo UI, mismo patrón sin-BFF que el resto de
  `apps/mobile`.
- **ADR requerido:** no — replica el patrón ya establecido por
  `AdminTrustScreen`/`AdminUsersScreen` (lista + cards de stats, sin
  stack).

## 4. Datos y migración

No aplica.

## 5. Seguridad y política

- **Permisos:** `ratings:read`, ya otorgado a `OPS_ADMIN` en
  `packages/db/prisma/seed.ts`. Sin permisos nuevos.
- **Tenant/org/resource scope:** delegado 100% al backend existente
  (`computeBatchForTenant` ya filtra por `tenantId`), sin lógica de scope
  nueva del lado cliente.
- **Abuse cases:** ninguno nuevo — superficie es de solo lectura, sin
  ningún endpoint de escritura que alcanzar.

## 6. Eventos, idempotencia y reconstrucción

No aplica.

## 7. Estrategia de implementación

### Fase A — Tests y contratos

- `AdminReputationScreen.test.tsx`: loading/empty/ready/error, cards de
  conteo, listado ordenado con tier+score+señales, fallback de id
  truncado, ausencia de acciones mutantes/detalle de ratings.

### Fase B — Datos y dominio

No aplica.

### Fase C — API/BFF/UI

- `src/api/reputation.ts` — nuevo cliente (`fetchReputationBatch`),
  tipado con `ReputationScoreView` de `@semse/schemas`.
- `src/screens/admin/AdminReputationScreen.tsx` — nuevo, mismo patrón de
  cards de stats + lista que `AdminTrustScreen.tsx`.
- `src/navigation/AdminTabNavigator.tsx` — agregar tab `Reputation` entre
  `Trust` y `Settings`.
- `src/navigation/types.ts` — `AdminTabParamList` gana `Reputation: undefined`.
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
  con cuenta `OPS_ADMIN` real que tenga profesionales con reputación
  calculada en más de una org, mismo estándar que el resto de Fase 7.
- **Rollback:** no promover el build `preview` a `production` hasta smoke
  manual confirmado; sin flag que revertir.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Confundir este scope acotado con el detalle de ratings individuales de `apps/web` | baja | bajo | Este plan solo cubre lo listado en spec §2 "Incluido"; el detalle de ratings por profesional necesita su propio spec | PR que agrega navegación a un detalle de ratings bajo este cambio → rechazar en review |
| Replicar el drift de `apps/web`'s Reputation page (`user?.email` que nunca existe) en mobile | baja (ya verificado y documentado en spec §5) | bajo (UI mostraría un campo `undefined` en vez de un fallback intencional) | `AdminReputationScreen.tsx` usa el mismo fallback de id truncado que `apps/web`, documentado como tal, no como una feature nueva | Un test que espera un email en vez del id truncado fallaría primero |

## 9. Investigación externa

No aplica.

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (§7 Fase C)
- [x] Migración y rollback definidos — N/A, documentado
- [x] Tests ordenados antes del código (Fase A antes de Fase C)
- [x] Canary/feature flag definidos — sin flag; canary = build EAS preview + smoke manual
- [x] Evidencia requerida para cada estado de entrega
- [x] Scope cabe en un cambio reversible — solo `apps/mobile` + docs, revertible con `git revert`
