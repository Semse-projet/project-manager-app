---
type: checklist
feature: "org-membership-status"
spec: "docs/specs/core/org-membership-status.spec.md"
version: "2.0"
date: "2026-09-18"
---

# Checklist: Membership lifecycle status

## Requisitos

- [x] Cada escenario P1/P2 es verificable — cubiertos por
      `auth-login-membership-status.service.test.ts`.
- [x] Scope y no-objetivos evitan ambigüedad — la mitad "switch" del slice
      original queda explícitamente `BLOCKED`, no ambigua.
- [x] API/UI/agent contracts no se contradicen — `GET /v1/users/me/capabilities`
      gana un campo aditivo, ningún consumidor existente se rompe.

## Seguridad

- [x] Permisos se validan en backend — sin cambio de permisos en este slice.
- [x] Tenant, org, ownership y resource scope están probados — sin cambio,
      el filtro nuevo es adicional al `tenantId` ya existente.
- [ ] Step-up/aprobación existe para acciones críticas — no aplica, sin
      acción crítica nueva.
- [x] No hay secretos ni PII en logs/evidencia — sin cambio de logging.

## Datos y eventos

- [x] Migración es reproducible y compatible — `add_membership_status`,
      expand-only, backfill automático.
- [x] Backfill, rollback o forward-fix están definidos (spec §7).
- [ ] Estado + outbox son atómicos cuando aplica — no aplica, sin evento
      nuevo.
- [ ] Consumers son idempotentes y replayables — no aplica.

## Evidencia y dinero

- [x] Evidencia no se confunde con aprobación automática — no aplica a este
      slice (sin evidencia involucrada).
- [x] Payment Governance bloquea releases incompatibles — no tocado, no
      aplica.
- [x] Cálculos financieros excluyen fallos/reversals — no aplica.

## Entrega

- [x] Tests: verificados con ejecución real — `apps/api/test/auth-login-membership-status.service.test.ts`
      (2/2), `apps/api/test/users.service.test.ts` (16/16, incluye el fix
      del test preexistente que asumía el shape viejo sin `status`), y los
      4 tests de auth adyacentes (auth-demo-mode, auth-password-change,
      auth-password, auth-token — 16/16) — todos corridos directo con
      `node --experimental-strip-types --test` (el runner de la suite
      completa, `pnpm --filter @semse/api test:unit`, falla con
      `ENAMETOOLONG` en este worktree por la longitud de su ruta en
      Windows, no por el código — ver reporte de sesión).
- [x] Build: `pnpm --filter @semse/api build` (`nest build`) verde.
- [ ] Typecheck workspace completo (`pnpm typecheck`): **no verificado** —
      el proceso fue terminado por el harness por presión de memoria del
      sistema, no por un error de tipos. No reintentado por instrucción
      explícita del harness. Riesgo residual bajo (el build de `@semse/api`
      vía `nest build`/`tsc` sí pasó, y el diff es pequeño y con tipos
      explícitos), pero no es evidencia sustituta de un typecheck real de
      todo el workspace (`apps/web` incluido).
- [ ] Lint: no ejecutado en esta sesión.
- [ ] CI, merge, deploy y activación tienen evidencia separada — no
      aplica todavía, sin PR abierto.
- [ ] Healthcheck no sustituye smoke funcional — no aplica, sin deploy.
- [x] Canary, métricas y rollback están definidos — spec §8 documenta
      explícitamente que no hace falta canary (sin comportamiento
      observable hasta que exista escritura de `status`).
- [x] `production_evidence` no contiene secretos — vacío, correcto dado que
      no hay evidencia de producción todavía.

## Documentación

- [ ] Spec index regenerado (`pnpm spec:index`) — no ejecutado en esta
      sesión.
- [x] API surface/event catalog/matriz/roadmap actualizados si aplica — no
      aplica, sin evento ni endpoint nuevo que registrar en
      `EVENT_CATALOG.md`/`SEMSE_API_SURFACE_V1.md`.
- [x] Investigación externa y decisiones registradas — el hallazgo de
      conflicto con `universal-identity-multi-role.spec.md` está documentado
      en el addendum de ADR-040 y en la spec §2.
