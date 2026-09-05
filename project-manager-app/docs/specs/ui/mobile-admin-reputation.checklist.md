---
type: checklist
feature: "Mobile Admin Reputation — Fase 7h de apps/mobile"
spec: "docs/specs/ui/mobile-admin-reputation.spec.md"
version: "1.0"
date: "2026-08-26"
---

# Checklist: Mobile Admin Reputation — Fase 7h de apps/mobile

> `[x]` = verificado contra el código real en esta sesión, `[ ]` = pendiente
> de PR/CI/deploy/activación, `[N/A]` = no aplica con justificación.

## Requisitos

- [x] Cada escenario P1 es verificable — cubierto por
      `AdminReputationScreen.test.tsx`.
- [x] Scope y no-objetivos evitan ambigüedad — spec §2 lista explícitamente
      qué queda fuera (detalle de ratings individuales, filtros/búsqueda,
      cualquier mutación).
- [x] API/UI/agent contracts no se contradicen — cero contratos nuevos, se
      reusa `reputationScoreViewSchema`/`ReputationScoreView` de
      `@semse/schemas` tal cual; verificado contra el código real del
      backend, no contra el tipo local desalineado de `apps/web`.

## Seguridad

- [x] Permisos se validan en backend — `ratings:read` ya otorgado a
      `OPS_ADMIN`; nada nuevo del lado cliente.
- [x] Tenant, org, ownership y resource scope están probados — verificado
      leyendo `reputation.service.ts:computeBatchForTenant` (filtro solo
      por `tenantId`, tenant-wide igual que `Disputes`/`Trust`), sin
      lógica de scope nueva que probar en esta fase.
- [N/A] Step-up/aprobación para acciones críticas — ninguna acción de esta
      fase la requiere (solo lectura).
- [x] No hay secretos ni PII en logs/evidencia — el `userId` se muestra
      truncado, y el backend nunca adjunta email/nombre a esta respuesta
      (verificado), así que la superficie de PII expuesta es menor que la
      de `apps/web`'s propia página, no mayor.

## Datos y eventos

- [N/A] Migración — sin cambio de schema.
- [N/A] Backfill/rollback/forward-fix — sin datos nuevos.
- [N/A] Outbox/consumers — sin productores ni consumidores tocados.

## Evidencia y dinero

- [N/A] Evidencia — sin bundles de evidencia en esta superficie.
- [x] Payment Governance bloquea releases incompatibles — no aplica, cero
      endpoints de escrow/pago tocados o alcanzables; no existe ningún
      endpoint de escritura para reputación que esta fase pudiera
      exponer.
- [N/A] Cálculos financieros — sin cálculos financieros en esta fase.

## Entrega

- [x] Tests, build, typecheck pasan — `pnpm --filter @semse/mobile test`
      (43/43 suites, 191/191 tests) y `pnpm --filter @semse/mobile check`
      (`tsc --noEmit`) verificados en esta sesión.
- [x] CI, merge, deploy y activación tienen evidencia separada — CI `PASS`
      y merge `MERGED` (PR #589, SHA `862f13f`); deploy/activación siguen
      pendientes de build EAS + smoke manual (Fase F).
- [ ] Healthcheck no sustituye smoke funcional — plan §7 Fase F exige un
      run real en device/simulador con cuenta `OPS_ADMIN` real (reputación
      de más de una org).
- [x] Canary, métricas y rollback están definidos — plan §7 Fase F: canary
      = build EAS `preview` + smoke manual; rollback = no promover a
      `production`.
- [N/A] `production_evidence` sin secretos — vacío todavía, se llena en
      Fase 6 de tasks.md.

## Documentación

- [x] Spec index regenerado — `pnpm spec:index` corrido,
      `ui.mobile-admin-reputation` indexado.
- [x] `pnpm spec:validate:strict` — 0 errores, 0 warnings.
- [x] `apps/mobile/README.md` actualizado en el mismo cambio que agrega el
      código (mismo hábito que el resto de Fase 7).
- [N/A] API surface/event catalog — sin endpoints ni eventos nuevos.
