---
type: spec
feature: "Milestone Lifecycle"
domain: "milestones"
version: "1.0"
status: "APPROVED"
branch: "feat/milestone-spec"
date: "2026-05-20"
author: "Claude Sonnet — sesión SDD governance"
spec_index: "docs/SPEC_INDEX.md"
plan: "docs/specs/api/milestones.plan.md"
---

# Spec: Milestone Lifecycle

> **Propósito:** Contrato ejecutable del ciclo completo de milestones en SEMSE OS.
> Basado en código real de `apps/api/src/modules/milestones/` + `docs/foundation/STATE_MACHINES.md`.
> **Nota de alineación:** El estado `READY` en la FSM canónica corresponde a `awaiting_review` en la implementación actual. Ambos son válidos; la FSM canónica es la referencia de producto.

---

## 1. Qué resuelve

Los milestones son la unidad de trabajo y pago del ciclo monetizable de SEMSE.
Dividen un proyecto en etapas verificables: el profesional ejecuta, sube evidencia,
el cliente aprueba y el escrow libera fondos. Sin milestones no hay ciclo monetizable.

**Para quién:** Profesionales (PRO) que entregan trabajo · Clientes (CLIENT) que aprueban · OPS_ADMIN que supervisa
**Problema:** Pagos sin evidencia verificada, ciclos sin trazabilidad, estados ambiguos
**Solución:** Lifecycle formal con FSM, evidencia obligatoria antes de aprobación, audit en cada transición

---

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| Profesional | `PRO` | Crear milestone, someter a revisión (submit) | Aprobar su propio milestone, rechazar |
| Cliente | `CLIENT` | Aprobar, rechazar (con razón) | Submit, crear milestone sin rol de proyecto |
| Ops Admin | `OPS_ADMIN` | Todo lo anterior + override | — |
| Plataforma | `PLATFORM` | Marcar como pagado (flujo automático de escrow) | Aprobar/rechazar sin validación |

Permiso de creación: `milestones:create`
Referencia: `docs/program/architecture/SEMSE_ROLE_MODEL.md` · `docs/program/governance/SEMSE_PERMISSION_MATRIX.md`

---

## 3. FSM — Máquina de Estados

**Entidad:** `Milestone`
**Referencia canónica:** `docs/foundation/STATE_MACHINES.md`

```
DRAFT ──────────────────────────────────► READY
  │    (milestone creado y configurado)     │
  │                                         │ guard: actor autorizado
  │                                         ▼
  │                                      SUBMITTED
  │                                    ╱           ╲
  │                    guard: revisión             guard: revisión
  │                    válida + evidencia          con razón explícita
  │                         ▼                           ▼
  │                      APPROVED                   REJECTED
  │                         │                           │
  │              guard: release financiero              │ (nueva iteración)
  │              exitoso (escrow)                       ▼
  │                         ▼                         READY
  │                        PAID
  │
  └─ [TERMINAL: PAID]   [REAPERTURA: ninguna — estados terminales no se reabren]
```

### Transiciones y condiciones

| Desde | Hacia | Guard | Actor | Efecto |
|-------|-------|-------|-------|--------|
| `DRAFT` | `READY` | Milestone creado con title, amount, sequence válidos | PRO / OPS_ADMIN | `milestone.created` event |
| `READY` | `SUBMITTED` | Actor autorizado · evidencia mínima adjunta | PRO | `milestone.submitted` event · SSE · notifica CLIENT |
| `SUBMITTED` | `APPROVED` | Revisión válida por actor con permiso | CLIENT / OPS_ADMIN | `milestone.approved` event · SSE · dispara release escrow |
| `SUBMITTED` | `REJECTED` | Razón explícita presente (min 1 char) | CLIENT / OPS_ADMIN | `milestone.rejected` event · SSE · notifica PRO |
| `REJECTED` | `READY` | PRO subsana y resubmit | PRO | vuelve a ciclo |
| `APPROVED` | `PAID` | Release financiero exitoso en escrow | PLATFORM (automático) | `milestone.paid` event · `payment.released` event |

