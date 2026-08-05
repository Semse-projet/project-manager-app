---
type: tasks
feature: "F10 — Identidad universal con múltiples capacidades por cuenta"
domain: "core"
plan: "docs/specs/core/universal-identity-multi-role.plan.md"
version: "1.0"
status: "PENDING"
branch: "feat/f10-identity-capabilities-endpoint"
date: "2026-08-05"
---

# Tareas: Identidad universal con múltiples capacidades por cuenta

> Spec `APPROVED` 2026-08-04. Fase 0 resuelta el mismo día. Fases 1-2
> (endpoint de lectura) implementadas y verificadas 2026-08-05. Fase 3
> (selector de UI) y Fase 4 (cierre) siguen pendientes.

## Fase 0 — Preflight (RESUELTA 2026-08-04)

- [x] **T-001** Capacidad activa se deriva 100% del proyecto/org abierto,
      nunca de preferencia guardada.
- [x] **T-002** `CLIENT`/`PRO`/`WORKER` confirmados como roles reales
      distintos (cliente / profesional independiente / trabajador de
      compañía-contratista); el hallazgo `PRO`/"Profesional" (URL/label)
      queda fuera de este incremento.
- [x] **T-003** Rama `feat/f10-identity-capabilities-endpoint` creada
      (2026-08-05).

## Fase 1 — Tests antes del código

- [x] **T-010** Test: `getMyCapabilities` devuelve las `Membership` del
      actor mapeadas a `{role, orgId, verifiedAt}`
      (`apps/api/test/users.service.test.ts`).
- [x] **T-011** Test: la llamada a `findMembershipsByUser` usa
      `tenantId`/`targetUserId`/`userId` del actor autenticado, nunca un
      target arbitrario — mismo aislamiento tenant que el resto de
      `UsersService` (spec §4, caso borde).
- [ ] **T-012** Test: UI deriva capacidad activa del proyecto abierto —
      pendiente de Fase 3 (todavía no existe el selector de UI).

## Fase 2 — Endpoint de lectura

- [x] **T-020** Implementado `GET /v1/users/me/capabilities`
      (`users.controller.ts`, `users.service.ts`) — reutiliza
      `findMembershipsByUser` existente, sin nuevo modelo Prisma. Build
      limpio, suite completa `@semse/api` 2095/2095 en verde.
- [x] **T-021** Decidido: **sin auditoría** para este endpoint — es
      puramente de lectura (spec §5, `audit_log: no`); no hay "conmutación"
      real que auditar todavía porque la UI (Fase 3) aún no existe.

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
