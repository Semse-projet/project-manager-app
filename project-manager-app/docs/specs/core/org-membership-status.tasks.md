---
type: tasks
feature: "org-membership-status"
domain: "core"
plan: "docs/specs/core/org-membership-status.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "feat/ws01c-org-context-switch-slice1"
date: "2026-09-18"
---

# Tareas: Membership lifecycle status

> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [x] [T-001] Confirmar SHA base (`origin/main@5d1c4b24`) y ausencia de drift de migraciones antes de tocar el schema.
- [x] [T-002] Descubrir y reconciliar `universal-identity-multi-role.spec.md` — llevó a reducir el alcance del slice original de ADR-040 (ver addendum del ADR).
- [x] [T-003] Escribir spec/plan/tasks reducidos (este set de archivos).
- [~] [T-004] Checklist de cierre — creado pero con puntos pendientes reales, no completado en falso.

## Fase 1 — Tests y contratos

- [x] [T-010] Escribir test de regresión para el escenario P1/P2 del spec (`auth-login-membership-status.service.test.ts`).
- [ ] [T-011] Schemas compartidos — no aplica, sin contrato Zod existente que extender (ver plan §3).

## Fase 2 — Datos y dominio

- [x] [T-020] Migración Prisma `add_membership_status`, generada y aplicada localmente.
- [x] [T-021] `AuthRepository.findUserByEmail` filtra `status: "ACTIVE"` en la relación `memberships`.
- [x] [T-022] `UsersRepository.findMembershipsByUser` / `UsersService.getMyCapabilities` exponen `status`.
- [ ] [T-023] Pasar tests unitarios y de persistencia — pendiente de ejecución real (ver reporte de sesión para el resultado).

## Fase 3 — API/BFF/UI

- [x] [T-030] Sin endpoint nuevo — cambio de comportamiento interno en dos endpoints existentes.
- [ ] [T-031] BFF — no aplica, ningún endpoint nuevo consumido desde `apps/web`.
- [ ] [T-032] UI — no aplica, explícitamente fuera de alcance.

## Fase 4 — Verificación local

- [x] [T-040] `pnpm --filter @semse/api build` (`nest build`) — verde.
- [~] [T-041] `pnpm --filter @semse/api test:unit` — el runner de la suite
      completa falla con `ENAMETOOLONG` en este worktree (ruta de Windows
      demasiado larga para el argv de `node --test` con ~200 archivos, no
      relacionado con este cambio). Verificado en su lugar con
      `node --experimental-strip-types --test` acotado a los archivos
      relevantes: `auth-login-membership-status.service.test.ts` (2/2),
      `users.service.test.ts` (16/16, incluye un fix necesario a un test
      preexistente), `auth-demo-mode`/`auth-password-change`/`auth-password`/`auth-token`
      (16/16). Sin correr: el resto de la suite (~190 archivos) — no se
      pudo confirmar ausencia de regresión fuera de los módulos tocados.
- [~] [T-042] `pnpm typecheck` — terminado por el harness por presión de
      memoria del sistema (no por error de tipos); instrucción explícita de
      no reintentarlo en esta sesión. `nest build` de `@semse/api` sí
      valida tipos de ese paquete y pasó.
- [ ] [T-043] `pnpm spec:validate` sobre el spec nuevo — no ejecutado.
- [ ] [T-044] `pnpm spec:index` — no ejecutado en esta sesión.
- [x] [T-045] Spec actualizado a `code_status: IN_PROGRESS` (no `COMPLETE`
      — T-042/043/044 y la suite completa de T-041 siguen pendientes).

## Fase 5 — PR, CI y merge

- [~] [T-050] Revisar diff (`git diff --stat`) — pendiente de reporte final, BLOQUEADO por decisión del usuario de si se pushea.
- [~] [T-051] Abrir PR — explícitamente NO ejecutado en esta sesión por directiva (worktree solo commitea local).
- [ ] [T-052] CI — no aplica sin PR.

## Explícitamente fuera de este set de tareas (ver spec §2 "Fuera de alcance / BLOCKED")

- `OrgContextService`, endpoints `/v1/me/context`, `/v1/me/context/switch`,
  `/v1/me/organizations` — bloqueados pendiente de decisión del owner sobre
  su convivencia con `universal-identity-multi-role.spec.md`.
