# Avance: Ops repository, módulo organizations y acciones operativas en runtime

Fecha: 2026-04-07
Autor: Claude (infclaude)
Proyecto: SEMSE OS — labsemse_project/project-manager-app

---

## Contexto

Esta sesión comenzó con un análisis profundo del estado del proyecto:
- Auditoría completa de `vision/` (14 documentos)
- Auditoría completa de `program/` (19 documentos)
- Auditoría del backend NestJS: completitud por módulo, modelos Prisma sin módulo, gaps de políticas

El resultado de la auditoría estableció que el backend estaba en ~65-70% y que el módulo `ops` tenía el ciclo frontend→backend cerrado pero le faltaba separación repository + endpoints de acción. El trabajo de esta sesión cierra esos gaps.

---

## Trabajo realizado

### Bloque 1 — Backend: ops module hardening

**Archivos modificados:**
- `apps/api/src/modules/ops/ops.repository.ts`
- `apps/api/src/modules/ops/ops.service.ts`
- `apps/api/src/modules/ops/ops.controller.ts`

**Cambios:**

El `ops.repository.ts` ya existía con métodos `list*`. Se añadieron:
- `retryAgentRun(tenantId, runId)` — `update` Prisma: `status: "QUEUED"`, `error: null`
- `requeueAgentRun(tenantId, runId)` — mismo + `deadLettered: false`

El `ops.service.ts` recibió dos nuevos métodos:
- `retryAgentRun(input)` — llama repository, escribe audit log con `"ops.agent.retry"`
- `requeueAgentRun(input)` — llama repository, escribe audit log con `"ops.agent.requeue"`

El `ops.controller.ts` recibió dos nuevos endpoints:
- `POST /v1/ops/agent-runtime/:runId/retry` — permiso `ops:dashboard:write`
- `POST /v1/ops/agent-runtime/:runId/requeue` — permiso `ops:dashboard:write`

`ops.module.ts` ya tenía `OpsRepository` en providers — sin cambios.

**TypeScript:** `tsc --noEmit @semse/api` → 0 errores.

---

### Bloque 2 — Backend: módulo organizations (nuevo)

**Archivos creados:**
```
apps/api/src/modules/organizations/
├── organizations.module.ts
├── organizations.controller.ts
├── organizations.service.ts
├── organizations.repository.ts
└── organizations.policy.ts
```

**Registrado en:** `apps/api/src/app.module.ts` (OrganizationsModule añadido a imports)

**Endpoints implementados:**

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | /v1/organizations | `org:read` |
| GET | /v1/organizations/:orgId | `org:read` |
| GET | /v1/organizations/:orgId/members | `org:members:read` |

**Modelos Prisma cubiertos:** `Org`, `Membership`
**Modelos presentes pero no consultados aún:** `Role`, `Permission`, `RolePermission` (referenciados via `roleId` en Membership)

**Policy implementada:**
- `canReadOrg(actor, orgId)` — permite si actor tiene rol `OPS_ADMIN` o pertenece a la org

**TypeScript:** `tsc --noEmit @semse/api` → 0 errores.

**Impacto:** Este módulo cierra el gap más crítico de la auditoría de backend. Era el único bloque que impedía tener ownership real por organización en todos los módulos del sistema.

---

### Bloque 3 — Frontend: acciones operativas en admin/ops

**Archivos creados:**
```
apps/web/app/api/semse/ops/agent-runtime/[runId]/retry/route.ts
apps/web/app/api/semse/ops/agent-runtime/[runId]/requeue/route.ts
```

**Archivos modificados:**
- `apps/web/app/semse-api.ts` — añadidas: `retryAgentRun()`, `requeueAgentRun()`, `openIncident()`
- `apps/web/app/(app)/admin/ops/page.tsx` — UI actualizada con acciones operativas

**Funcionalidades añadidas al tablero:**

1. **Botón "Reintentar"** — aparece en cada run card cuando `status === "failed"`. Llama `retryAgentRun(run.id)` y recarga el trace al completar.

2. **Botón "Reencolar"** — aparece cuando `run.deadLettered === true`. Llama `requeueAgentRun(run.id)` y recarga el trace.

3. **Banner "Abrir incidente"** — aparece en el panel del trace cuando algún run del trace tiene status failed. Al hacer click muestra formulario inline con:
   - Input de título
   - Selector de severidad (`watch` / `critical`)
   - Feedback de éxito/error inline

4. **Estado de refresh** — nuevo contador `refreshTrace` en la dependencia del `useEffect` del trace, de modo que cualquier acción recarga automáticamente el trace sin recargar la lista completa.

5. **Estados de loading por run** — `runActionLoading` y `runActionError` como maps keyed por `run.id`, para que el feedback sea individual por botón.

**Nota sobre incidents proxy:** La ruta `/api/semse/ops/incidents/route.ts` ya existía con un handler POST — no se duplicó.

**TypeScript:** `tsc --noEmit @semse/web` → 0 errores.

---

## Estado del ciclo Ops después de esta sesión

```
Frontend admin/ops/page.tsx
  ↓ lista runs con filtros
  ↓ selecciona correlationId → carga trace
  ↓ [NUEVO] retry / requeue desde run card
  ↓ [NUEVO] abrir incidente desde trace panel
        ↓
Next.js proxy routes (todos con TypeScript limpio)
        ↓
NestJS OpsController — 10 endpoints activos
        ↓
OpsService → OpsRepository → Prisma
  - AgentRun: read + retry + requeue
  - AuditLog: read + append (retry/requeue/incident)
  - RiskScore: read
  - Job/Dispute/Project: groupBy para dashboard
```

---

## Corrección a la auditoría anterior del backend

La auditoría inicial estimó `ops` al 60%. El módulo real estaba al ~85%. Las queries Prisma existían correctamente en el service; solo faltaban los dos endpoints de acción y la separación formal al repository.

**Estimación revisada del backend:**

| Categoría | Antes | Después |
|---|---|---|
| Módulos con controller+service+repository | 13/17 | 14/17 |
| Módulos con policy | 5/17 | 5/17 (organizations.policy añadida) → 6/17 |
| Modelos Prisma cubiertos | 21/33 | 23/33 (Org, Membership) |
| Completitud general | ~65% | ~70% |

---

## Gaps pendientes (para próxima sesión)

**Tier 1 — Críticos:**
- `users` module — User profiles, verificación, trust tracking
- `ratings` module — Post-completion feedback
- `messaging` module — MessageThread, Message

**Tier 2 — Políticas faltantes en módulos existentes:**
- `bids.policy.ts`
- `jobs.policy.ts`
- `payments.policy.ts`
- `agents.policy.ts`
- `reservations.policy.ts`
- `contracts.policy.ts`

**Tier 3 — Infraestructura:**
- `approvals/:id/decision` en ops — actualmente es un stub vacío
- `domain-events` — solo infraestructura, sin controller/endpoints formales

---

## Verificación final

Ambos workspaces TypeScript limpios:
- `npm exec tsc --workspace @semse/api -- --noEmit` → 0 errores
- `npm exec tsc --workspace @semse/web -- --noEmit` → 0 errores
