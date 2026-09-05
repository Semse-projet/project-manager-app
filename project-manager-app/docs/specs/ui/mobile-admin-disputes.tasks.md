---
type: tasks
feature: "Mobile Admin Disputes — Fase 7b de apps/mobile"
domain: "ui"
plan: "docs/specs/ui/mobile-admin-disputes.plan.md"
version: "1.0"
status: "IN_PROGRESS"
branch: "claude/mobile-app-f17ci6"
date: "2026-08-17"
---

# Tareas: Mobile Admin Disputes — Fase 7b de apps/mobile

> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [x] [T-001] Spec `APPROVED` e indexado (indexado en Fase 4).
- [x] [T-002] Registrar estado de la rama — plan §1.
- [x] [T-003] Plan escrito y coherente con el spec.

## Fase 1 — Tests y contratos

- [x] [T-010] `AdminDisputesScreen.test.tsx` escrito.
- [x] [T-011] `AdminDisputeDetailScreen.test.tsx` escrito.

## Fase 2 — Datos y dominio

- [x] N/A — sin migración ni dominio nuevo.

## Fase 3 — API/BFF/UI

- [x] [T-030] N/A confirmado — cero endpoints/controllers nuevos.
- [x] [T-031] N/A confirmado — sin BFF.
- [x] [T-032] UI implementada: `AdminDisputesStackNavigator.tsx`,
      `AdminDisputesScreen.tsx`, `AdminDisputeDetailScreen.tsx`,
      `AdminTabNavigator.tsx` (tab `Disputes` agregado), `types.ts`.
- [x] [T-033] Documentación actualizada: `apps/mobile/README.md`.

## Fase 4 — Verificación local

- [x] [T-040] `pnpm --filter @semse/mobile test` verde, sin regresiones.
- [x] [T-041] `pnpm --filter @semse/mobile check` (`tsc --noEmit`) limpio.
- [x] [T-042] `pnpm spec:index` corrido.
- [x] [T-043] Spec actualizado a `code_status: COMPLETE`, `status: IMPLEMENTED`.

## Fase 5 — PR, CI y merge

- [x] [T-050] Revisar diff y secretos antes de `git add` — diff revisado, 9
      archivos nuevos + 4 modificados, todo dentro de scope declarado.
- [ ] [T-051] Commit sobre PR #583 ya abierto, con evidencia de T-040/T-041.
- [ ] [T-052] Esperar CI terminal y registrar `ci_status`.
- [ ] [T-053] Resolver review sin ampliar scope (resistir agregar assign/resolve).
- [ ] [T-054] Fusionar y registrar SHA; actualizar `merge_status`.

## Fase 6 — Deploy y activación

- [ ] [T-060] `eas build --profile preview --platform all`.
- [ ] [T-061] Smoke autenticado real con cuenta `OPS_ADMIN` real: ver
      disputas de más de una org, abrir detalle resuelto y sin resolver.
- [ ] [T-062] Promover a `production` o pausar según resultado de T-061.
- [ ] [T-063] Registrar `production_evidence`, `last_verified`, `status: VERIFIED`.

## Criterio de Done

- [ ] Código completo y tests verdes
- [ ] CI `PASS`
- [ ] Merge `MERGED`
- [ ] Build EAS `preview` probado en device/simulador real
- [ ] Activación: smoke manual `OPS_ADMIN` real confirmado, incluido el caso tenant-wide
- [ ] `docs/SPEC_INDEX.md` actualizado
