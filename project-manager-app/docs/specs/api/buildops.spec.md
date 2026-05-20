---
type: spec
feature: "BuildOps — Gestión de Proyectos de Obra"
domain: "buildops"
version: "1.0"
status: "APPROVED"
date: "2026-05-20"
author: "Claude Sonnet — sesión SDD governance"
spec_index: "docs/SPEC_INDEX.md"
depends_on: "docs/specs/api/jobs.spec.md"
---

# Spec: BuildOps

> BuildOps es la capa de ejecución de obra: proyectos, tareas, milestones,
> estimados y salud del proyecto. Se activa cuando un job pasa a IN_PROGRESS.
> Basado en `apps/api/src/modules/buildops/buildops.controller.ts`.

---

## 1. Qué resuelve

Mientras el Job gestiona el ciclo comercial (marketplace), BuildOps gestiona
la ejecución técnica: divide el trabajo en tareas, genera milestones automáticos
desde tools results, monitorea la salud del proyecto y aprueba planes de obra.

---

## 2. Actores y Permisos

| Actor | Permisos |
|-------|---------|
| PRO/CLIENT | `projects:read` — leer proyectos, tareas, milestones, health |
| PRO/CLIENT/OPS_ADMIN | `projects:create` — crear proyectos, tareas, estimados |
| OPS_ADMIN | `projects:status:update` — aprobar planes |
| OPS_ADMIN | `ops:dashboard:write` — recuperar promociones estancadas |

---

## 3. FSM — BuildOpsProject (Plan de Obra)

```
PENDING_REVIEW → APPROVED → PROMOTED_TO_LEGACY
                    │
              CHANGES_REQUESTED → RERUN → APPROVED
                    │
              REJECTED (terminal)
```

| Transición | Actor | Efecto |
|-----------|-------|--------|
| → `APPROVED` | OPS_ADMIN | Habilita ejecución de milestones |
| → `CHANGES_REQUESTED` | OPS_ADMIN | PRO debe corregir y resubmitir |
| → `PROMOTED_TO_LEGACY` | PLATFORM | Plan migrado al ciclo de milestones |

---

## 4. Contratos de API

### `GET /v1/buildops/overview` — `projects:read`
```yaml
output: resumen general de todos los BuildOpsProjects del tenant
```

### `GET /v1/buildops/projects` — `projects:read`
```yaml
output: array de BuildOpsProject con status y health score
```

### `GET /v1/buildops/projects/:projectId/health` — `projects:read`
```yaml
output:
  - healthScore: number (0-100)
  - milestoneReadiness: string
  - evidenceStatus: string
  - openSignals: number
  - blockers: string[]
efectos: SSE-ready — se emite en tiempo real cuando hay cambios
```

### `GET /v1/buildops/projects/:projectId` — `projects:read`
```yaml
output: BuildOpsProject detalle con plan, milestones, tareas
```

### `POST /v1/buildops/projects` — `projects:create`
```yaml
input: { jobId, title, scope, milestones[] }
output: BuildOpsProject creado
efectos: auditLog: true
```

### `POST /v1/buildops/estimates/from-tool-result` — `projects:create`
```yaml
input: { jobId, toolResult — output de ProTools engine }
output: estimado estructurado con líneas de costo y milestones sugeridos
efectos: genera plan de milestones desde el resultado de la herramienta
```

### `GET /v1/buildops/tasks` — `projects:read`
```yaml
output: tareas del tenant filtradas por proyecto
```

### `POST /v1/buildops/tasks` — `projects:create`
```yaml
input: { projectId, title, description, assignee, dueDate }
output: BuildOpsTask creada
efectos: auditLog: true
```

### `GET /v1/buildops/milestones` — `projects:read`
```yaml
output: milestones del tenant (vista BuildOps, diferente de /v1/milestones)
```

### `POST /v1/buildops/plans/:projectId/approve` — `projects:status:update`
```yaml
input: { decision: "approve" | "request_changes" | "reject", comment? }
output: BuildOpsProject actualizado
errores:
  403: solo OPS_ADMIN
  409: plan ya aprobado
efectos:
  fsmTransicion: PENDING_REVIEW → APPROVED | CHANGES_REQUESTED | REJECTED
  sse: true — notifica PRO del resultado
  auditLog: true
```

### `POST /v1/buildops/plans/recover-stale-promotions` — `ops:dashboard:write`
```yaml
input: ninguno
output: { recovered: number }
efectos: recupera planes en APPROVED que no fueron promovidos por timeout
```

---

## 5. Tests Requeridos

```typescript
describe("GET /v1/buildops/projects/:id/health") {
  it("retorna healthScore entre 0 y 100")
  it("incluye openSignals y blockers")
  it("rechaza con 403 sin projects:read")
}
describe("POST /v1/buildops/plans/:id/approve") {
  it("OPS_ADMIN aprueba plan → status APPROVED + SSE emitido")
  it("OPS_ADMIN solicita cambios → CHANGES_REQUESTED + notifica PRO")
  it("rechaza con 403 si actor no es OPS_ADMIN")
  it("rechaza con 409 si plan ya está APPROVED")
}
describe("POST /v1/buildops/estimates/from-tool-result") {
  it("genera milestones desde output de herramienta de ProTools")
  it("incluye priceMin, priceMax y etaDays por milestone")
}
```

---

## 6. Gaps identificados

| Gap | Severidad |
|-----|-----------|
| `GET /v1/buildops/milestones` devuelve vista diferente a `/v1/milestones` — dos fuentes de verdad | 🟡 Media |
| `PROMOTED_TO_LEGACY` no tiene endpoint explícito — ocurre automáticamente vía worker | 🟢 Baja |
| No hay endpoint para listar el historial de versiones de un plan aprobado | 🟢 Baja |
