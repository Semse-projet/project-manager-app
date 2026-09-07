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
> ver notas por tarea.
>
> **2026-09-06: actualización de estado.** Fase 5 quedó cerrada fuera de
> este `tasks.md`: el código de Client Fase 2 se mergeó a `main` en
> **PR #542** (`699e2a2e`, 2026-08-06) y recibió retoques de UX en **#556**
> y **#558**. CI de esos PRs pasó al mergear. Falta solo la Fase 6: build
> EAS `preview` + smoke real en device con cuenta `CLIENT` + marcar el spec
> `VERIFIED`. Builds `preview` de iOS ya corrieron en EAS (2026-09-06); en
> esta sesión se lanzó el `preview` de Android desde `main` `88171003`. El
> smoke de T-064/T-065 lo ejecuta el usuario en device — sigue pendiente.

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

> **Cerrada 2026-08-06 vía PR #542**, no con una rama `feat/mobile-client-tab`
> dedicada — el código de Client Fase 2 entró junto con Worker Fase 1
> extendido + push notifications en el mismo PR (`699e2a2e`). UX afinada
> después en #556 (Client Jobs UX uplift) y #558.

- [x] [T-050] Revisado en el PR #542; sin secretos en el diff de `apps/mobile`.
- [x] [T-051] PR #542 abierto y descrito (ver también #556 / #558).
- [x] [T-052] CI de #542/#556/#558 en verde al mergear → `ci_status: PASS`.
- [x] [T-053] Scope respetado — no se agregó marketplace/job-posting/pagos.
- [x] [T-054] Fusionado en `main` `699e2a2e` (2026-08-06) → `merge_status: MERGED`.

## Fase 6 — Deploy y activación

- [x] [T-060] Pre-deploy — sin migración; `eas-build-post-install`
      (`cd ../.. && pnpm run build:packages`) sigue configurado en
      `apps/mobile/package.json` y corrió OK en los builds EAS previos.
- [x] [T-061] N/A `apps/api`/`apps/web`/`apps/worker` (sin cambios); el
      "deployment" de esta superficie es el build EAS.
- [~] [T-062] `eas build --profile preview` — builds `preview` de **iOS**
      terminados en EAS el 2026-09-06 (proyecto `semse-mobile`, cuenta
      `semseproject.com`). **Android**: build `167bd926-bd28-4d4f-a6b7-f6d98b7bd05d`
      lanzado en esta sesión desde `main` `88171003`
      (`--profile preview --platform android --non-interactive`), `in progress`
      al momento de escribir. Falta confirmar que termina sin error y anotar
      su Application Archive URL (APK) para el sideload del smoke.
- [x] [T-063] N/A canary/flag — sin flag para esta fase (plan §7 Fase F).
- [ ] [T-064] **Pendiente — lo ejecuta el usuario en device.** Smoke
      autenticado real con cuenta `CLIENT`: ver jobs, abrir detalle, aceptar
      un bid, aprobar un milestone, enviar un rating. Runbook en
      `docs/specs/ui/mobile-client-tab.smoke.md`.
- [ ] [T-065] **Pendiente — smoke negativo, en el mismo run que T-064.**
      Confirmar que fund/deposit/release no son alcanzables desde esta
      superficie (spec `risk: high`).
- [ ] [T-066] Promover a `production` o revertir según T-064/T-065.
- [ ] [T-067] Registrar `production_evidence`, `last_verified` y
      `status: VERIFIED` en el spec una vez que el smoke pase.

## Criterio de Done

- [ ] Código completo y tests verdes
- [ ] CI `PASS`
- [ ] Merge `MERGED`
- [ ] Build EAS `preview` probado en device/simulador real (equivalente a `DEPLOYED` para esta superficie sin backend propio)
- [ ] Activación: smoke manual `CLIENT` real confirmado, incluido el smoke negativo de T-065
- [ ] Migración `NOT_APPLICABLE` (confirmado, no asumido)
- [ ] Evidencia de producción enlazada (grabación o capturas del run real)
- [ ] `docs/SPEC_INDEX.md` actualizado (`pnpm spec:index`)
