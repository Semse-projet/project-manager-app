---
type: checklist
feature: "Mobile Admin Labor Engine Overview — Fase 7c de apps/mobile"
spec: "docs/specs/ui/mobile-admin-labor-overview.spec.md"
version: "1.0"
date: "2026-08-19"
---

# Checklist: Mobile Admin Labor Engine Overview — Fase 7c de apps/mobile

> `[x]` = verificado contra el código real en esta sesión, `[ ]` = pendiente
> de PR/CI/deploy/activación, `[N/A]` = no aplica con justificación.

## Requisitos

- [x] Cada escenario P1/P2 es verificable — cubiertos por
      `AdminLaborOverviewScreen.test.tsx` (alertas de cada tipo, resumen de
      equipo, caso sin tarifa configurada).
- [x] Scope y no-objetivos evitan ambigüedad — spec §2: sin resolución de
      nombre, sin mutación de timers ajenos, sin matching, sin ajuste de
      umbrales, sin paginación.
- [x] API/UI/agent contracts no se contradicen — cero contratos de API
      nuevos; tipos nuevos en `packages/schemas` solo describen la
      respuesta ya real de `GET /v1/labor/admin/overview`.

## Seguridad

- [x] Permisos se validan en backend — `ops:dashboard:read` ya otorgado a
      `OPS_ADMIN`; nada nuevo del lado cliente.
- [x] Tenant, org, ownership y resource scope están probados — el servicio
      ya agrega a nivel de tenant completo (`getAdminOverview(tenantId)`,
      sin filtro de org — verificado en código).
- [N/A] Step-up/aprobación — ninguna acción de esta fase requiere step-up
      (solo lectura).
- [x] No hay secretos ni PII en logs/evidencia — `workerId` se muestra
      truncado, sin logging nuevo.

## Datos y eventos

- [N/A] Migración — sin cambio de schema Prisma.
- [N/A] Backfill/rollback/forward-fix — sin datos nuevos.
- [N/A] Outbox/consumers — sin productores ni consumidores tocados.

## Evidencia y dinero

- [x] Evidencia no se confunde con aprobación automática — no aplica, esta
      fase no toca evidencia.
- [x] Payment Governance bloquea releases incompatibles — no aplica, cero
      endpoints de pago/escrow tocados o alcanzables; `knownCost` es
      informativo, mismo tratamiento que `activeBudget` de Fase 7a (ya
      aceptado sin revisión de payment governance dedicada).
- [N/A] Cálculos financieros — `knownCost` ya viene calculado
      server-side, sin cálculo nuevo del lado cliente.

## Entrega

- [x] Tests, build, typecheck pasan — `pnpm --filter @semse/mobile test`
      (39/39 suites, 171/171 tests), `pnpm --filter @semse/mobile check`
      (`tsc --noEmit`), `pnpm --filter @semse/schemas build` y
      `pnpm --filter @semse/api build` limpios en esta sesión.
- [ ] CI, merge, deploy y activación tienen evidencia separada — pendiente,
      se sube como commit adicional sobre PR #583 ya abierto.
- [ ] Healthcheck no sustituye smoke funcional — plan §7 Fase F exige un
      run real en device/simulador con cuenta `OPS_ADMIN` real.
- [x] Canary, métricas y rollback están definidos — plan §7 Fase F: canary
      = build EAS `preview` + smoke manual; rollback = no promover a
      `production`.
- [N/A] `production_evidence` sin secretos — vacío todavía, se llena en
      Fase 6 de tasks.md.

## Documentación

- [x] Spec index regenerado — `pnpm spec:index` corrido,
      `ui.mobile-admin-labor-overview` indexado.
- [x] `pnpm spec:validate:strict` — 0 errores, 0 warnings.
- [x] `apps/mobile/README.md` actualizado en el mismo cambio que agrega el
      código (mismo hábito que Fases 2/7a/7b).
- [N/A] API surface/event catalog — sin endpoints ni eventos nuevos
      (`GET /v1/labor/admin/overview` ya listado en uso por `apps/web`).
