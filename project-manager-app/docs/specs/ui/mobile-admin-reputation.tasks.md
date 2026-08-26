---
type: tasks
feature: "Mobile Admin Reputation — Fase 7h de apps/mobile"
domain: "ui"
plan: "docs/specs/ui/mobile-admin-reputation.plan.md"
version: "1.0"
status: "IN_PROGRESS"
branch: "claude/roadmap-continuation-vhmve9"
date: "2026-08-26"
---

# Tareas: Mobile Admin Reputation — Fase 7h de apps/mobile

> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [x] [T-001] Spec `APPROVED` e indexado (indexado en Fase 4).
- [x] [T-002] Registrar estado de la rama — plan §1.
- [x] [T-003] Plan escrito y coherente con el spec.

## Fase 1 — Tests y contratos

- [x] [T-010] `AdminReputationScreen.test.tsx` escrito.

## Fase 2 — Datos y dominio

- [x] N/A — sin migración ni dominio nuevo.

## Fase 3 — API/BFF/UI

- [x] [T-030] N/A confirmado — cero endpoints/controllers nuevos.
- [x] [T-031] N/A confirmado — sin BFF.
- [x] [T-032] UI implementada: `src/api/reputation.ts`,
      `AdminReputationScreen.tsx`, `AdminTabNavigator.tsx` (tab
      `Reputation` agregado), `types.ts`.
- [x] [T-033] Documentación actualizada: `apps/mobile/README.md`.

## Fase 4 — Verificación local

- [x] [T-040] `pnpm --filter @semse/mobile test` verde, sin regresiones.
- [x] [T-041] `pnpm --filter @semse/mobile check` (`tsc --noEmit`) limpio.
- [x] [T-042] `pnpm spec:index` corrido.
- [x] [T-043] Spec actualizado a `code_status: COMPLETE`, `status: IMPLEMENTED`.

## Fase 5 — PR, CI y merge

- [x] [T-050] Revisar diff y secretos antes de `git add`.
- [x] [T-051] Commit + push a `claude/roadmap-continuation-vhmve9`, abrir PR
      draft con evidencia de T-040/T-041 — PR #589.
- [x] [T-052] Esperar CI terminal y registrar `ci_status` — `ci_status: PASS`
      (único status check del PR, "Devin Review", en `success`).
- [x] [T-053] Resolver review sin ampliar scope — sin comentarios de review
      que requirieran cambios.
- [x] [T-054] Fusionar y registrar SHA; actualizar `merge_status` —
      mergeado en `862f13f`, `merge_status: MERGED`.

## Fase 6 — Deploy y activación

- [ ] [T-060] `eas build --profile preview --platform all`.
- [ ] [T-061] Smoke autenticado real con cuenta `OPS_ADMIN` real: ver
      reputación de profesionales de más de una org, confirmar orden y
      señales.
- [ ] [T-062] Promover a `production` o pausar según resultado de T-061.
- [ ] [T-063] Registrar `production_evidence`, `last_verified`, `status: VERIFIED`.

## Criterio de Done

- [ ] Código completo y tests verdes
- [ ] CI `PASS`
- [ ] Merge `MERGED`
- [ ] Build EAS `preview` probado en device/simulador real
- [ ] Activación: smoke manual `OPS_ADMIN` real confirmado, incluido el caso tenant-wide
- [ ] `docs/SPEC_INDEX.md` actualizado
