---
type: checklist
feature: "Mobile Admin Contractors — Fase 7e de apps/mobile"
spec: "docs/specs/ui/mobile-admin-contractors.spec.md"
version: "1.0"
date: "2026-08-26"
---

# Checklist: Mobile Admin Contractors — Fase 7e de apps/mobile

> `[x]` = verificado contra el código real en esta sesión, `[ ]` = pendiente
> de PR/CI/deploy/activación, `[N/A]` = no aplica con justificación.

## Requisitos

- [x] Cada escenario P1/P2 es verificable — P1 (lista+stats org-scoped) y P2
      (creación) cubiertos por `AdminContractorsScreen.test.tsx`.
- [x] Scope y no-objetivos evitan ambigüedad — spec §2 lista explícitamente
      qué queda fuera (status change, delete, suggest/create-estimate,
      detalle editable, filtros en UI).
- [x] API/UI/agent contracts no se contradicen — cero contratos nuevos, se
      reusan `GET`/`POST /v1/contractor/leads[/stats]` tal cual; tipos TS
      del cliente verificados contra `contractor.service.ts` línea por
      línea (spec §5).

## Seguridad

- [x] Permisos se validan en backend — `jobs:read`/`jobs:create` ya
      otorgados a `OPS_ADMIN`; nada nuevo del lado cliente.
- [x] Tenant, org, ownership y resource scope están probados — verificado
      leyendo `contractor.service.ts` (`listLeads`/`getStats`/`createLead`
      todos filtran/graban por `tenantId`+`orgId` del contexto de request),
      sin lógica de scope nueva que probar en esta fase.
- [N/A] Step-up/aprobación para acciones críticas — crear un lead es
      aditivo, no requiere step-up (spec §3).
- [x] No hay secretos ni PII en logs/evidencia — nombre/teléfono/email se
      muestran tal cual los devuelve el backend (mismo dato ya visible en
      web para el mismo rol), sin logging nuevo.

## Datos y eventos

- [N/A] Migración — sin cambio de schema.
- [N/A] Backfill/rollback/forward-fix — sin datos nuevos.
- [N/A] Outbox/consumers — sin productores ni consumidores tocados.

## Evidencia y dinero

- [N/A] Evidencia — sin bundles de evidencia en esta superficie.
- [x] Payment Governance bloquea releases incompatibles — no aplica, cero
      endpoints de escrow/pago/estimado/factura tocados o alcanzables desde
      esta superficie (`suggest-estimate`/`create-estimate` explícitamente
      fuera de alcance).
- [N/A] Cálculos financieros — sin cálculos financieros en esta fase.

## Entrega

- [x] Tests, build, typecheck pasan — `pnpm --filter @semse/mobile test` y
      `pnpm --filter @semse/mobile check` (`tsc --noEmit`) verificados en
      esta sesión.
- [ ] CI, merge, deploy y activación tienen evidencia separada — pendiente,
      se sube en el PR de esta rama.
- [ ] Healthcheck no sustituye smoke funcional — plan §7 Fase F exige un
      run real en device/simulador con cuenta `OPS_ADMIN` real (ver + crear
      un lead).
- [x] Canary, métricas y rollback están definidos — plan §7 Fase F: canary
      = build EAS `preview` + smoke manual; rollback = no promover a
      `production`.
- [N/A] `production_evidence` sin secretos — vacío todavía, se llena en
      Fase 6 de tasks.md.

## Documentación

- [x] Spec index regenerado — `pnpm spec:index` corrido,
      `ui.mobile-admin-contractors` indexado.
- [x] `pnpm spec:validate:strict` — 0 errores, 0 warnings.
- [x] `apps/mobile/README.md` actualizado en el mismo cambio que agrega el
      código (mismo hábito que Fases 2/7a/7b).
- [N/A] API surface/event catalog — sin endpoints ni eventos nuevos.
