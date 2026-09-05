---
type: checklist
feature: "Mobile Admin Users Directory — Fase 7d de apps/mobile"
spec: "docs/specs/ui/mobile-admin-users.spec.md"
version: "1.0"
date: "2026-08-26"
---

# Checklist: Mobile Admin Users Directory — Fase 7d de apps/mobile

> `[x]` = verificado contra el código real en esta sesión, `[ ]` = pendiente
> de PR/CI/deploy/activación, `[N/A]` = no aplica con justificación.

## Requisitos

- [x] Cada escenario P1 es verificable — cubierto por
      `AdminUsersScreen.test.tsx` (usuario con datos completos, sin
      teléfono, con flags, tenant vacío, error de red).
- [x] Scope y no-objetivos evitan ambigüedad — spec §2: sin cambio de
      status, sin verificación, sin edición de perfil, sin memberships,
      sin búsqueda/filtros, sin el CRM de leads.
- [x] API/UI/agent contracts no se contradicen — cero contratos nuevos, se
      reusa `GET /v1/users` tal cual.

## Seguridad

- [x] Permisos se validan en backend — `users:read` ya otorgado a
      `OPS_ADMIN`; nada nuevo del lado cliente.
- [x] Tenant, org, ownership y resource scope están probados — verificado
      en código (`users.repository.ts:110-130`): la query filtra solo por
      `tenantId`, sin condición de rol.
- [N/A] Step-up/aprobación — ninguna acción de esta fase requiere step-up
      (solo lectura).
- [x] No hay secretos ni PII expuesta de más — `email`/`phone` ya
      visibles hoy a este rol en `apps/web`, sin dato nuevo agregado, sin
      logging nuevo.

## Datos y eventos

- [N/A] Migración — sin cambio de schema Prisma.
- [N/A] Backfill/rollback/forward-fix — sin datos nuevos.
- [N/A] Outbox/consumers — sin productores ni consumidores tocados.

## Evidencia y dinero

- [N/A] Evidencia — no aplica, esta fase no toca evidencia.
- [x] Payment Governance bloquea releases incompatibles — no aplica, cero
      endpoints de pago/escrow tocados o alcanzables.
- [N/A] Cálculos financieros — sin cálculos financieros en esta fase.

## Entrega

- [x] Tests, build, typecheck pasan — `pnpm --filter @semse/mobile test`
      (39/39 suites, 172/172 tests), `pnpm --filter @semse/mobile check`
      (`tsc --noEmit`), `pnpm --filter @semse/schemas build` y
      `pnpm --filter @semse/api build` limpios en esta sesión.
- [ ] CI, merge, deploy y activación tienen evidencia separada — pendiente
      de PR; el incidente repo-wide de GitHub Actions documentado en PR
      #584 sigue sin resolverse al momento de escribir esto, así que CI
      real puede no correr hasta que se resuelva del lado de billing/
      branch-protection.
- [ ] Healthcheck no sustituye smoke funcional — plan §7 Fase F exige un
      run real en device/simulador con cuenta `OPS_ADMIN` real.
- [x] Canary, métricas y rollback están definidos — plan §7 Fase F: canary
      = build EAS `preview` + smoke manual; rollback = no promover a
      `production`.
- [N/A] `production_evidence` sin secretos — vacío todavía, se llena en
      Fase 6 de tasks.md.

## Documentación

- [x] Spec index regenerado — `pnpm spec:index` corrido,
      `ui.mobile-admin-users` indexado.
- [x] `pnpm spec:validate:strict` — 0 errores, 0 warnings.
- [x] `apps/mobile/README.md` actualizado en el mismo cambio que agrega el
      código (mismo hábito que Fases 2/7a/7b/7c).
- [N/A] API surface/event catalog — sin endpoints ni eventos nuevos.
