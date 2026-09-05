---
type: tasks
feature: "Mobile Client Tab — Fase 2 de apps/mobile"
domain: "ui"
plan: "docs/specs/ui/mobile-client-tab.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "feat/mobile-client-tab"
date: "2026-08-05"
---

# Tareas: Mobile Client Tab — Fase 2 de apps/mobile

> Prerrequisito: plan aprobado y análisis spec↔plan↔constitución sin gaps.
> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.
>
> **2026-08-05: spec aprobado por el usuario.** Bloqueo de T-001 levantado.
> Fases 0–4 (código + verificación local) completadas en la misma sesión —
> ver notas por tarea. Fases 5–6 (PR/CI/merge/deploy/activación) siguen
> pendientes, no se abrió PR ni se corrió build EAS todavía.

## Fase 0 — SDD y verdad

- [x] [T-001] Confirmar spec `APPROVED` e indexado — indexado sí
      (`docs/SPEC_INDEX.md` línea `ui.mobile-client-tab`); `status: APPROVED`
      confirmado por el usuario 2026-08-05.
- [x] [T-002] Registrar SHA Git/producción, migraciones y flags actuales —
      hecho en plan §1 (`origin/main` `1a2d9aea`, SHA desplegado no
      confirmado por Railway MCP `Unauthorized`, sin migración/flag
      aplicable a este feature).
- [x] [T-003] Completar plan, análisis y checklist — plan escrito
      (`docs/specs/ui/mobile-client-tab.plan.md`); "análisis" formal
      spec↔plan↔constitución no se corrió como comando dedicado (no existe
      uno automatizado en este repo más allá de `spec:validate`), se hizo
      a mano al escribir el plan (§2 Constitution check).
- [x] [T-004] Registrar investigación externa y decisiones — N/A, spec §11
      y plan §9 ya lo declaran explícitamente (sin librerías/APIs externas
      nuevas en esta fase).

## Fase 1 — Tests y contratos

- [x] [T-010] Tests escritos: `apps/mobile/src/screens/client/JobsListScreen.test.tsx`,
      `JobDetailScreen.test.tsx`, `RatingFormScreen.test.tsx` — **nota de
      honestidad**: no se siguió red→green estricto archivo por archivo
      (T-013 no se ejecutó como paso separado); se escribió cada pantalla y
      su test en el mismo paso y se corrió jest al final de cada una. La
      cobertura es la misma, pero no hay una corrida registrada del test
      fallando antes del componente existir.
- [x] [T-011] [P] `RatingRecordView` definido en nuevo
      `packages/schemas/src/rating.schema.ts`. Además, no anticipado en el
      plan: `MilestoneRecordView`/`milestoneRecordStatusSchema` en nuevo
      `packages/schemas/src/milestone.schema.ts` — ver spec §5 para el porqué.
- [x] [T-012] [P] `src/api/ratings.ts` (create + list) tipado contra T-011.
      Sin test dedicado propio (`ratings.ts` es un wrapper delgado de
      `apiFetch`, igual que `bids.ts`/`evidence.ts` que tampoco lo tienen);
      se ejerce indirectamente vía `RatingFormScreen.test.tsx`.
- [~] [T-013] No se corrió como paso separado — ver nota en T-010.

## Fase 2 — Datos y dominio

- [x] N/A — sin migración Prisma ni dominio nuevo (plan §4). Fase omitida
      por diseño, no pendiente.

## Fase 3 — API/BFF/UI

- [x] [T-030] N/A confirmado — cero controllers/routes nuevos en `apps/api`
      (solo `packages/schemas` cambió, y `apps/api` build limpio contra eso)
- [x] [T-031] N/A confirmado — sin BFF, mobile sigue hablando directo a `/v1`
- [x] [T-032] UI implementada — los 4 archivos listados más
      `src/screens/client/ClientSettingsScreen.tsx` (no listado en el plan
      original: `SettingsScreen` de Worker es 100% `proximityCheckInMode`,
      no aplicaba a CLIENT, así que se necesitó uno propio en vez de
      reusar). Estados cubiertos: `loading`/`empty`/`ready`/`error` en las
      3 pantallas de datos; `forbidden` no tiene un estado dedicado en UI
      (un 403 cae en el mismo `error` genérico) — aceptable para esta fase,
      no hay acción que dispare 403 en el camino feliz de un CLIENT sobre
      sus propios recursos; `degraded` no aplica (sin datos parciales que
      mostrar en estos endpoints).
