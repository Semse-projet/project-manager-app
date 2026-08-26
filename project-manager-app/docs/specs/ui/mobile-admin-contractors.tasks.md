---
type: tasks
feature: "Mobile Admin Contractors — Fase 7c de apps/mobile"
domain: "ui"
plan: "docs/specs/ui/mobile-admin-contractors.plan.md"
version: "1.0"
status: "IN_PROGRESS"
branch: "claude/roadmap-continuation-vhmve9"
date: "2026-08-26"
---

# Tareas: Mobile Admin Contractors — Fase 7c de apps/mobile

> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [x] [T-001] Spec `APPROVED` e indexado (indexado en Fase 4).
- [x] [T-002] Registrar estado de la rama — plan §1.
- [x] [T-003] Plan escrito y coherente con el spec.

## Fase 1 — Tests y contratos

- [x] [T-010] `AdminContractorsScreen.test.tsx` escrito.

## Fase 2 — Datos y dominio

- [x] N/A — sin migración ni dominio nuevo.

## Fase 3 — API/BFF/UI

- [x] [T-030] N/A confirmado — cero endpoints/controllers nuevos.
- [x] [T-031] N/A confirmado — sin BFF.
- [x] [T-032] UI implementada: `src/api/contractor.ts`,
      `AdminContractorsScreen.tsx`, `AdminTabNavigator.tsx` (tab
      `Contractors` agregado), `types.ts`, `RoleGate.tsx`.
- [x] [T-033] Documentación actualizada: `apps/mobile/README.md`.

## Fase 4 — Verificación local

- [x] [T-040] `pnpm --filter @semse/mobile test` verde, sin regresiones.
- [x] [T-041] `pnpm --filter @semse/mobile check` (`tsc --noEmit`) limpio.
- [x] [T-042] `pnpm spec:index` corrido.
- [x] [T-043] Spec actualizado a `code_status: COMPLETE`, `status: IMPLEMENTED`.

## Fase 5 — PR, CI y merge

- [x] [T-050] Revisar diff y secretos antes de `git add`.
- [ ] [T-051] Commit + push a `claude/roadmap-continuation-vhmve9`, abrir PR
      draft con evidencia de T-040/T-041.
- [ ] [T-052] Esperar CI terminal y registrar `ci_status`.
- [ ] [T-053] Resolver review sin ampliar scope (resistir agregar
      status-change/delete/estimate).
- [ ] [T-054] Fusionar y registrar SHA; actualizar `merge_status`.

## Fase 6 — Deploy y activación

- [ ] [T-060] `eas build --profile preview --platform all`.
- [ ] [T-061] Smoke autenticado real con cuenta `OPS_ADMIN` real: ver leads
      existentes de su org, crear uno nuevo, confirmar que aparece en la
      lista y en los conteos.
- [ ] [T-062] Promover a `production` o pausar según resultado de T-061.
- [ ] [T-063] Registrar `production_evidence`, `last_verified`, `status: VERIFIED`.

## Criterio de Done

- [ ] Código completo y tests verdes
- [ ] CI `PASS`
- [ ] Merge `MERGED`
- [ ] Build EAS `preview` probado en device/simulador real
- [ ] Activación: smoke manual `OPS_ADMIN` real confirmado (ver + crear)
- [ ] `docs/SPEC_INDEX.md` actualizado
