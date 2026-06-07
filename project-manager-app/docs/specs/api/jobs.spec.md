---
id: api-job-lifecycle-bids
title: "Job Lifecycle and Bids API"
type: spec
feature: "Job Lifecycle & Bids"
domain: "jobs"
version: "1.0"
status: "APPROVED"
owner: semse-core
risk: high
branch: "feat/jobs-spec"
date: "2026-05-20"
author: "Claude Sonnet — sesión SDD governance"
spec_index: "docs/SPEC_INDEX.md"
plan: "docs/specs/api/jobs.plan.md"
children:
  - "docs/specs/api/milestones.spec.md"
  - "docs/specs/api/evidence.spec.md"
  - "docs/specs/api/payments.spec.md"
related_files:
  - apps/api/src/modules/jobs
  - apps/api/src/modules/bids
  - packages/schemas/src/job.schema.ts
related_tests:
  - apps/api/test/jobs.fsm.test.ts
  - apps/api/test/jobs.service.test.ts
  - apps/api/test/marketplace-bids.test.ts
related_endpoints:
  - v1/jobs
  - v1/bids
related_events:
  - job.status_changed
related_agents:
  - marketplace
last_verified: 2026-05-25
---

# Spec: Job Lifecycle & Bids

> **Propósito:** Contrato ejecutable del ciclo de vida del Job — la entidad raíz del marketplace SEMSE.
> Un Job contiene Milestones, Bids, Contratos y Escrow. Es el punto de entrada del ciclo monetizable.
> Basado en código real de `apps/api/src/modules/jobs/` y `apps/api/src/modules/bids/`.

---

## 1. Qué resuelve

El Job es la entidad canónica del marketplace: representa un trabajo de construcción o servicio
que un cliente publica, los profesionales postulan, y uno es seleccionado para ejecutar.

**Ciclo completo:**
```
CLIENT crea job → lo publica → PRO hace bid → CLIENT acepta bid
→ job pasa a IN_PROGRESS → PRO ejecuta milestones + evidencia
→ CLIENT aprueba → escrow libera → job COMPLETED
```

**Para quién:** CLIENT que necesita un servicio · PRO que ofrece servicios · OPS_ADMIN que supervisa
**Nota de dominio:** `Job` es la entidad canónica. `Project` es un artefacto de ejecución interno que se materializa al aceptar un bid. Referencia: `docs/foundation/JOB_VS_PROJECT_BOUNDARY.md`

---

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| Cliente | `CLIENT` | Crear · Publicar · Archivar · Completar · Cancelar · Aceptar bid · Listar | Hacer bid en su propio job · Disputar |
| Profesional | `PRO` | Listar · Ver detalle · Hacer bid · Solicitar review · Disputar | Crear jobs · Completar · Cancelar |
| Ops Admin | `OPS_ADMIN` | Todo + override de transiciones | — |

Permisos por endpoint:

| Permiso | Endpoints |
|---------|-----------|
| `jobs:read` | GET /v1/jobs · GET /v1/jobs/:id · GET /v1/jobs/:id/agent-signals |
| `jobs:create` | POST /v1/jobs |
| `jobs:update` | POST /v1/jobs/:id/transition |
| `jobs:archive` | POST /v1/jobs/:id/archive |
| `jobs:restore` | POST /v1/jobs/:id/restore |
| `bids:read` | GET /v1/jobs/:id/bids |
| `bids:create` | POST /v1/jobs/:id/bids |
| `bids:accept` | POST /v1/bids/:bidId/accept |

---

## 3. FSM — Máquina de Estados del Job

**Entidad:** `Job`
**Referencia canónica:** `docs/foundation/STATE_MACHINES.md`

```
          DRAFT ──────────────────────────────────────────► CANCELLED
            │                                                    ▲
            ▼                                                    │
          POSTED ──────────────────────────────────────────────► │
          (PUBLISHED)  ◄── alias externo                         │
            │                                                    │
            ▼                                                    │
         RESERVED ──────────────────────► (back to POSTED)       │
            │                                                    │
            ▼                                                    │
         ACCEPTED ──────────────────────────────────────────────► │
            │                                                    │
            ▼                                                    │
        IN_PROGRESS ─────────────────────────────────────► DISPUTE
            │                                                    │
            ▼                                                    │
          REVIEW ─────────────────────────────────────────────► │
            │                                                    │
            ▼                                                    ▼
        COMPLETED ◄──────────────────────────────────── DISPUTE
         [TERMINAL]                                    (si resuelto)

     AWARDED → IN_PROGRESS  (flujo alternativo — job adjudicado directo)
```

