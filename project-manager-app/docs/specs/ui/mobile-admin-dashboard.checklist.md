---
type: checklist
feature: "Mobile Admin Dashboard — Fase 7a de apps/mobile"
spec: "docs/specs/ui/mobile-admin-dashboard.spec.md"
version: "1.0"
date: "2026-08-17"
---

# Checklist: Mobile Admin Dashboard — Fase 7a de apps/mobile

> `[x]` = verificado contra el código real en esta sesión, `[ ]` = pendiente
> de PR/CI/deploy/activación, `[N/A]` = no aplica con justificación.

## Requisitos

- [x] Cada escenario P1/P2 es verificable — P1 ya cubierto por
      `AdminDashboardScreen.test.tsx` (preexistente, sin cambios), P2 por el
      `AdminSettingsScreen.test.tsx` nuevo.
- [x] Scope y no-objetivos evitan ambigüedad — spec §2 lista explícitamente
      qué queda fuera (contractors, finance, disputes management,
      labor-engine overview — resto de Fase 7).
- [x] API/UI/agent contracts no se contradicen — cero contratos nuevos, se
      reusa `GET /v1/jobs` / `JobRecordView` tal cual.

## Seguridad

- [x] Permisos se validan en backend — `jobs:read` ya otorgado a
      `OPS_ADMIN` en `packages/db/prisma/seed.ts`; nada nuevo del lado
      cliente.
- [x] Tenant, org, ownership y resource scope están probados — heredado de
      `JobsService.list`, sin lógica de scope nueva.
- [N/A] Step-up/aprobación para acciones críticas — ninguna acción de esta
      fase requiere step-up (solo lectura + logout).
- [x] No hay secretos ni PII en logs/evidencia — sin logs nuevos, sin
      evidencia tocada.

## Datos y eventos

- [N/A] Migración — sin cambio de schema.
- [N/A] Backfill/rollback/forward-fix — sin datos nuevos.
- [N/A] Outbox/consumers — sin productores ni consumidores tocados.

## Evidencia y dinero

- [N/A] Evidencia — no aplica, esta fase no toca evidencia.
- [x] Payment Governance bloquea releases incompatibles — no aplica, cero
      endpoints de escrow/pago/finance tocados o alcanzables desde esta
      superficie.
- [N/A] Cálculos financieros — sin cálculos financieros nuevos (el
      "presupuesto activo" del dashboard ya existía, sin cambios).

## Entrega

- [x] Tests, build, typecheck pasan — `pnpm --filter @semse/mobile test`
      (36/36 suites, 157/157 tests) y `pnpm --filter @semse/mobile check`
      (`tsc --noEmit`) limpios en esta sesión.
- [ ] CI, merge, deploy y activación tienen evidencia separada — pendiente,
      estructura definida en plan §7 Fases E–F / tasks.md Fases 5–6.
- [ ] Healthcheck no sustituye smoke funcional — plan §7 Fase F exige un
      run real en device/simulador con cuenta `OPS_ADMIN` real, no solo
      `tsc --noEmit`.
- [x] Canary, métricas y rollback están definidos — plan §7 Fase F: canary
      = build EAS `preview` + smoke manual; rollback = no promover a
      `production`.
- [N/A] `production_evidence` sin secretos — vacío todavía, se llena en
      Fase 6 de tasks.md.

## Documentación

- [x] Spec index regenerado — `pnpm spec:index` corrido, `ui.mobile-admin-dashboard`
      indexado (109 specs totales).
- [x] `pnpm spec:validate:strict` — 0 errores, 0 warnings.
- [x] `apps/mobile/README.md`, `RoleGate.tsx` actualizados en el mismo
      cambio que agrega el código (mismo hábito que Fase 2).
- [N/A] API surface/event catalog — sin endpoints ni eventos nuevos.
