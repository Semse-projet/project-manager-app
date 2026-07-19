---
type: spec
feature: "task-unification-fase1"
domain: "tasks"
version: "1.0"
status: "APPROVED"
branch: "devin/consolidar-tareas-fase1"
date: "2026-07-17"
author: "Devin"
spec_index: "docs/SPEC_INDEX.md"
---

# Spec: unificación de tareas — Fase 1 (base canónica)

Depreca progresivamente las tres tablas de tareas (`JobTask`, `BuildOpsTask`, `AgroFarmTask`) extendiendo `JobTask` para que sea la entidad canónica `Task` del sistema operativo SEMSE. Esta fase solo prepara el schema; las Fases 2 y 3 migrarán los consumidores de `BuildOpsTask` y `AgroFarmTask`.

---

## 1. Qué resuelve

**Para quién:** plataforma, OPS_ADMIN, PRO, clientes y orquestadores de agentes.

**Problema:** el repositorio tiene tres modelos de tareas con campos y convenciones diferentes:

- `JobTask` — tareas dentro de jobs/hitoss (estados `pending | in_progress | done | blocked`).
- `BuildOpsTask` — tareas de estimación/proyectos BuildOps (`todo | in_progress | blocked | done | canceled`, `completion`, `evidenceRequired`).
- `AgroFarmTask` — tareas operativas de finca (`PENDING | IN_PROGRESS | COMPLETED | BLOCKED | CANCELLED`, `targetType`/`targetId`, `type`).

Esto genera duplicación de lógica, dificulta reportes cross-vertical y rompe el principio de "una sola fuente de verdad por entidad".

**Solución (Fase 1):**

- Extender `JobTask` con los campos polimórficos necesarios para representar tareas de jobs, BuildOps y Agro.
- Normalizar estados/prioridades hacia los valores canónicos de `JobTask`.
- Dejar `BuildOpsTask` y `AgroFarmTask` intactas temporalmente; las Fases 2/3 migrarán sus datos y consumidores.

---

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| PRO / field worker | `PRO` | listar/actualizar tareas asignadas | ver tareas de otros tenants |
| OPS_ADMIN | `OPS_ADMIN` | gestionar tareas de cualquier usuario del tenant | acceder cross-tenant |
| Cliente | `CLIENT` | ver tareas de sus jobs/proyectos | modificar tareas asignadas a terceros |
| Plataforma / agente | `PLATFORM` | crear tareas desde intake, tools o runs | saltar RBAC |

Referencia de roles: `docs/program/architecture/SEMSE_ROLE_MODEL.md`  
Referencia de permisos: `docs/program/governance/SEMSE_PERMISSION_MATRIX.md`

---

## 3. Escenarios de Usuario (P1)

### P1 — Unificar la bandeja de tareas de un trabajador

**Journey:** un PRO abre su panel y debe ver tareas de jobs (`JobTask`), tareas de proyectos BuildOps y tareas agro sin importar de qué tabla provengan.

**Criterio de aceptación:**
```
DADO   que existen tareas en JobTask, BuildOpsTask y AgroFarmTask
CUANDO el sistema consolida el schema canónico
ENTONCES JobTask puede almacenar las columnas necesarias para representar BuildOpsTask y AgroFarmTask
  Y    los endpoints existentes de /v1/tasks continúan funcionando sin cambios
```

**Casos borde:**
- `jobId` puede ser nulo para tareas BuildOps/Agro que aún no se vinculan a un job.
- `tenantId` sigue siendo obligatorio para todo registro (Constitución Art. VII).
- Las tareas Agro requieren `tenantId`; `AgroFarm` debe obtener `tenantId` en una fase previa/posterior.

**Errores esperados:**
- `400` si faltan campos requeridos (`title`, `tenantId`, `createdBy`).
- `403` si el usuario no pertenece al tenant.
- `404` si el recurso asociado (`job`, `project`, `farm`) no existe.

---

## 4. FSM — Máquina de Estados

**Entidad afectada:** `JobTask` / `Task`

```
pending | todo -> in_progress
  guard: usuario asignado o creador autorizado
  effect: task.started

in_progress -> done | completed
  guard: evidencia requerida aprobada (cuando aplique)
  effect: task.completed

in_progress -> blocked
  guard: motivo de bloqueo obligatorio si se requiere
  effect: task.blocked

blocked -> pending | in_progress | canceled
  guard: usuario autorizado
  effect: task.unblocked / task.canceled

* -> canceled
  guard: no provenga de un estado terminal
  effect: task.canceled
```

