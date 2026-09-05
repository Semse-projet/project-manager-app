---
type: plan
feature: "Mobile Admin Users Directory — Fase 7d de apps/mobile"
domain: "ui"
spec: "docs/specs/ui/mobile-admin-users.spec.md"
version: "1.0"
status: "APPROVED"
branch: "claude/mobile-app-admin-users"
date: "2026-08-26"
---

# Plan técnico: Mobile Admin Users Directory — Fase 7d de apps/mobile

> Prerrequisito: spec `APPROVED`.

## 1. Snapshot de verdad

- Rama nueva desde `origin/main` (`aa96ce5`, PR #583 ya mergeado) — Fase 7c
  (Labor overview, PR #584) sigue abierta en su propia rama, no se
  stackea sobre ella para mantener cada Fase reversible por separado.
- `GET /v1/users` ya existe y ya está en uso por
  `apps/web/app/(app)/admin/users/page.tsx` — confirmado leyendo
  `users.controller.ts:19-30` y `users.repository.ts:110-130`.
- **Drift:** `AdminUsersScreen`/`fetchUsers`/`UserRecordView` no existen
  todavía, confirmado por grep. `packages/schemas/src/user.schema.ts` no
  existe todavía (archivo nuevo).

## 2. Constitution check

- [x] Spec aprobado antes de código.
- [x] Tenant/org/ownership y RBAC definidos — spec §3, `users:read` ya
      otorgado a `OPS_ADMIN`.
- [x] Evidence/Payment Governance revisados — no aplica, sin datos de
      pago/evidencia en esta fase.
- [x] Audit/events definidos — no aplica, lectura pura.
- [x] Tests preceden implementación — Fase A de este plan.
- [x] No se expone secreto ni se agrega backend paralelo.
- [x] Código, CI, merge, deploy y activación se miden por separado.

## 3. Arquitectura y autoridad

- **Módulos afectados (API):** ninguno — se reusa `GET /v1/users` tal cual.
- **Contratos Zod/tipos:** `UserRecordView` nuevo en un archivo nuevo
  `packages/schemas/src/user.schema.ts` — tipo plano (`type`), mismo
  patrón que `TimeEntryView`/`DisputeRecordView` (sin `z.object` completo
  porque el controller no tiene mapper de vista separado).
- **API/BFF/UI:** solo UI + tipos compartidos, sin BFF.
- **ADR requerido:** no — replica el patrón ya establecido por
  `AdminDisputesScreen`/`AdminLaborOverviewScreen`.

## 4. Datos y migración

No aplica.

## 5. Seguridad y política

- **Permisos:** `users:read`, ya otorgado a `OPS_ADMIN`. Explícitamente no
  se toca `users:status:update`/`users:verify` (mutaciones, fuera de
  alcance).
- **Tenant/org/resource scope:** delegado 100% al backend existente.
- **PII:** `email`/`phone` ya visibles hoy para este rol en `apps/web`;
  sin exposición nueva.
- **Abuse cases:** ninguno nuevo — superficie es de solo lectura.

## 6. Eventos, idempotencia y reconstrucción

No aplica.

## 7. Estrategia de implementación

### Fase A — Tests y contratos

- `UserRecordView` nuevo en `packages/schemas/src/user.schema.ts`.
- `AdminUsersScreen.test.tsx`: loading/empty/ready/error, usuario sin
  `phone`, usuario con `flags`.

### Fase B — Datos y dominio

No aplica.

### Fase C — API/BFF/UI

- `src/api/users.ts` — `fetchUsers()`.
- `src/screens/admin/AdminUsersScreen.tsx` — nuevo.
- `src/navigation/AdminTabNavigator.tsx` — agregar tab `Users`.
- `src/navigation/types.ts` — `AdminTabParamList` gana `Users: undefined`.
- `apps/mobile/README.md` — actualizar sección Admin.

### Fase D — Verificación local

- `pnpm --filter @semse/mobile test`, `pnpm --filter @semse/mobile check`.
- `pnpm --filter @semse/schemas build` + `pnpm --filter @semse/api build`.
- `pnpm spec:validate:strict`, `pnpm spec:index`.

### Fase E — Integración

- PR nuevo (mismo criterio que Fase 7c: cada Fase, su propio PR/rama).

### Fase F — Producción

- Build EAS `preview` + smoke manual con cuenta `OPS_ADMIN` real, mismo
  estándar que Fases 7a/7b/7c.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Confundir "contractors" (nombre original de Fase 7) con el CRM de leads real de `apps/web/admin/contractors` y esperar ese flujo en mobile | media | bajo (expectativa de producto, no bug) | Documentado explícitamente en spec §2 por qué se interpretó como directorio de usuarios, no CRM de leads | Feedback de que se necesita el CRM de leads → spec aparte |
| Exponer PII (`email`/`phone`) sin necesidad | baja | bajo | Mismo dato ya visible hoy a este rol en `apps/web`, sin campo nuevo agregado | — |

## 9. Investigación externa

No aplica.

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (§7 Fase C)
- [x] Migración y rollback definidos — N/A
- [x] Tests ordenados antes del código (Fase A antes de Fase C)
- [x] Canary/feature flag definidos — sin flag; canary = build EAS preview + smoke manual
- [x] Evidencia requerida para cada estado de entrega
- [x] Scope cabe en un cambio reversible — `apps/mobile` + un archivo nuevo en `packages/schemas`, revertible con `git revert`