### Tabla de transiciones (implementación real)

| Desde | Hacia permitido | Guard adicional |
|-------|-----------------|-----------------|
| `draft` | `posted`, `cancelled` | — |
| `posted` | `reserved`, `cancelled` | — |
| `published` | `reserved`, `cancelled` | alias de posted |
| `reserved` | `accepted`, `posted` | — |
| `accepted` | `in_progress`, `cancelled` | — |
| `in_progress` | `review`, `dispute` | solo PRO puede ir a `review` o `dispute` |
| `review` | `completed`, `in_progress` | solo CLIENT puede ir a `completed` |
| `dispute` | `completed`, `cancelled` | solo OPS_ADMIN puede resolver |
| `awarded` | `in_progress` | flujo alternativo de adjudicación directa |
| `completed` | — | TERMINAL |
| `cancelled` | — | TERMINAL |

### Reglas de autorización por transición

```
CLIENT_ONLY → completed, cancelled
PRO_ONLY    → review, dispute
OPS_ADMIN   → puede ejecutar cualquier transición
```

### Mapeo código ↔ spec canónico

| Código | STATE_MACHINES.md | Nota |
|--------|-------------------|------|
| `draft` | `DRAFT` | ✅ |
| `posted` / `published` | `POSTED` | `published` es alias externo |
| `reserved` | `RESERVED` | ✅ |
| `accepted` | `ACCEPTED` | ✅ |
| `in_progress` | `IN_PROGRESS` | ✅ |
| `review` | `WAITING_REVIEW` | renombrado en código |
| `dispute` | `DISPUTED` | renombrado en código |
| `completed` | `COMPLETED` | ✅ |
| `cancelled` | `CANCELLED` | ✅ |
| `awarded` | — | no está en STATE_MACHINES.md — gap |
| — | `PARTIALLY_PAID` | en spec pero no en código — gap |

---

## 4. Escenarios de Usuario

### P1-A — Cliente crea y publica un job

**Criterio de aceptación:**
```
DADO   que el actor tiene rol CLIENT con permiso jobs:create
CUANDO POST /v1/jobs con { title, scope, category, budgetMin, budgetMax, urgency }
ENTONCES se crea el job en estado DRAFT
  Y     se emite evento audit "job.create"
  Y     la respuesta incluye el job con id y status "draft"
CUANDO POST /v1/jobs/:id/transition con { targetStatus: "posted" }
ENTONCES el job pasa a estado POSTED
  Y     se emite evento audit "job.transition" con { from: "draft", to: "posted" }
  Y     se emite evento de dominio "job.status_changed"
```

**Casos borde:**
- `title` < 5 caracteres → `400 Bad Request`
- `scope` < 10 caracteres → `400 Bad Request`
- `budgetMin > budgetMax` → `400 Bad Request`
- Actor sin `jobs:create` → `403 Forbidden`

---

### P1-B — PRO hace bid en un job publicado

**Criterio de aceptación:**
```
DADO   que existe un job en estado POSTED
       Y el actor tiene rol PRO con permiso bids:create
CUANDO POST /v1/jobs/:jobId/bids con { proOrgId, amount, etaDays }
ENTONCES se crea el bid vinculado al job
  Y     se emite evento audit "bid.create"
  Y     la respuesta incluye el bid con id, amount, etaDays
```

**Casos borde:**
- `amount` ≤ 0 → `400 Bad Request`
- `etaDays` no entero positivo → `400 Bad Request`
- Job no está en estado POSTED → `400 Bad Request` (no acepta bids)

---

### P1-C — Cliente acepta bid → job pasa a ACCEPTED

**Criterio de aceptación:**
```
DADO   que existe un bid en un job POSTED
       Y el actor tiene rol CLIENT y es dueño del job
CUANDO POST /v1/bids/:bidId/accept
ENTONCES el bid queda en estado aceptado
  Y     el job transiciona a RESERVED y luego a ACCEPTED
  Y     se materializa un Project interno vinculado al job
  Y     se emite evento audit "bid.accept"
```

---

### P1-D — PRO solicita review → CLIENT completa el job