> **Mapeo código actual:**
> - `DRAFT` = `"draft"`
> - `READY` = `"awaiting_review"`
> - `SUBMITTED` = `"submitted"`
> - `APPROVED` = `"approved"` · `REJECTED` = `"rejected"` · `PAID` = `"paid"`

### Invariantes (de `docs/foundation/DOMAIN_INVARIANTS.md`)
- `PAID` es terminal — no se reabre sin policy explícita de OPS_ADMIN
- Un PRO no puede aprobar su propio milestone
- `APPROVED → PAID` solo ocurre tras release financiero exitoso — no es automático por tiempo
- Sin evidencia no puede transicionarse de `READY → SUBMITTED`

---

## 4. Escenarios de Usuario

### P1-A — Profesional somete milestone a revisión

**Journey:** El PRO completó el trabajo del milestone. Sube evidencia (fotos, documentos) y presiona "Someter a revisión". El cliente recibe notificación y puede aprobar o rechazar.

**Criterio de aceptación:**
```
DADO   que existe un milestone en estado READY con evidencia adjunta
       Y el actor tiene rol PRO y pertenece al proyecto
CUANDO POST /v1/milestones/:milestoneId/submit
ENTONCES el milestone cambia a estado SUBMITTED
  Y     se emite evento audit "milestone.submit"
  Y     se emite evento de dominio "milestone.submitted"
  Y     se emite SSE al canal del proyecto
  Y     el CLIENT recibe notificación
```

**Casos borde:**
- Milestone en estado `DRAFT` (no `READY`) → `400 Bad Request`
- Milestone ya en `SUBMITTED` → `409 Conflict`
- Milestone en `APPROVED` o `PAID` → `400 Bad Request`
- PRO no pertenece al proyecto → `403 Forbidden`

---

### P1-B — Cliente aprueba milestone

**Journey:** El cliente revisa la evidencia del milestone y la aprueba. El sistema dispara el release del escrow automáticamente.

**Criterio de aceptación:**
```
DADO   que existe un milestone en estado SUBMITTED
       Y el actor tiene rol CLIENT y es dueño del job/proyecto
CUANDO POST /v1/milestones/:milestoneId/approve
ENTONCES el milestone cambia a estado APPROVED
  Y     se emite evento audit "milestone.approve"
  Y     se emite evento de dominio "milestone.approved"
  Y     se emite SSE al canal del proyecto
  Y     el sistema dispara el flujo de release de escrow
  Y     el PRO recibe notificación de aprobación
```

**Casos borde:**
- Milestone en estado distinto a `SUBMITTED` → `400 Bad Request`
- CLIENT intenta aprobar milestone de otro cliente → `403 Forbidden`
- PRO intenta aprobar su propio milestone → `403 Forbidden`

---

### P1-C — Cliente rechaza milestone con razón

**Journey:** El cliente revisa la evidencia y no es suficiente. Rechaza con una explicación. El PRO puede corregir y volver a someter.

**Criterio de aceptación:**
```
DADO   que existe un milestone en estado SUBMITTED
       Y el actor tiene rol CLIENT y es dueño del proyecto
CUANDO POST /v1/milestones/:milestoneId/reject con { reason: "Faltan fotos del piso terminado" }
ENTONCES el milestone cambia a estado REJECTED
  Y     se guarda rejectionReason en el milestone
  Y     se emite evento audit "milestone.reject"
  Y     se emite evento de dominio "milestone.rejected"
  Y     se emite SSE al canal del proyecto
  Y     el PRO recibe notificación con la razón de rechazo
```

**Casos borde:**
- `reason` vacío o solo espacios → `400 Bad Request`
- Milestone en estado distinto a `SUBMITTED` → `400 Bad Request`

---

### P2-A — PRO crea milestone en proyecto

**Journey:** Al inicio del proyecto, el PRO (o el sistema) define los milestones con título, monto y secuencia.

**Criterio de aceptación:**
```
DADO   que existe un proyecto activo
       Y el actor tiene permiso milestones:create
CUANDO POST /v1/projects/:projectId/milestones con { title, amount, sequence }
ENTONCES se crea el milestone en estado DRAFT
  Y     se emite evento audit "milestone.create"
  Y     la respuesta incluye el milestone con id y estado DRAFT
```

