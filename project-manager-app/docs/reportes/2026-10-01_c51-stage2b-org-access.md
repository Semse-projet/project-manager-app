# C51 etapa 2b — comparaciones manuales de orgId → `sameOrg`

Fecha: 2026-10-01 · Rama: `claude/c51-stage2b` · Estado C51: **PARTIAL** (sin smoke multi-tenant autenticado).

## Cambios (solo API, sin migración ni flags)
Una org vacía/ausente ya nunca coincide. Se migraron decisiones de acceso en: live-sessions (resource-access),
budget-intelligence, buildops-plan-approval (2), buildops-legacy-promotion, intake-operations-bridge, travel,
bids.repository (accept y create), ratings.repository (cliente/profesional).
Dirección: igualdad que concede → `sameOrg`; denegación `!==` → `!sameOrg`. No se tocó ninguna prohibición.

## Pruebas
`apps/api/test/c51-stage2b-org-access.test.ts` (3): comportamiento negativo en live-sessions y plan-approval
(org vacía, cross-org, partes legítimas, OPS_ADMIN) + guarda de fuente. Suite API: 2715 tests, 0 fallos, 38 omitidos. typecheck limpio.

## Pendiente
Quedan sin migrar: originator, users, contributor-program, domain-events, workspace-memory
(workspace-memory.repository.ts:96 compara con `input.orgId &&`; requiere decisión de semántica) y bids.repository.ts:400
(comparación de reserva en conflicto, no es acceso). Etapa 3 (resolver + guarda CI) necesita PR de CI autorizado.
