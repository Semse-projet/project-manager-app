---
type: checklist
feature: "Mobile Admin Disputes — Fase 7b de apps/mobile"
spec: "docs/specs/ui/mobile-admin-disputes.spec.md"
version: "1.0"
date: "2026-08-17"
---

# Checklist: Mobile Admin Disputes — Fase 7b de apps/mobile

> `[x]` = verificado contra el código real en esta sesión, `[ ]` = pendiente
> de PR/CI/deploy/activación, `[N/A]` = no aplica con justificación.

## Requisitos

- [x] Cada escenario P1/P2 es verificable — P1 (tenant-wide) y P2 (detalle)
      cubiertos por `AdminDisputesScreen.test.tsx`/
      `AdminDisputeDetailScreen.test.tsx`.
- [x] Scope y no-objetivos evitan ambigüedad — spec §2 lista explícitamente
      qué queda fuera (assign, resolve, mark-under-review, archive/restore,
      ver evidencia, crear disputa).
- [x] API/UI/agent contracts no se contradicen — cero contratos nuevos, se
      reusa `GET /v1/disputes` / `DisputeRecordView` tal cual.

## Seguridad

- [x] Permisos se validan en backend — `disputes:read` ya otorgado a
      `OPS_ADMIN`; nada nuevo del lado cliente.
- [x] Tenant, org, ownership y resource scope están probados — verificado
      leyendo `disputes.repository.ts:307-310`
      (`buildOwnershipWhere` vacío solo para `OPS_ADMIN`), sin lógica de
      scope nueva que probar en esta fase.
- [N/A] Step-up/aprobación para acciones críticas — ninguna acción de esta
      fase requiere step-up (solo lectura).
- [x] No hay secretos ni PII en logs/evidencia — `assigneeUserId` se
      muestra tal cual lo devuelve el backend (mismo dato ya visible en
      web para el mismo rol), sin logging nuevo.

## Datos y eventos

- [N/A] Migración — sin cambio de schema.
- [N/A] Backfill/rollback/forward-fix — sin datos nuevos.
- [N/A] Outbox/consumers — sin productores ni consumidores tocados.

## Evidencia y dinero

- [x] Evidencia no se confunde con aprobación automática — el detalle solo
      informa cuántos bundles de evidencia existen, no los renderiza ni
      permite ninguna acción sobre ellos.
- [x] Payment Governance bloquea releases incompatibles — no aplica, cero
      endpoints de escrow/pago/resolución tocados o alcanzables desde esta
      superficie (assign/resolve explícitamente fuera de alcance).
- [N/A] Cálculos financieros — sin cálculos financieros en esta fase.

## Entrega

- [x] Tests, build, typecheck pasan — `pnpm --filter @semse/mobile test`
      (38/38 suites, 166/166 tests) y `pnpm --filter @semse/mobile check`
      (`tsc --noEmit`) limpios en esta sesión.
- [ ] CI, merge, deploy y activación tienen evidencia separada — pendiente,
      se sube como commit adicional sobre PR #583 ya abierto.
- [ ] Healthcheck no sustituye smoke funcional — plan §7 Fase F exige un
      run real en device/simulador con cuenta `OPS_ADMIN` real que tenga
      disputas de más de una org (el caso interesante de esta fase).
- [x] Canary, métricas y rollback están definidos — plan §7 Fase F: canary
      = build EAS `preview` + smoke manual; rollback = no promover a
      `production`.
- [N/A] `production_evidence` sin secretos — vacío todavía, se llena en
      Fase 6 de tasks.md.

## Documentación

- [x] Spec index regenerado — `pnpm spec:index` corrido,
      `ui.mobile-admin-disputes` indexado.
- [x] `pnpm spec:validate:strict` — 0 errores, 0 warnings.
- [x] `apps/mobile/README.md` actualizado en el mismo cambio que agrega el
      código (mismo hábito que Fases 2/7a).
- [N/A] API surface/event catalog — sin endpoints ni eventos nuevos.
