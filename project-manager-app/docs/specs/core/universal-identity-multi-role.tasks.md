---
type: tasks
feature: "F10 — Identidad universal con múltiples capacidades por cuenta"
domain: "core"
plan: "docs/specs/core/universal-identity-multi-role.plan.md"
version: "1.0"
status: "PENDING"
branch: "TBD — crear en T-003"
date: "2026-08-04"
---

# Tareas: Identidad universal con múltiples capacidades por cuenta

> Spec `APPROVED` 2026-08-04, Fase 0 resuelta el mismo día. Listo para
> empezar en Fase 1.

## Fase 0 — Preflight (RESUELTA 2026-08-04)

- [x] **T-001** Capacidad activa se deriva 100% del proyecto/org abierto,
      nunca de preferencia guardada.
- [x] **T-002** `CLIENT`/`PRO`/`WORKER` confirmados como roles reales
      distintos (cliente / profesional independiente / trabajador de
      compañía-contratista); el hallazgo `PRO`/"Profesional" (URL/label)
      queda fuera de este incremento.
- [ ] **T-003** Crear rama de implementación desde `origin/main` limpio.

## Fase 1 — Tests antes del código

- [ ] **T-010** Test: `GET /v1/users/me/capabilities` devuelve solo las
      `Membership` del usuario autenticado.
- [ ] **T-011** Test de aislamiento cross-org (spec §4, caso borde).
- [ ] **T-012** Test: UI deriva capacidad activa del proyecto abierto.

## Fase 2 — Endpoint de lectura

- [ ] **T-020** Implementar `GET /v1/users/me/capabilities`.
- [ ] **T-021** Decidir e implementar (si aplica) el registro de auditoría
      de conmutación de capacidad.

## Fase 3 — UI

- [ ] **T-030** Selector de capacidad activa (header/dashboard).
- [ ] **T-031** Badge de capacidad por proyecto.
- [ ] **T-032** Unificar etiqueta de rol en las superficies acotadas por
      T-002.

## Fase 4 — Validación y cierre

- [ ] **T-040** `pnpm spec:validate:strict` en verde.
- [ ] **T-041** Actualizar `IMPLEMENTATION_STATUS_MATRIX.md` (fila F10).
- [ ] **T-042** Actualizar `ROADMAP.md` §F10.
- [ ] **T-043** Evidencia de producción: journey real de un usuario con dos
      capacidades, antes de mover el spec a `VERIFIED`.

## Criterio de cierre

- [ ] Ningún usuario puede ejercer permisos de una capacidad fuera del
      `orgId` donde la tiene otorgada.
- [ ] La capacidad mostrada por defecto siempre coincide con el contexto
      del proyecto abierto.
- [ ] `pnpm spec:validate:strict` verde.
- [ ] Spec marcado `IMPLEMENTED`/`VERIFIED` solo con evidencia de
      producción real, no por existencia de código.