**Criterio de aceptación:**
```
DADO   que el job está en IN_PROGRESS y todos los milestones están PAID
       Y el actor tiene rol PRO
CUANDO POST /v1/jobs/:id/transition con { targetStatus: "review" }
ENTONCES el job pasa a estado REVIEW
  Y     el CLIENT puede ver el job en estado de revisión final
DADO   que el CLIENT revisa y aprueba el trabajo final
CUANDO POST /v1/jobs/:id/transition con { targetStatus: "completed" } (actor CLIENT)
ENTONCES el job pasa a COMPLETED
  Y     se emite evento audit "job.transition" con { from: "review", to: "completed" }
```

**Casos borde:**
- PRO intenta hacer `completed` directamente → `403 Forbidden` (CLIENT_ONLY)
- CLIENT intenta hacer `review` → `403 Forbidden` (PRO_ONLY)
- Transición no válida según JOB_TRANSITIONS → `422 Unprocessable Entity`

---

### P2-A — Cliente lista sus jobs con filtro de estado

**Criterio de aceptación:**
```
DADO   que el actor tiene permiso jobs:read
CUANDO GET /v1/jobs?status=in_progress
ENTONCES retorna solo los jobs en estado in_progress del tenant del actor
  Y     no retorna jobs de otros tenants
```

---

### P2-B — OPS_ADMIN consulta señales de agentes de un job

**Criterio de aceptación:**
```
DADO   que existen AgentRuns vinculados al job (correlationId prefix "job:<id>:")
CUANDO GET /v1/jobs/:jobId/agent-signals
ENTONCES retorna array de señales con { agentType, status, outputSummary, confidence, requiresHumanReview }
  Y     está ordenado por createdAt descendente
```

---

## 5. Contratos de API

### `POST /v1/jobs`

```yaml
método: POST
ruta: /v1/jobs
descripción: Crear un nuevo job en estado DRAFT

auth: requerida
roles: [CLIENT, OPS_ADMIN]
permiso: jobs:create
privacyCritical: false

input:
  schema: createRuntimeJobSchema
  campos:
    - nombre: title
      tipo: string
      requerido: true
      validación: min(5).max(140)
    - nombre: scope
      tipo: string
      requerido: true
      validación: min(10).max(5000)
    - nombre: category
      tipo: string
      requerido: false
      validación: min(2).max(80)
    - nombre: budgetType
      tipo: enum
      requerido: false
      valores: [fixed, range, hourly]
    - nombre: budgetMin
      tipo: number
      requerido: false
      validación: nonnegative() — 0 permitido
    - nombre: budgetMax
      tipo: number
      requerido: false
      validación: nonnegative() — debe ser ≥ budgetMin
    - nombre: locationType
      tipo: enum
      requerido: false
      valores: [remote, on_site, hybrid]
    - nombre: city
      tipo: string
      requerido: false
      validación: min(2).max(240)
    - nombre: urgency
      tipo: enum
      requerido: false
      valores: [low, medium, high, urgent]
    - nombre: deadline
      tipo: string
      requerido: false
      validación: min(8).max(40) — fecha en formato ISO
    - nombre: preferredProfessional
      tipo: objeto
      requerido: false
      campos: { userId: string, displayName: string, publicSlug?: string }

output:
  shape: JobRecord (via toVisibleJob)
  campos:
    - id: string (cuid)
    - tenantId: string
    - title: string
    - scope: string
    - status: "draft"
    - category?: string
    - budgetType?: string
    - budgetMin?: number
    - budgetMax?: number
    - location?: string — construida de locationType + city
    - urgency?: string
    - deadline?: string
    - preferredProfessional?: { userId, displayName, publicSlug? }

errores:
  400: title < 5 chars, scope < 10 chars, budgetMin > budgetMax
  403: actor sin jobs:create

efectos:
  auditLog: true — acción "job.create"
  evento: "job.created"
  sse: false
  fsmTransicion: → DRAFT
  workspaceMemory: true — se registra contexto del job
  paymentGovernance: false
```

---

### `GET /v1/jobs`

```yaml
método: GET
ruta: /v1/jobs
descripción: Listar jobs del tenant del actor (con filtro opcional de status)

auth: requerida
roles: [CLIENT, PRO, OPS_ADMIN]
permiso: jobs:read
privacyCritical: false

input:
  query:
    - nombre: status
      tipo: enum (jobRecordStatusSchema)
      requerido: false
      valores: [draft, posted, published, reserved, accepted, in_progress, review, dispute, completed, awarded, cancelled]

output: array de JobRecord (visible)

errores:
  400: status fuera del enum
  403: sin jobs:read

efectos: auditLog: false
```

