---
type: plan
feature: "Mobile Admin Disputes — Fase 7b de apps/mobile"
domain: "ui"
spec: "docs/specs/ui/mobile-admin-disputes.spec.md"
version: "1.0"
status: "APPROVED"
branch: "claude/mobile-app-f17ci6"
date: "2026-08-17"
---

# Plan técnico: Mobile Admin Disputes — Fase 7b de apps/mobile

> Prerrequisito: spec `APPROVED`.

## 1. Snapshot de verdad

- Rama de trabajo (`claude/mobile-app-f17ci6`) trae Fase 7a ya mergeada
  localmente (`AdminTabNavigator` con `Dashboard`+`Settings` reales, PR #583
  abierto, CI verde, compliance bot en ✅).
- `docs/specs/ui/mobile-admin-dashboard.spec.md` (`IMPLEMENTED`) es el
  precedente directo de este spec — mismo patrón de reuso de un endpoint
  `GET` ya consumido por otro rol.
- **Drift:** ninguno — `AdminDisputesStackNavigator`/`AdminDisputesScreen`/
  `AdminDisputeDetailScreen` no existen todavía, confirmado por grep.

## 2. Constitution check

- [x] Spec aprobado antes de código — este documento se escribe con spec ya
      `APPROVED`.
- [x] Tenant/org/ownership y RBAC definidos — spec §3, `disputes:read` ya
      otorgado a `OPS_ADMIN`, `buildOwnershipWhere` ya scopea tenant-wide
      para ese rol (verificado en código, `disputes.repository.ts:307-310`).
- [x] Evidence/Payment Governance revisados — evidencia no se renderiza
      (fuera de alcance explícito, spec §2); ninguna acción de pago o
      liberación de escrow es alcanzable (assign/resolve excluidos).
- [x] Audit/events definidos — no aplica, lectura pura.
- [x] Tests preceden implementación — Fase A de este plan.
- [x] No se expone secreto ni se agrega backend paralelo.
- [x] Código, CI, merge, deploy y activación se miden por separado.

## 3. Arquitectura y autoridad

- **Módulos afectados (API):** ninguno — se reusa `GET /v1/disputes` tal
  cual.
- **Contratos Zod:** ninguno nuevo — `DisputeRecordView` ya existe.
- **API/BFF/UI:** solo UI, mismo patrón sin-BFF que el resto de
  `apps/mobile`.
- **ADR requerido:** no — replica el patrón ya establecido por
  `AdminDashboardScreen`/`ClientJobsStackNavigator`.

## 4. Datos y migración

No aplica.

## 5. Seguridad y política

- **Permisos:** `disputes:read`, ya otorgado a `OPS_ADMIN`. Sin permisos
  nuevos, sin exponer `disputes:assign`/`disputes:resolve` en esta fase.
- **Tenant/org/resource scope:** delegado 100% al backend existente
  (`buildOwnershipWhere` ya lo resuelve, sin lógica de scope nueva del lado
  cliente).
- **Abuse cases:** ninguno nuevo — superficie es de solo lectura.

## 6. Eventos, idempotencia y reconstrucción

No aplica.

## 7. Estrategia de implementación

### Fase A — Tests y contratos

- `AdminDisputesScreen.test.tsx`: loading/empty/ready/error (mock de
  `fetchDisputes`).
- `AdminDisputeDetailScreen.test.tsx`: disputa encontrada (resuelta y sin
  resolver) / no encontrada / error de carga.

### Fase B — Datos y dominio

No aplica.

### Fase C — API/BFF/UI

- `src/navigation/AdminDisputesStackNavigator.tsx` — nuevo, mismo patrón
  que `ClientJobsStackNavigator.tsx`.
- `src/screens/admin/AdminDisputesScreen.tsx`,
  `AdminDisputeDetailScreen.tsx` — nuevos, reusan
  `DISPUTE_STATUS_LABEL`/`DISPUTE_STATUS_COLOR_KEY` de
  `src/screens/worker/jobStatus.ts` (mismo cross-import ya establecido por
  `client/JobsListScreen.tsx`).
- `src/navigation/AdminTabNavigator.tsx` — agregar tab `Disputes` entre
  `Dashboard` y `Settings`.
- `src/navigation/types.ts` — `AdminTabParamList` + nuevo
  `AdminDisputesStackParamList`.
- `apps/mobile/README.md` — actualizar sección Admin.

### Fase D — Verificación local

- `pnpm --filter @semse/mobile test` — suite completa.
- `pnpm --filter @semse/mobile check` (`tsc --noEmit`).
- `pnpm spec:validate:strict`, `pnpm spec:index`.

### Fase E — Integración

- Commit sobre PR #583 ya abierto (mismo branch designado de esta sesión) —
  no se abre PR nuevo.

### Fase F — Producción

- Sin servicio backend que desplegar — build EAS `preview` + smoke manual
  con cuenta `OPS_ADMIN` real que tenga disputas visibles de más de una
  org, mismo estándar que Fase 7a.
- **Rollback:** no promover el build `preview` a `production` hasta smoke
  manual confirmado; sin flag que revertir.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Confundir este scope acotado con el resto de Fase 7 (assign/resolve, evidencia, finance, contractors, labor-engine) | media | alto (viola AGENTS.md, mezcla riesgo de payment governance sin su propio spec) | Este plan solo cubre lo listado en spec §2 "Incluido"; cualquier acción mutante necesita su propio spec | PR que agrega un botón de assign/resolve bajo este cambio → rechazar en review |
| Un `OPS_ADMIN` con pocas disputas de prueba no ejercita el caso interesante (tenant-wide vs. org-scoped) en el smoke manual | media | bajo (gap de cobertura de QA, no de código) | Documentado explícitamente en spec §8 como requisito de la evidencia de producción | Smoke que solo prueba con 1 org no cierra el gate a `VERIFIED` |

## 9. Investigación externa

No aplica.

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (§7 Fase C)
- [x] Migración y rollback definidos — N/A, documentado
- [x] Tests ordenados antes del código (Fase A antes de Fase C)
- [x] Canary/feature flag definidos — sin flag; canary = build EAS preview + smoke manual
- [x] Evidencia requerida para cada estado de entrega
- [x] Scope cabe en un cambio reversible — solo `apps/mobile` + docs, revertible con `git revert`
