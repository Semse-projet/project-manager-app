# SPEC: Milestones API
**Versión:** 1.0
**Dominio:** Work Management
**Estado:** APPROVED
**Depende de:** jobs.spec.md, evidence.spec.md, specs/fsm/milestone-lifecycle.spec.md
**Implementado en:** apps/api/src/modules/milestones/milestones.controller.ts
**Tests:** apps/api/tests/ (MISSING — crear)

## Qué resuelve
Un Milestone es un hito verificable dentro de un WorkOrder. El pro ejecuta el trabajo, sube evidencia, y solicita aprobación. El client aprueba o rechaza. La liberación de fondos del escrow depende de la aprobación de milestones.

## Actores
- **Pro:** crea checklist items, sube evidencia, solicita aprobación
- **Client:** aprueba o rechaza milestones con comentario
- **Evidence Agent:** valida que la evidencia cumple requisitos antes de presentar al client
- **Payments Agent:** libera fondos del escrow al aprobar
- **Admin:** puede override en disputas

## FSM
Ver `specs/fsm/milestone-lifecycle.spec.md`
```
PENDING → IN_PROGRESS → PENDING_REVIEW → APPROVED
                    ↑          ↓
                    └── REJECTED (vuelve a IN_PROGRESS)
                               ↓
                           DISPUTED → RESOLVED
```

---

## Contratos de API

### GET /v1/jobs/:jobId/milestones
Listar milestones de un job.

**Output:**
```ts
{
  items: [{
    id, title, description, status, order,
    amount, dueDate, evidenceCount, createdAt
  }]
}
```
**Errores:** `403` no pertenece al job · `404` job no existe
**Guards:** autenticado · job.clientId = user.id OR job.assignedProId = user.id OR admin

---

### POST /v1/jobs/:jobId/milestones
Crear un milestone (solo cuando job está ASSIGNED o IN_PROGRESS).

**Input:**
```ts
{
  title: string         // min 3, max 100
  description?: string
  amount: number        // > 0, suma de milestones <= escrow total
  order: number         // posición en la secuencia
  dueDate?: string      // ISO date
}
```
**Output:** `{ id, status: "PENDING", jobId, amount, order }`
**Errores:** `403` no es pro asignado · `409` job no está ASSIGNED/IN_PROGRESS · `422` suma de amounts supera escrow
**Guards:** rol = pro · job.assignedProId = user.id
**Efectos:** AuditLog: `MILESTONE_CREATED`

---

### PATCH /v1/jobs/:jobId/milestones/:id
Editar un milestone (solo en PENDING o IN_PROGRESS).

**Input:** campos parciales de POST
**Output:** milestone actualizado
**Errores:** `403` no es pro asignado · `409` no está en PENDING/IN_PROGRESS
**Guards:** rol = pro · job.assignedProId = user.id
**Efectos:** AuditLog: `MILESTONE_UPDATED`

---

### POST /v1/jobs/:jobId/milestones/:id/start
Iniciar trabajo en un milestone (PENDING → IN_PROGRESS).

**Input:** ninguno
**Output:** `{ id, status: "IN_PROGRESS" }`
**Errores:** `403` no es pro asignado · `409` otro milestone ya está IN_PROGRESS · `409` este no está PENDING
**Guards:** rol = pro · job.assignedProId = user.id
**Efectos:** AuditLog: `MILESTONE_STARTED` · SSE: `milestone.started` al client

---

### POST /v1/jobs/:jobId/milestones/:id/submit
Solicitar aprobación con evidencia (IN_PROGRESS → PENDING_REVIEW).

**Input:**
```ts
{
  notes?: string
  evidenceIds: string[]   // mínimo 1, deben existir y pertenecer al milestone
}
```
**Output:** `{ id, status: "PENDING_REVIEW" }`
**Errores:** `403` no es pro asignado · `409` no está IN_PROGRESS · `422` sin evidencia · `422` evidencia no válida
**Guards:** rol = pro · job.assignedProId = user.id
**Efectos:** AuditLog: `MILESTONE_SUBMITTED` · Evidence Agent valida async · notificación al client · SSE: `milestone.pending_review`

---

### POST /v1/jobs/:jobId/milestones/:id/approve
Aprobar un milestone (PENDING_REVIEW → APPROVED).

**Input:** `{ comment?: string }`
**Output:** `{ id, status: "APPROVED", payment: { amount, releasedAt } }`
**Errores:** `403` no es el client del job · `409` no está PENDING_REVIEW
**Guards:** rol = client · job.clientId = user.id
**Efectos:** AuditLog: `MILESTONE_APPROVED` · Payments Agent libera escrow parcial · SSE: `milestone.approved` al pro · ProProfile rating actualizado

---

### POST /v1/jobs/:jobId/milestones/:id/reject
Rechazar un milestone (PENDING_REVIEW → REJECTED → IN_PROGRESS).

**Input:** `{ reason: string }` // obligatorio
**Output:** `{ id, status: "IN_PROGRESS" }`
**Errores:** `403` no es el client del job · `409` no está PENDING_REVIEW · `400` reason vacío
**Guards:** rol = client · job.clientId = user.id
**Efectos:** AuditLog: `MILESTONE_REJECTED` con reason · SSE: `milestone.rejected` al pro con reason

---

### GET /v1/jobs/:jobId/milestones/:id
Ver detalle de un milestone.

**Output:**
```ts
{
  id, title, description, status, order, amount,
  dueDate, evidence: EvidenceItem[],
  history: AuditEntry[], createdAt, updatedAt
}
```
**Errores:** `403` no pertenece al job · `404` no existe
**Guards:** autenticado · member del job O admin

---

## Tests requeridos

### POST milestones
- [ ] Pro crea milestone en job ASSIGNED → 201
- [ ] Client intenta crear milestone → 403
- [ ] Suma de amounts supera escrow → 422

### POST /submit
- [ ] Pro sube evidencia válida → PENDING_REVIEW
- [ ] Sin evidenceIds → 422
- [ ] Evidence de otro milestone → 422
- [ ] Evidence Agent notificado async

### POST /approve
- [ ] Client aprueba → APPROVED + escrow liberado
- [ ] Pro intenta aprobar su propio milestone → 403
- [ ] No está PENDING_REVIEW → 409
- [ ] AuditLog contiene MILESTONE_APPROVED
- [ ] SSE emitido al pro

### POST /reject
- [ ] Client rechaza con reason → vuelve a IN_PROGRESS
- [ ] Sin reason → 400
- [ ] Pro notificado vía SSE con reason

### FSM
- [ ] No se puede ir de PENDING a PENDING_REVIEW sin pasar por IN_PROGRESS
- [ ] No se puede aprobar un milestone PENDING
- [ ] Milestone APPROVED no puede ser rechazado