---

### `GET /v1/jobs/:jobId`

```yaml
método: GET
ruta: /v1/jobs/:jobId
descripción: Detalle de un job por id

auth: requerida
roles: [CLIENT, PRO, OPS_ADMIN]
permiso: jobs:read
privacyCritical: false

input: jobId en path
output: JobRecord (visible) — incluye preferredProfessional si está configurado
errores:
  403: sin acceso al job
  404: jobId no existe en el tenant
efectos: auditLog: false
```

---

### `GET /v1/jobs/:jobId/agent-signals`

```yaml
método: GET
ruta: /v1/jobs/:jobId/agent-signals
descripción: Lista señales de agentes IA vinculados al job

auth: requerida
roles: [CLIENT, PRO, OPS_ADMIN]
permiso: jobs:read
privacyCritical: false

input: jobId en path
output:
  campos:
    - signals: array de AgentRun
      - id, agentType, status, outputSummary
      - actionType, confidence, requiresHumanReview
      - correlationId, createdAt
  ordenado: createdAt DESC
errores:
  403: sin acceso
  404: jobId no existe
efectos: auditLog: false
```

---

### `POST /v1/jobs/:jobId/transition`

```yaml
método: POST
ruta: /v1/jobs/:jobId/transition
descripción: Transicionar el estado de un job según la FSM

auth: requerida
roles: [CLIENT, PRO, OPS_ADMIN]
permiso: jobs:update
privacyCritical: false

input:
  schema: transitionJobSchema (inline)
  campos:
    - nombre: targetStatus
      tipo: enum
      requerido: true
      valores: [posted, reserved, accepted, in_progress, review, completed, cancelled, dispute, awarded]

output: JobRecord actualizado (visible)

errores:
  400: targetStatus fuera del enum
  403: actor no autorizado para esa transición
      (CLIENT intenta PRO_ONLY: review, dispute)
      (PRO intenta CLIENT_ONLY: completed, cancelled)
  404: jobId no existe
  422: transición no permitida por JOB_TRANSITIONS
      ("Job cannot transition from 'X' to 'Y'. Allowed: ...")

efectos:
  auditLog: true — acción "job.transition" con { from, to } en afterJson
  evento: "job.status_changed" (DomainEventBus)
  sse: false
  fsmTransicion: estado_actual → targetStatus
  workspaceMemory: true — se actualiza contexto del job
  paymentGovernance: false
```

---

### `POST /v1/jobs/:jobId/archive`

```yaml
método: POST
ruta: /v1/jobs/:jobId/archive
descripción: Archivar un job (soft delete lógico)

auth: requerida
roles: [CLIENT, OPS_ADMIN]
permiso: jobs:archive
privacyCritical: false

input: ninguno (jobId en path)
output:
  campos:
    - id: string
    - archivedAt: string (ISO)

errores:
  403: actor sin jobs:archive
  404: jobId no existe en el tenant

efectos:
  auditLog: true — acción "job.archive"
  sse: false
  paymentGovernance: false
```

---

### `POST /v1/jobs/:jobId/restore`

```yaml
método: POST
ruta: /v1/jobs/:jobId/restore
descripción: Restaurar un job archivado

auth: requerida
roles: [CLIENT, OPS_ADMIN]
permiso: jobs:restore
privacyCritical: false

input: ninguno (jobId en path)
output: JobRecord restaurado
errores:
  403: sin jobs:restore
  404: job no existe o no está archivado
efectos:
  auditLog: true
  sse: false
```

---

### `GET /v1/jobs/:jobId/bids`

```yaml
método: GET
ruta: /v1/jobs/:jobId/bids
descripción: Lista todos los bids de un job

auth: requerida
roles: [CLIENT, OPS_ADMIN]
permiso: bids:read
privacyCritical: false

input: jobId en path
output: array de BidRecord
  campos: id, jobId, proOrgId, amount, etaDays, status, createdAt
errores:
  403: PRO no puede listar bids de otros (solo ve el suyo)
  404: jobId no existe
efectos: auditLog: false
```

---

### `POST /v1/jobs/:jobId/bids`

