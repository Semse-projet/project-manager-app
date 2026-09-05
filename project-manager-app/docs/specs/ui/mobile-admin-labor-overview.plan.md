---
type: plan
feature: "Mobile Admin Labor Engine Overview — Fase 7c de apps/mobile"
domain: "ui"
spec: "docs/specs/ui/mobile-admin-labor-overview.spec.md"
version: "1.0"
status: "APPROVED"
branch: "claude/mobile-app-f17ci6"
date: "2026-08-19"
---

# Plan técnico: Mobile Admin Labor Engine Overview — Fase 7c de apps/mobile

> Prerrequisito: spec `APPROVED`.

## 1. Snapshot de verdad

- Rama de trabajo trae Fase 7a (Dashboard+Settings) y Fase 7b (Disputes,
  read-only) ya en PR #583, CI verde, compliance bot en ✅.
- `GET /v1/labor/admin/overview` ya existe y ya está en uso por
  `apps/web/app/(app)/admin/labor-engine/page.tsx` — confirmado leyendo
  `labor-engine.controller.ts:322-328` y `labor-engine.service.ts:428-499`.
- **Drift:** `AdminLaborOverviewScreen`/`fetchAdminLaborOverview`/
  `AdminLaborOverviewView` no existen todavía, confirmado por grep.

## 2. Constitution check

- [x] Spec aprobado antes de código.
- [x] Tenant/org/ownership y RBAC definidos — spec §3, `ops:dashboard:read`
      ya otorgado a `OPS_ADMIN`.
- [x] Evidence/Payment Governance revisados — `knownCost` es informativo,
      mismo tratamiento que `activeBudget` de Fase 7a (spec §3, nota
      "Datos monetarios mostrados").
- [x] Audit/events definidos — no aplica, lectura pura.
- [x] Tests preceden implementación — Fase A de este plan.
- [x] No se expone secreto ni se agrega backend paralelo.
- [x] Código, CI, merge, deploy y activación se miden por separado.

## 3. Arquitectura y autoridad

- **Módulos afectados (API):** ninguno — se reusa `GET /v1/labor/admin/overview`
  tal cual, sin tocar `apps/api`.
- **Contratos Zod/tipos:** `AdminLaborOverviewView` y anidados nuevos en
  `packages/schemas/src/labor-engine.schema.ts` — tipos planos (`type`),
  mismo patrón que `TimeEntryView`/`FreeProjectView` en el mismo archivo
  (el controller no tiene mapper de vista separado que valga la pena
  espejar con un `z.object` completo).
- **API/BFF/UI:** solo UI + tipos compartidos, sin BFF (mobile habla
  directo a `/v1`).
- **ADR requerido:** no — replica el patrón ya establecido por
  `AdminDashboardScreen`/`AdminDisputesScreen`.

## 4. Datos y migración

No aplica.

## 5. Seguridad y política

- **Permisos:** `ops:dashboard:read`, ya otorgado a `OPS_ADMIN`.
- **Tenant/org/resource scope:** delegado 100% al backend existente.
- **Abuse cases:** ninguno nuevo — superficie es de solo lectura.

## 6. Eventos, idempotencia y reconstrucción

No aplica.

## 7. Estrategia de implementación

### Fase A — Tests y contratos

- Tipos nuevos en `packages/schemas/src/labor-engine.schema.ts`.
- `AdminLaborOverviewScreen.test.tsx`: loading/empty/ready/error, cada tipo
  de alerta, fila de equipo con `knownCost: 0`.

### Fase B — Datos y dominio

No aplica.

### Fase C — API/BFF/UI

- `src/api/labor.ts` — `fetchAdminLaborOverview()`.
- `src/screens/admin/AdminLaborOverviewScreen.tsx` — nuevo.
- `src/navigation/AdminTabNavigator.tsx` — agregar tab `Labor` entre
  `Disputes` y `Settings`.
- `src/navigation/types.ts` — `AdminTabParamList` gana `Labor: undefined`.
- `apps/mobile/README.md` — actualizar sección Admin.

### Fase D — Verificación local

- `pnpm --filter @semse/mobile test`, `pnpm --filter @semse/mobile check`.
- `pnpm --filter @semse/schemas build` + `pnpm --filter @semse/api build`
  (confirmar que el tipo nuevo no rompe el consumidor API).
- `pnpm spec:validate:strict`, `pnpm spec:index`.

### Fase E — Integración

- Commit sobre PR #583 ya abierto.

### Fase F — Producción

- Build EAS `preview` + smoke manual con cuenta `OPS_ADMIN` real, mismo
  estándar que Fases 7a/7b.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Mostrar `knownCost` sin contexto se lee como una cifra "oficial" de nómina cuando en realidad es un cálculo derivado (tarifa × horas, sin ajustes manuales) | baja | bajo | Mismo tratamiento informativo que `activeBudget` ya en producción vía Fase 7a; sin acción de pago alcanzable | Confusión reportada por un admin real en el smoke manual |
| `workerId` sin resolver a nombre hace la pantalla menos útil que la versión web | media | bajo (UX, no de datos) | Documentado explícitamente como fuera de alcance (spec §2); admin puede cruzar en `/admin/users/:id` | Feedback de que esto bloquea el uso real → spec de seguimiento para resolver nombres |

## 9. Investigación externa

No aplica.

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (§7 Fase C)
- [x] Migración y rollback definidos — N/A
- [x] Tests ordenados antes del código (Fase A antes de Fase C)
- [x] Canary/feature flag definidos — sin flag; canary = build EAS preview + smoke manual
- [x] Evidencia requerida para cada estado de entrega
- [x] Scope cabe en un cambio reversible — `apps/mobile` + un tipo en `packages/schemas`, revertible con `git revert`