- [x] [T-033] Documentación actualizada: `apps/mobile/README.md` (sección
      de Client ya no dice placeholder, incluye el hallazgo de push/bids;
      `Structure` actualizado) y `RoleGate.tsx` (comentario corregido).
- [x] [T-034] Ver Fase 4 — todos los tests pasan en verde.

## Fase 4 — Verificación local

- [x] [T-040] `pnpm --filter @semse/mobile test` — 18/18 suites, 89/89 tests
- [x] [T-041] Misma corrida cubre Worker — sin regresiones
- [x] [T-042] `pnpm --filter @semse/mobile check` limpio,
      `pnpm --filter @semse/api build` limpio (tras `pnpm --filter @semse/schemas build`
      — necesario para que el workspace linkeara los tipos nuevos).
      `pnpm typecheck` (raíz) **no se pudo correr** — `scripts/workspace-runner.mjs`
      intenta `require("pnpm/bin/pnpm.cjs")` y este entorno usa un `pnpm`
      global (binario, no dependencia local de `node_modules`), falla con
      `MODULE_NOT_FOUND`. Preexistente al script (uno de los archivos ya
      modificados sin commitear desde antes de esta sesión), no algo que
      esta fase rompió — no se intentó arreglar por estar fuera de alcance.
      Mitigado corriendo `check`/`build` por paquete en su lugar, que sí
      cubre todo lo que cambió.
- [x] [T-043] `pnpm spec:validate:strict` limpio para `mobile-client-tab.spec.md`
- [x] [T-044] `pnpm spec:coverage` (lista el spec como high-risk-no-`VERIFIED`,
      correcto para el estado real) y `pnpm spec:index` (107 specs, indexado)
- [x] [T-045] Spec actualizado a `code_status: COMPLETE`, `status: IMPLEMENTED`

## Fase 5 — PR, CI y merge

- [ ] [T-050] Revisar diff y secretos (`git status`/`git diff` completo antes de `git add`, mismo hábito ya seguido en esta sesión)
- [ ] [T-051] Abrir PR — sin migración que documentar; incluir evidencia de T-040/T-042 en la descripción
- [ ] [T-052] Esperar CI terminal y registrar `ci_status`
- [ ] [T-053] Resolver review sin ampliar scope — en particular, resistir la tentación de agregar marketplace/job-posting/pagos en el mismo PR (ver riesgo de scope creep en plan §8)
- [ ] [T-054] Fusionar y registrar SHA; actualizar `merge_status`

## Fase 6 — Deploy y activación

- [ ] [T-060] Verificar pre-deploy — N/A migración, confirmar solamente que `pnpm build:packages`/`eas-build-post-install` (ya configurado en `apps/mobile/package.json`) sigue funcionando
- [ ] [T-061] Esperar deployment terminal — no aplica a `apps/api`/`apps/web`/`apps/worker` (sin cambios ahí); aplica al build EAS
- [ ] [T-062] `eas build --profile preview --platform all`, verificar que el build termina sin error
- [ ] [T-063] N/A canary/flag — no hay flag para esta fase (plan §7 Fase F)
- [ ] [T-064] Ejecutar smoke autenticado **real**, en device/simulador, con una cuenta `CLIENT` real (no solo `tsc --noEmit`) — cubrir: ver jobs, abrir detalle, aceptar un bid, aprobar un milestone, enviar un rating
- [ ] [T-065] Validar que las acciones de dinero (fund/deposit/release) siguen sin ser alcanzables desde esta superficie — smoke negativo explícito, dado el `risk: high` del spec
- [ ] [T-066] Promover el build a `production` o pausar/revertir según el resultado de T-064/T-065
- [ ] [T-067] Registrar `production_evidence`, `last_verified` y `status: VERIFIED` en el spec

## Criterio de Done

- [ ] Código completo y tests verdes
- [ ] CI `PASS`
- [ ] Merge `MERGED`
- [ ] Build EAS `preview` probado en device/simulador real (equivalente a `DEPLOYED` para esta superficie sin backend propio)
- [ ] Activación: smoke manual `CLIENT` real confirmado, incluido el smoke negativo de T-065
- [ ] Migración `NOT_APPLICABLE` (confirmado, no asumido)
- [ ] Evidencia de producción enlazada (grabación o capturas del run real)
- [ ] `docs/SPEC_INDEX.md` actualizado (`pnpm spec:index`)