```yaml
método: POST
ruta: /v1/jobs/:jobId/bids
descripción: PRO hace una oferta (bid) en un job publicado

auth: requerida
roles: [PRO, OPS_ADMIN]
permiso: bids:create
privacyCritical: false

input:
  schema: createBidSchema (bidSchema sin jobId)
  campos:
    - nombre: proOrgId
      tipo: string
      requerido: true
      validación: min(1)
    - nombre: amount
      tipo: number
      requerido: true
      validación: positive() — > 0
    - nombre: etaDays
      tipo: number
      requerido: true
      validación: int().positive() — días estimados de ejecución

output:
  shape: BidRecord
  campos: id, tenantId, jobId, proOrgId, amount, etaDays, status, createdAt

errores:
  400: amount ≤ 0, etaDays no entero positivo
  403: actor sin bids:create
  404: jobId no existe
  409: PRO ya tiene un bid activo en este job (si aplica la restricción)

efectos:
  auditLog: true — acción "bid.create"
  evento: "bid.created" (si existe en EVENT_CATALOG)
  sse: false
  paymentGovernance: false
```

---

### `POST /v1/bids/:bidId/accept`

```yaml
método: POST
ruta: /v1/bids/:bidId/accept
descripción: Cliente acepta un bid — materializa el flujo comercial (bridge legacy)

auth: requerida
roles: [CLIENT, OPS_ADMIN]
permiso: bids:accept
privacyCritical: false

input: ninguno (bidId en path)

output: BidRecord actualizado con status aceptado

errores:
  403: actor no es dueño del job al que pertenece el bid
  404: bidId no existe
  409: bid ya fue aceptado o job no está en estado que permite aceptación

efectos:
  auditLog: true — acción "bid.accept"
  fsmTransicion: job POSTED → RESERVED → ACCEPTED (materialización via bridge)
  materializacion: crea Project interno vinculado al job y al PRO
  paymentGovernance: false (ocurre al fondear escrow, no al aceptar)

nota: |
  Este endpoint es el "legacy compatibility bridge" mencionado en SEMSE_API_SURFACE_V1.md.
  Adjudica el bid y materializa la reserva/proyecto en un solo paso.
  El flujo canónico futuro separa: reservations → accept reservation → project.
```

---

## 6. Criterios de Éxito

| Métrica | Valor objetivo |
|---------|---------------|
| Latencia P95 create | < 400ms |
| Latencia P95 transition | < 300ms |
| Latencia P95 list | < 200ms |
| Transición inválida retorna 422 con mensaje claro | 100% |
| Transición no autorizada retorna 403 | 100% |
| Audit log en create/transition/archive | 100% |
| Cobertura de tests | ≥ 80% branches |

---

## 7. Tests Requeridos

```typescript
describe("POST /v1/jobs") {
  it("CLIENT crea job en estado DRAFT con campos mínimos (title + scope)")
  it("rechaza con 400 si title tiene < 5 caracteres")
  it("rechaza con 400 si scope tiene < 10 caracteres")
  it("rechaza con 400 si budgetMin > budgetMax")
  it("rechaza con 403 si actor no tiene jobs:create")
  it("persiste location correctamente para locationType=remote con city")
  it("emite evento audit 'job.create'")
}

describe("POST /v1/jobs/:id/transition") {
  it("CLIENT puede transicionar DRAFT → POSTED")
  it("PRO puede transicionar IN_PROGRESS → REVIEW")
  it("CLIENT puede transicionar REVIEW → COMPLETED")
  it("rechaza con 422 si la transición no está en JOB_TRANSITIONS")
  it("rechaza con 403 si CLIENT intenta PRO_ONLY (review, dispute)")
  it("rechaza con 403 si PRO intenta CLIENT_ONLY (completed, cancelled)")
  it("emite evento audit 'job.transition' con {from, to} en afterJson")
  it("emite evento dominio 'job.status_changed'")
}

describe("POST /v1/jobs/:id/bids y POST /v1/bids/:id/accept") {
  it("PRO crea bid con amount positivo y etaDays entero")
  it("rechaza con 400 si amount es 0 o negativo")
  it("rechaza con 400 si etaDays no es entero positivo")
  it("CLIENT acepta bid → bid queda aceptado")
  it("aceptar bid emite audit 'bid.accept'")
  it("rechaza con 403 si CLIENT intenta aceptar bid de job ajeno")
}

describe("GET /v1/jobs") {
  it("retorna jobs del tenant del actor sin filtro")
  it("filtra correctamente por status=in_progress")
  it("rechaza con 400 si status es valor fuera del enum")
  it("no retorna jobs de otros tenants")
}

describe("GET /v1/jobs/:id/agent-signals") {
  it("retorna signals con correlationId que empieza con 'job:<id>:'")
  it("ordena por createdAt DESC")
  it("retorna array vacío si no hay AgentRuns vinculados")
}
```

