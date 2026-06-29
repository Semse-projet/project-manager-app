# SPEC: Jobs API
**Versión:** 1.0
**Dominio:** Marketplace
**Estado:** APPROVED
**Depende de:** auth.spec.md, specs/fsm/job-lifecycle.spec.md
**Implementado en:** apps/api/src/modules/jobs/jobs.controller.ts
**Tests:** apps/api/tests/ (MISSING — crear)

## Qué resuelve
Un cliente publica un Job describiendo el trabajo físico que necesita. Los profesionales pueden ver, filtrar y hacer bids. El Job gobierna el ciclo completo desde publicación hasta cierre o disputa.

## Actores
- **Client:** crea, edita, cancela y cierra jobs
- **Pro:** ve jobs disponibles, hace bids
- **Admin:** puede ver todos, intervenir en disputas
- **Risk Agent:** evalúa el job antes de activarlo

## FSM
Ver `specs/fsm/job-lifecycle.spec.md`
```
DRAFT → PUBLISHED → ASSIGNED → IN_PROGRESS → COMPLETED
                  ↓                        ↓
               CANCELLED              DISPUTED → RESOLVED
```

---

## Contratos de API

### POST /v1/jobs
Crear un nuevo job.

**Input:**
```ts
{
  title: string           // min 5, max 120
  description: string     // min 20, max 2000
  categoryId: string
  location: {
    address: string
    city: string
    coordinates?: { lat: number; lng: number }
  }
  budget: {
    min: number           // > 0
    max: number           // >= min
    currency: "USD" | "CAD"
  }
  startDate?: string      // ISO date
  endDate?: string        // ISO date, >= startDate
}
```
**Output:**
```ts
{
  id: string
  status: "DRAFT"
  createdAt: string
}
```
**Errores:** `400` campos inválidos · `403` rol no es client · `422` budget.max < budget.min
**Guards:** rol = client · tenantId requerido
**Efectos:** AuditLog: `JOB_CREATED` · FSM: → DRAFT

---

### GET /v1/jobs
Listar jobs disponibles (para pros) o propios (para clients).

**Input (query):**
```ts
{
  status?: JobStatus
  categoryId?: string
  city?: string
  page?: number     // default 1
  limit?: number    // default 20, max 100
}
```
**Output:**
```ts
{
  items: Job[]
  total: number
  page: number
}
```
**Errores:** `400` filtros inválidos
**Guards:** autenticado · tenant filter aplicado siempre
**Efectos:** ninguno

---

### GET /v1/jobs/:id
Ver detalle de un job.

**Output:**
```ts
{
  id, title, description, status, category,
  location, budget, client: { id, name },
  bidsCount, startDate, endDate, createdAt, updatedAt
}
```
**Errores:** `404` no existe · `403` cross-tenant
**Guards:** autenticado · ownership: client propio O pro (si PUBLISHED) O admin

---

### PATCH /v1/jobs/:id
Editar un job (solo en estado DRAFT).

**Input:** campos parciales de POST /v1/jobs
**Output:** Job actualizado
**Errores:** `403` no owner · `409` no está en DRAFT · `400` campos inválidos
**Guards:** rol = client · job.clientId = user.id
**Efectos:** AuditLog: `JOB_UPDATED`

---

### POST /v1/jobs/:id/publish
Publicar un job (DRAFT → PUBLISHED).

**Input:** ninguno
**Output:** `{ id, status: "PUBLISHED" }`
**Errores:** `403` no owner · `409` no está en DRAFT · `422` campos incompletos para publicar
**Guards:** rol = client · job.clientId = user.id
**Efectos:** AuditLog: `JOB_PUBLISHED` · FSM: DRAFT → PUBLISHED · Risk Agent evaluación async

---

### POST /v1/jobs/:id/cancel
Cancelar un job.

**Input:** `{ reason: string }`
**Output:** `{ id, status: "CANCELLED" }`
**Errores:** `403` no owner ni admin · `409` está en IN_PROGRESS o COMPLETED
**Guards:** rol = client | admin
**Efectos:** AuditLog: `JOB_CANCELLED` · notificación a pros con bids activos

---

### POST /v1/jobs/:id/assign
Asignar un pro al job (acepta un bid).

**Input:** `{ bidId: string }`
**Output:** `{ id, status: "ASSIGNED", assignedProId: string }`
**Errores:** `403` no owner · `404` bid no existe · `409` ya asignado
**Guards:** rol = client · job.clientId = user.id · bid.jobId = job.id
**Efectos:** AuditLog: `JOB_ASSIGNED` · FSM: PUBLISHED → ASSIGNED · EscrowAccount creado · otros bids rechazados

---

### POST /v1/jobs/:id/start
Iniciar el trabajo (ASSIGNED → IN_PROGRESS).

**Input:** ninguno
**Output:** `{ id, status: "IN_PROGRESS" }`
**Errores:** `403` no es el pro asignado · `409` no está ASSIGNED
**Guards:** rol = pro · job.assignedProId = user.id
**Efectos:** AuditLog: `JOB_STARTED` · WorkOrder creado automáticamente

---

### POST /v1/jobs/:id/complete
Cerrar el job como completado (IN_PROGRESS → COMPLETED).

**Input:** `{ rating: number, review?: string }` ← del client
**Output:** `{ id, status: "COMPLETED" }`
**Errores:** `403` no owner · `409` no está IN_PROGRESS · `422` milestones pendientes sin aprobar
**Guards:** rol = client · job.clientId = user.id · todos los milestones APPROVED
**Efectos:** AuditLog: `JOB_COMPLETED` · Payment final liberado · rating guardado en ProProfile

---

## Tests requeridos

### POST /v1/jobs
- [ ] Client crea job válido → 201 con status DRAFT
- [ ] Pro intenta crear job → 403
- [ ] Budget.max < budget.min → 422
- [ ] Title con menos de 5 chars → 400
- [ ] AuditLog contiene JOB_CREATED

### GET /v1/jobs
- [ ] Pro ve solo jobs PUBLISHED
- [ ] Client ve solo sus propios jobs
- [ ] Admin ve todos
- [ ] Filtro por city funciona
- [ ] Cross-tenant retorna 0 resultados

### PATCH /v1/jobs/:id
- [ ] Client edita su job en DRAFT → 200
- [ ] Client edita job en PUBLISHED → 409
- [ ] Otro client edita job ajeno → 403

### POST /v1/jobs/:id/publish
- [ ] Job DRAFT → PUBLISHED correctamente
- [ ] Job ya PUBLISHED → 409
- [ ] Risk Agent llamado async

### POST /v1/jobs/:id/assign
- [ ] Asignar bid válido → ASSIGNED + EscrowAccount creado
- [ ] Otros bids quedan REJECTED
- [ ] Bid de otro job → 404

### POST /v1/jobs/:id/complete
- [ ] Todos milestones APPROVED → COMPLETED + pago liberado
- [ ] Milestone pendiente → 422
- [ ] Pro intenta completar → 403