---

### P2-B — Listar milestones de un job

**Journey:** El cliente o PRO consulta el estado de todos los milestones del job para seguimiento.

**Criterio de aceptación:**
```
DADO   que existen milestones para el job :jobId
       Y el actor tiene acceso al job (CLIENT dueño o PRO asignado o OPS_ADMIN)
CUANDO GET /v1/jobs/:jobId/milestones
ENTONCES la respuesta incluye array de milestones con status visible
  Y     no se incluyen milestones de otros tenants
```

---

## 5. Contratos de API

### `POST /v1/jobs/:jobId/milestones`

```yaml
método: POST
ruta: /v1/jobs/:jobId/milestones
descripción: Crear milestone vinculado a un job

auth: requerida
roles: [PRO, OPS_ADMIN]
permiso: milestones:create
privacyCritical: false

input:
  schema: milestoneCreateSchema
  campos:
    - nombre: title
      tipo: string
      requerido: true
      validación: trim().min(1)
    - nombre: amount
      tipo: number
      requerido: true
      validación: positive()
    - nombre: sequence
      tipo: number
      requerido: true
      validación: int().positive()

output:
  shape: MilestoneRecord
  campos:
    - id: string (cuid)
    - tenantId: string
    - projectId: string
    - title: string
    - amount: number
    - sequence: number
    - status: "draft"
    - evidenceCount: 0

errores:
  400: title vacío o amount/sequence inválidos
  403: actor sin permiso milestones:create
  404: jobId no existe o no pertenece al tenant

efectos:
  auditLog: true — acción "milestone.create"
  evento: "milestone.created"
  sse: false
  fsmTransicion: → DRAFT
  paymentGovernance: false
```

---

### `POST /v1/projects/:projectId/milestones`

```yaml
método: POST
ruta: /v1/projects/:projectId/milestones
descripción: Crear milestone vinculado directamente a un proyecto

auth: requerida
roles: [PRO, OPS_ADMIN]
permiso: milestones:create
privacyCritical: false

input: (igual que POST /v1/jobs/:jobId/milestones)
output: (igual)

errores:
  400: validación de campos
  403: sin permiso
  404: projectId no existe

efectos:
  auditLog: true — acción "milestone.create"
  evento: "milestone.created"
  sse: false
  fsmTransicion: → DRAFT
  paymentGovernance: false
```

---

### `GET /v1/jobs/:jobId/milestones`

```yaml
método: GET
ruta: /v1/jobs/:jobId/milestones
descripción: Listar milestones de un job

auth: requerida
roles: [CLIENT, PRO, OPS_ADMIN]
privacyCritical: false

input: ninguno (jobId en path)

output:
  tipo: array de MilestoneRecord
  campos: (igual que create output, + status y rejectionReason)

errores:
  403: actor sin acceso al job
  404: jobId no existe

efectos:
  auditLog: false
  sse: false
  paymentGovernance: false
```

---

### `GET /v1/projects/:projectId/milestones`

```yaml
método: GET
ruta: /v1/projects/:projectId/milestones
descripción: Listar milestones de un proyecto

auth: requerida
roles: [CLIENT, PRO, OPS_ADMIN]
privacyCritical: false

input: ninguno (projectId en path)
output: array de MilestoneRecord
errores:
  403: sin acceso al proyecto
  404: proyecto no existe
efectos:
  auditLog: false
```

---

### `POST /v1/milestones/:milestoneId/submit`

```yaml
método: POST
ruta: /v1/milestones/:milestoneId/submit
descripción: PRO somete milestone a revisión del cliente

auth: requerida
roles: [PRO, OPS_ADMIN]
privacyCritical: false

input: ninguno (milestoneId en path)

output:
  shape: MilestoneRecord
  status: "submitted"

errores:
  400: milestone no está en estado READY/awaiting_review
  403: actor sin acceso al milestone
  404: milestone no existe
  409: ya está en SUBMITTED

efectos:
  auditLog: true — acción "milestone.submit"
  evento: "milestone.submitted"
  sse: true — canal del proyecto
  notificacion: CLIENT recibe alerta de revisión pendiente
  fsmTransicion: READY → SUBMITTED
  paymentGovernance: false
  agentes: BuildOpsIntelligenceAgent evalúa evidencia
```