---

## 8. Impacto en otros dominios

| Dominio | Impacto | Detalle |
|---------|---------|---------|
| Milestones | ✅ Padre | Un job tiene milestones. COMPLETED requiere milestones resueltos |
| Evidence | ✅ Indirecto | Evidencia se vincula a jobId |
| Payments/Escrow | ✅ Directo | Escrow se crea por job. Job COMPLETED requiere escrow RELEASED |
| Contracts | ✅ Directo | `bids/:id/accept` materializa contrato base |
| BuildOps | ✅ Directo | Job publicado dispara BuildOps bridge |
| Prometeo RAG | ✅ Indirecto | Smart Intake genera jobs. Job context en workspace memory |
| Workspace Memory | ✅ Directo | create y transition actualizan memoria del workspace |
| Disputes | ✅ Directo | Job puede entrar en DISPUTE → bloquea escrow |
| Trust | ✅ Indirecto | `job.completed` es señal positiva de trust |
| Communications | 🟡 Futuro | Notificaciones bid aceptado, job completado |
| Smart Intake | ✅ Directo | Intake crea jobs automáticamente |
| Agent Signals | ✅ Directo | AgentRuns se vinculan por correlationId al job |

---

## 9. Gaps identificados

| Gap | Tipo | Severidad |
|-----|------|-----------|
| `awarded` y `published` existen en código pero no están en `STATE_MACHINES.md` — FSM canónica incompleta | FSM | 🟡 Media |
| `PARTIALLY_PAID` está en `STATE_MACHINES.md` pero no en implementación | FSM | 🟡 Media |
| `PATCH /v1/jobs/:jobId` (para editar título, scope, budget) aparece en `SEMSE_API_SURFACE_V1.md` pero no está en el controller | Contrato | 🟡 Media |
| No hay validación de que el job esté en estado POSTED antes de aceptar un bid — puede existir una edge case | Guard | 🟡 Media |
| `bids:read` debería restringir al PRO a ver solo su propio bid — actualmente cualquier actor con permiso ve todos | Seguridad | 🟡 Media |
| No hay rate limiting en `POST /v1/jobs/:jobId/bids` — un PRO podría hacer bids múltiples | Regla de negocio | 🟢 Baja |
| `POST /v1/jobs/:jobId/restore` no tiene audit log explícito documentado en código | Audit | 🟢 Baja |
| `GET /v1/jobs/:jobId/trust` y `GET /v1/projects/:projectId/trust` están en surface v1 pero no tienen módulo de controller visible | Feature | 🟡 Media |

---

## 10. Supuestos y Dependencias

- [ ] Un job siempre pertenece a un tenant — el `tenantId` se resuelve del `resolveRequestContext` del request header
- [ ] `bids/:id/accept` es el puente legacy — el flujo canónico futuro usará `reservations/:id/accept`
- [ ] El job pasa a ACCEPTED internamente al aceptar el bid — el endpoint de transition ACCEPTED es redundante en ese flujo
- [ ] Los AgentRuns vinculados a un job usan `correlationId` con prefijo `job:<jobId>:` — convención de routing de agentes
- [ ] `preferredProfessional` se almacena en WorkspaceMemory (no en la entidad Job directamente) — se carga en el list/detail

---

## Checklist de aprobación

- [x] Todos los escenarios P1 tienen Given/When/Then
- [x] Todos los endpoints (10) tienen contrato completo
- [x] FSM declarada con JOB_TRANSITIONS reales del código
- [x] Reglas de autorización por transición (CLIENT_ONLY / PRO_ONLY) documentadas
- [x] Mapeo código ↔ spec canónico con discrepancias documentadas
- [x] Tests requeridos listados (5 describes, 20+ casos)
- [x] Impacto en 12 dominios documentado
- [x] Gaps identificados (8 gaps) con severidad
- [x] `bids/:id/accept` documentado como legacy bridge con nota de migración futura
- [x] Status: `APPROVED`
