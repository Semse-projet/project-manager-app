---
type: checklist
feature: "Mobile Admin Trust — Fase 7f de apps/mobile"
spec: "docs/specs/ui/mobile-admin-trust.spec.md"
version: "1.0"
date: "2026-08-26"
---

# Checklist: Mobile Admin Trust — Fase 7f de apps/mobile

> `[x]` = verificado contra el código real en esta sesión, `[ ]` = pendiente
> de PR/CI/deploy/activación, `[N/A]` = no aplica con justificación.

## Requisitos

- [x] Cada escenario P1/P2 es verificable — P1 (tenant-wide) y P2 (filtro)
      cubiertos por `AdminTrustScreen.test.tsx`.
- [x] Scope y no-objetivos evitan ambigüedad — spec §2 lista explícitamente
      qué queda fuera (trust-passport, cualquier mutación, búsqueda/paginación).
- [x] API/UI/agent contracts no se contradicen — cero contratos nuevos, se
      reusa `trustOverviewSchema`/`trustOverviewItemSchema` de
      `@semse/schemas` tal cual; verificado contra el código real del
      backend, no contra el tipo local desalineado de `apps/web`.

## Seguridad

- [x] Permisos se validan en backend — `ops:risk:read` ya otorgado a
      `OPS_ADMIN`; nada nuevo del lado cliente.
- [x] Tenant, org, ownership y resource scope están probados — verificado
      leyendo `ops.repository.ts:listRecentJobsWithProject` (filtro solo
      por `tenantId`, tenant-wide igual que `Disputes`), sin lógica de
      scope nueva que probar en esta fase.
- [N/A] Step-up/aprobación para acciones críticas — ninguna acción de esta
      fase la requiere (solo lectura).
- [x] No hay secretos ni PII en logs/evidencia — `scopeId`/`primaryReason`/
      `flags` se muestran tal cual los devuelve el backend (mismo dato ya
      visible en web para el mismo rol), sin logging nuevo.

## Datos y eventos

- [N/A] Migración — sin cambio de schema.
- [N/A] Backfill/rollback/forward-fix — sin datos nuevos.
- [N/A] Outbox/consumers — sin productores ni consumidores tocados.

## Evidencia y dinero

- [N/A] Evidencia — sin bundles de evidencia en esta superficie.
- [x] Payment Governance bloquea releases incompatibles — no aplica, cero
      endpoints de escrow/pago tocados o alcanzables; no existe ningún
      endpoint de escritura para trust scores que esta fase pudiera
      exponer.
- [N/A] Cálculos financieros — sin cálculos financieros en esta fase.

## Entrega

- [x] Tests, build, typecheck pasan — `pnpm --filter @semse/mobile test`
      (42/42 suites, 187/187 tests) y `pnpm --filter @semse/mobile check`
      (`tsc --noEmit`) verificados en esta sesión.
- [ ] CI, merge, deploy y activación tienen evidencia separada — pendiente,
      se sube en el PR de esta rama.
- [ ] Healthcheck no sustituye smoke funcional — plan §7 Fase F exige un
      run real en device/simulador con cuenta `OPS_ADMIN` real (trust
      scores de más de una org, filtro por nivel).
- [x] Canary, métricas y rollback están definidos — plan §7 Fase F: canary
      = build EAS `preview` + smoke manual; rollback = no promover a
      `production`.
- [N/A] `production_evidence` sin secretos — vacío todavía, se llena en
      Fase 6 de tasks.md.

## Documentación

- [x] Spec index regenerado — `pnpm spec:index` corrido,
      `ui.mobile-admin-trust` indexado.
- [x] `pnpm spec:validate:strict` — 0 errores, 0 warnings.
- [x] `apps/mobile/README.md` actualizado en el mismo cambio que agrega el
      código (mismo hábito que el resto de Fase 7).
- [N/A] API surface/event catalog — sin endpoints ni eventos nuevos.
