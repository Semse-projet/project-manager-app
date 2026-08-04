---
type: tasks
feature: "F10 — Identidad universal con múltiples capacidades por cuenta"
domain: "core"
plan: "docs/specs/core/universal-identity-multi-role.plan.md"
version: "1.0"
status: "PENDING"
branch: "TBD — crear en T-003 tras cerrar T-001/T-002"
date: "2026-08-04"
---

# Tareas: Identidad universal con múltiples capacidades por cuenta

> Spec `APPROVED` 2026-08-04. Lo que queda bloqueando código real no es el
> contrato (ya autorizado) sino las decisiones de producto de Fase 0
> (T-001/T-002) — confirmarlas con el owner antes de T-003.

## Fase 0 — Preflight (bloqueada)

- [ ] **T-001** Confirmar con el owner el alcance exacto de "capacidad
      activa por contexto" (spec/plan Fase 0).
- [ ] **T-002** Decidir si el hallazgo `PRO`/"Profesional" de
      `AUDIT_REMEDIATION_PLAN.md` entra en este incremento.
- [ ] **T-003** Crear rama de implementación desde `origin/main` limpio
      solo después de T-001/T-002 y de que el spec esté `APPROVED`.

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