**Estados canónicos Fase 1:** `pending`, `in_progress`, `done`, `blocked`, `canceled`.  
**Mapeo legacy:**
- `BuildOpsTask`: `todo` → `pending`; `canceled` → `canceled`; resto idéntico.
- `AgroFarmTask`: `PENDING` → `pending`; `IN_PROGRESS` → `in_progress`; `COMPLETED` → `done`; `BLOCKED` → `blocked`; `CANCELLED` → `canceled`.

Referencia base: `docs/foundation/STATE_MACHINES.md`  
Verificar que las transiciones no violen: `docs/foundation/DOMAIN_INVARIANTS.md`

---

## 5. Contratos de API

### Fase 1 — Sin cambios de API

Fase 1 es un cambio de schema/persistencia. No se añaden ni modifican endpoints.  
Endpoints existentes afectados en Fases posteriores:

- `GET /v1/workers/:id/tasks` (`TasksService.listByWorker`)
- `GET /v1/jobs/:jobId/tasks` (`TasksService.listByJob`)
- `POST /v1/jobs/:jobId/tasks`
- `PATCH /v1/jobs/:jobId/tasks/:taskId/status`
- `GET /v1/buildops/tasks` y subrutas (`BuildOpsService`)
- `GET /v1/agro/farms/:farmId/tasks` (`AgroTaskService`)

**Notas para Fases 2/3:**
- `BuildOpsService` migrará a leer/escribir `JobTask` con `domain='buildops'`.
- `AgroTaskService` migrará a leer/escribir `JobTask` con `domain='agro'`.
- Se mantendrán los DTOs de cada vertical; el mapeo se hará en el repository/service correspondiente.

---

## 6. Criterios de Éxito

| Métrica | Valor objetivo |
|---------|---------------|
| Typecheck | 0 errores |
| Lint | 0 errores (warnings web preexistentes permitidos) |
| Tests unitarios API | ≥ 1887 pass / 0 fail |
| Tests unitarios workspace | ≥ 895 pass / 0 fail |
| `pnpm spec:preflight` | pass |
| Sin cambios de API breaking en Fase 1 | 100% |

---

## 7. Tests Requeridos

```typescript
describe("task-unification-fase1") {
  it("JobTask schema incluye los nuevos campos polimórficos")
  it("TasksService sigue funcionando con jobId existente")
  it("TasksService acepta tarea sin jobId cuando se usa contexto polimórfico")
  it("la migración añade columnas sin perder datos de JobTask")
  it("no hay referencias a campos eliminados en el schema")
  it("Prisma generate se ejecuta sin errores")
}
```

---

## 8. Impacto en otros dominios

| Dominio | Impacto | Acción requerida |
|---------|---------|-----------------|
| BuildOps | Alto en Fase 2/3 | Migrar `BuildOpsService` / `BuildOpsTask` a `JobTask` con `domain='buildops'` |
| Agro | Alto en Fase 2/3 | Migrar `AgroTaskService` / `AgroFarmTask`; requiere `tenantId` en `AgroFarm` |
| Tasks | Medio | Actualizar `TasksService` tipos para `jobId` opcional; consumir `JobTask` canónico |
| Prometeo | Bajo | Actualizar `outputKind` de `AgroFarmTask[]`/`AgroFarmTask` a `Task[]`/`Task` en Fase 3 |
| Evidence | Medio | Las tareas con `evidenceRequired` seguirán usando el campo JSON canónico |
| AuditLog | Bajo | Transiciones de estado seguirán emitiendo `task.*` events |

---

## 9. Supuestos y Dependencias

- `JobTask` es la base canónica porque ya es usada por el módulo `tasks/` y tiene `tenantId`.
- `BuildOpsTask` y `AgroFarmTask` se eliminarán solo después de migrar todos sus consumidores.
- `AgroFarm` necesita `tenantId` para que las tareas Agro puedan vivir en `JobTask` sin violar el Art. VII de la Constitución.
- Los campos `projectId` y `farmId` se añaden como escalares en Fase 1; las relaciones a `BuildOpsProject`/`AgroFarm` se añaden en Fase 2/3 cuando se migren los consumidores.

---

## Checklist de aprobación

- [x] Escenario P1 con Given/When/Then
- [x] FSM declarada y mapeo de estados legacy
- [x] Impacto en otros dominios documentado
- [x] Tests requeridos listados
- [x] Ninguna invariante de `DOMAIN_INVARIANTS.md` violada
- [x] Spec agregado a `docs/SPEC_INDEX.md`
- [x] Status cambiado a `APPROVED`