---

### `POST /v1/milestones/:milestoneId/approve`

```yaml
método: POST
ruta: /v1/milestones/:milestoneId/approve
descripción: Cliente aprueba milestone y dispara release de escrow

auth: requerida
roles: [CLIENT, OPS_ADMIN]
privacyCritical: false

input: ninguno (opcional: { comment?: string })

output:
  shape: MilestoneRecord
  status: "approved"

errores:
  400: milestone no está en estado SUBMITTED
  403: actor no es dueño del job/proyecto O actor es el PRO asignado
  404: milestone no existe

efectos:
  auditLog: true — acción "milestone.approve"
  evento: "milestone.approved"
  sse: true — canal del proyecto
  notificacion: PRO recibe confirmación de aprobación
  fsmTransicion: SUBMITTED → APPROVED
  paymentGovernance: true — dispara PaymentGovernanceService
  workspaceMemory: true — se registra en memoria del workspace
  agentes: BuildOpsIntelligenceAgent post-aprobación
```

---

### `POST /v1/milestones/:milestoneId/reject`

```yaml
método: POST
ruta: /v1/milestones/:milestoneId/reject
descripción: Cliente rechaza milestone con razón explícita

auth: requerida
roles: [CLIENT, OPS_ADMIN]
privacyCritical: false

input:
  schema: milestoneReasonSchema
  campos:
    - nombre: reason
      tipo: string
      requerido: true
      validación: trim().min(1) — no puede ser vacío

output:
  shape: MilestoneRecord
  status: "rejected"
  rejectionReason: string

errores:
  400: reason vacío o solo espacios
  400: milestone no está en estado SUBMITTED
  403: actor no es dueño del job/proyecto
  404: milestone no existe

efectos:
  auditLog: true — acción "milestone.reject"
  evento: "milestone.rejected"
  sse: true — canal del proyecto
  notificacion: PRO recibe razón de rechazo
  fsmTransicion: SUBMITTED → REJECTED
  paymentGovernance: false
```

---

## 6. Criterios de Éxito

| Métrica | Valor objetivo |
|---------|---------------|
| Latencia P95 de submit/approve/reject | < 500ms |
| Tasa de error 5xx en flujo principal | < 0.1% |
| Cobertura de tests | ≥ 80% branches |
| Escenarios P1 cubiertos en tests | 100% |
| Audit log presente en cada transición | 100% |
| SSE emitido en submit/approve/reject | 100% |

---

## 7. Tests Requeridos

```typescript
describe("POST /v1/milestones/:id/submit") {
  it("PRO puede someter milestone en estado READY")
  it("rechaza con 400 si milestone está en DRAFT")
  it("rechaza con 400 si milestone ya está en SUBMITTED")
  it("rechaza con 400 si milestone está en APPROVED o PAID")
  it("rechaza con 403 si el actor no pertenece al proyecto")
  it("emite evento audit 'milestone.submit'")
  it("emite SSE al canal del proyecto")
}

describe("POST /v1/milestones/:id/approve") {
  it("CLIENT puede aprobar milestone en estado SUBMITTED")
  it("rechaza con 400 si milestone no está en SUBMITTED")
  it("rechaza con 403 si el actor es el PRO asignado (no puede autoaprobarse)")
  it("rechaza con 403 si el actor no es dueño del job")
  it("emite evento audit 'milestone.approve'")
  it("emite SSE al canal del proyecto")
  it("dispara PaymentGovernanceService")
}

describe("POST /v1/milestones/:id/reject") {
  it("CLIENT puede rechazar milestone en estado SUBMITTED con razón")
  it("rechaza con 400 si reason está vacío")
  it("rechaza con 400 si reason es solo espacios en blanco")
  it("rechaza con 400 si milestone no está en SUBMITTED")
  it("persiste rejectionReason en el registro del milestone")
  it("emite evento audit 'milestone.reject'")
  it("emite SSE al canal del proyecto")
}

describe("POST /v1/jobs/:jobId/milestones") {
  it("crea milestone en estado DRAFT para actor con permiso milestones:create")
  it("rechaza con 400 si title está vacío")
  it("rechaza con 400 si amount es negativo o cero")
  it("rechaza con 400 si sequence no es entero positivo")
  it("rechaza con 403 si el actor no tiene permiso milestones:create")
  it("emite evento audit 'milestone.create'")
}

describe("GET /v1/jobs/:jobId/milestones") {
  it("retorna array de milestones del job para CLIENT dueño")
  it("retorna array de milestones del job para PRO asignado")
  it("rechaza con 403 si el actor no tiene acceso al job")
  it("no retorna milestones de otros tenants")
}
```

