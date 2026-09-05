---
type: tasks
feature: "F10 — Identidad universal con múltiples capacidades por cuenta"
domain: "core"
plan: "docs/specs/core/universal-identity-multi-role.plan.md"
version: "1.1"
status: "IN_PROGRESS"
branch: "feat/f10-identity-capabilities-endpoint"
date: "2026-08-13"
---

# Tareas: Identidad universal con múltiples capacidades por cuenta

> Spec `APPROVED` 2026-08-04. Fase 0 resuelta el mismo día. Fases 1-2
> (endpoint de lectura) implementadas y verificadas 2026-08-05. Fase 3
> (selector de UI, detrás de flag de canario) y Fase 4 (cierre local)
> implementadas 2026-08-13 — sólo falta T-043 (evidencia de canario real en
> producción, requiere acción humana para activar el flag en Railway).

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
- [x] **T-012** Test: UI deriva capacidad activa del proyecto abierto
      (`tests/unit/capability.test.ts`, cierra los casos borde del spec §4:
      capacidad duplicada en 2 orgs, sin membership en la org, `WORKER`/`PRO`
      nunca se mezclan). 2026-08-13.

## Fase 2 — Endpoint de lectura

- [x] **T-020** Implementado `GET /v1/users/me/capabilities`
      (`users.controller.ts`, `users.service.ts`) — reutiliza
      `findMembershipsByUser` existente, sin nuevo modelo Prisma. Build
      limpio, suite completa `@semse/api` 2095/2095 en verde.
- [x] **T-021** Decidido: **sin auditoría** para este endpoint — es
      puramente de lectura (spec §5, `audit_log: no`); no hay "conmutación"
      real que auditar todavía porque la UI (Fase 3) aún no existe.

## Fase 3 — UI (implementada 2026-08-13, detrás de flag de canario)

- [x] **T-030** Selector de capacidad activa (header/dashboard) —
      `CapabilityIndicator` (`apps/web/components/semse/CapabilityIndicator.tsx`),
      montado en `Topbar` (`apps/web/app/(app)/layout.tsx`). Sólo lectura, sin
      control de "cambiar" — se deriva 100% del proyecto abierto vía
      `CapabilityProvider`/`useDeclareActiveProjectOrg`
      (`apps/web/lib/capability-context.tsx`) y se oculta por completo fuera de
      un proyecto (nunca muestra un "default de cuenta").
- [x] **T-031** Badge de capacidad por proyecto — `CapabilityBadge`
      (`apps/web/components/semse/CapabilityBadge.tsx`), renderizado en
      `client/projects/[projectId]/page.tsx` y
      `buildops/projects/[projectId]/page.tsx`.
- [x] **T-032** Unificar etiqueta de rol en las superficies acotadas por
      T-002 — resuelto de forma angosta: los 2 componentes nuevos usan una
      única fuente (`capability.CLIENT/PRO/WORKER` en `language-context.tsx`,
      ES+EN); no se tocó ninguno de los ~5 lugares preexistentes donde el
      label ya estaba definido de forma inconsistente (eso sigue fuera de
      alcance, confirmado por spec §2).
- [x] Feature flag de canario por tenant añadido (no estaba en el plan
      original de Fase 3, decidido con el owner 2026-08-13, mismo patrón que
      `isMissionControlV2Enabled`): `SEMSE_IDENTITY_CAPABILITY_UI_ENABLED` +
      `SEMSE_IDENTITY_CAPABILITY_UI_CANARY_TENANT_IDS`, resuelto en el BFF
      (`apps/web/lib/capability-flag.ts`), no en NestJS — el endpoint Fase 2
      no se tocó.

## Fase 4 — Validación y cierre

- [x] **T-040** `pnpm spec:validate:strict` en verde (2026-08-13).
- [x] **T-041** Actualizar `IMPLEMENTATION_STATUS_MATRIX.md` (fila F10).
- [x] **T-042** Actualizar `ROADMAP.md` §F10.
- [ ] **T-043** Evidencia de producción: journey real de un usuario con dos
      capacidades, antes de mover el spec a `VERIFIED`. Requiere activar el
      flag en Railway producción — variable de entorno de producción, que
      `AGENTS.md` prohíbe tocar a un agente. Queda para acción humana
      explícita (mismo patrón que Mission Control 2.0 F4 esta misma sesión).

## Criterio de cierre

- [ ] Ningún usuario puede ejercer permisos de una capacidad fuera del
      `orgId` donde la tiene otorgada.
- [ ] La capacidad mostrada por defecto siempre coincide con el contexto
      del proyecto abierto.
- [ ] `pnpm spec:validate:strict` verde.
- [ ] Spec marcado `IMPLEMENTED`/`VERIFIED` solo con evidencia de
      producción real, no por existencia de código.