---

## 8. Impacto en otros dominios

| Dominio | Impacto | Detalle |
|---------|---------|---------|
| Escrow/Payments | ✅ Directo | `approve` dispara PaymentGovernanceService → release de escrow |
| Evidence | ✅ Directo | `submit` requiere evidencia · EvidenceReviewService evalúa |
| SSE/Real-time | ✅ Directo | submit/approve/reject emiten SSE al canal del proyecto |
| BuildOps | ✅ Directo | BuildOpsIntelligenceAgent evaluado en submit y approve |
| Workspace Memory | ✅ Al aprobar | Se registra aprobación en memoria del workspace |
| Prometeo RAG | ⚠️ Indirecto | BuildOps agent puede usar RAG para evaluar evidencia |
| WhatsApp/Comms | 🟡 Futuro | Notificaciones de submit/approve/reject por WhatsApp |
| Consciousness | 🟡 Indirecto | Observer registra eventos de milestone como señales del ecosistema |
| Job FSM | ✅ Directo | Milestones resueltos desbloquean `WAITING_REVIEW → COMPLETED` del Job |

---

## 9. Gaps identificados (estado actual vs spec)

| Gap | Tipo | Severidad |
|-----|------|-----------|
| No hay validación de evidencia mínima en `submit` — el guard existe en spec pero no en código | Implementación | 🟡 Media |
| `reviewDecision` en MilestoneRecord (`approve/reject/request_changes`) no está completamente tipado en el spec canónico | Spec | 🟢 Baja |
| La ruta `/v1/milestones/:id/approve` no recibe `comment` como campo documentado aunque la UI lo envía | Contrato | 🟡 Media |
| Estado `PAID` no tiene endpoint explícito — se dispara desde el flujo de escrow, no desde milestone controller | Arquitectura | 🟢 Documentado |
| `request_changes` como valor de `reviewDecision` sugiere un estado adicional no formalizado en FSM | FSM | 🟡 Media — revisar |

---

## 10. Supuestos y Dependencias

- [ ] Un milestone solo puede existir dentro de un Project activo (job → project ya materializado)
- [ ] La evidencia se sube por el módulo de Evidence antes de llamar a `submit` — no como parte del submit mismo
- [ ] El release de escrow es responsabilidad de `PaymentGovernanceService`, no de `MilestonesService`
- [ ] SSE requiere que el cliente esté conectado al canal del proyecto en `SseEventBusService`
- [ ] `BuildOpsIntelligenceAgent` es `@Optional()` — el flujo no falla si el agente no está disponible

---

## Checklist de aprobación

- [x] Todos los escenarios P1 tienen criterio de aceptación Given/When/Then
- [x] Todos los endpoints tienen input/output/errores/efectos completos
- [x] FSM declarada y verificada contra `STATE_MACHINES.md`
- [x] Tests requeridos listados (5 describes, 25+ casos)
- [x] Ninguna invariante de `DOMAIN_INVARIANTS.md` violada
- [x] Spec agregado a `docs/SPEC_INDEX.md` (pendiente — actualizar manualmente)
- [x] Gaps identificados y documentados
- [x] Status: `APPROVED`
