---
id: api-evidence-upload-review
title: "Evidence Upload and Review API"
type: spec
feature: "Evidence Upload & Review"
domain: "evidence"
version: "1.0"
status: "VERIFIED"
owner: semse-core
risk: critical
branch: "feat/evidence-spec"
date: "2026-05-20"
author: "Claude Sonnet — sesión SDD governance"
spec_index: "docs/SPEC_INDEX.md"
plan: "docs/specs/api/evidence.plan.md"
depends_on: "docs/specs/api/milestones.spec.md"
related_files:
  - apps/api/src/modules/evidence
  - apps/api/src/modules/operational-intelligence/evidence-review.service.ts
  - packages/schemas/src/evidence.schema.ts
related_tests:
  - apps/api/test/evidence.spec-contract.test.ts
  - apps/api/test/evidence-review.service.test.ts
  - apps/api/test/evidence-crud-phase2.test.ts
related_endpoints:
  - v1/evidence
  - v1/uploads
related_events:
  - evidence.uploaded
  - evidence.validated
  - evidence.rejected
related_agents:
  - evidence-coach
  - evidence-analyzer
last_verified: 2026-06-09
---

# Spec: Evidence Upload & Review

> **Propósito:** Contrato ejecutable del ciclo de subida, registro y revisión de evidencia.
> La evidencia es el prerequisito de `milestone.submit` — sin ella el ciclo monetizable no avanza.
> Basado en código real de `apps/api/src/modules/evidence/` y `packages/schemas/src/evidence.schema.ts`.

---

## 1. Qué resuelve

La evidencia es la prueba física del trabajo ejecutado: fotos, videos, documentos.
Es el guard obligatorio antes de que un milestone pueda ser sometido a revisión del cliente.
Sin evidencia verificada no hay aprobación, sin aprobación no hay pago.

El módulo resuelve tres problemas:
1. **Subida segura** — URL pre-firmada para archivos pequeños (<25MB) o sesión multipart para archivos grandes
2. **Registro** — vincular la evidencia subida a un job, proyecto o milestone
3. **Revisión IA** — agente LLM evalúa la evidencia automáticamente antes de presentarla al cliente

**Para quién:** PRO que sube pruebas de trabajo · CLIENT que revisa · OPS_ADMIN que supervisa · Agente IA que pre-evalúa
**privacyCritical:** `true` — la revisión de evidencia de obra se procesa por Ollama local, nunca por cloud LLM

---

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| Profesional | `PRO` | Presign · Upload · Register · List (propios) | Revisar ni aprobar su propia evidencia |
| Cliente | `CLIENT` | List · Detail (de su job/proyecto) | Subir, registrar |
| Ops Admin | `OPS_ADMIN` | Todo | — |
| Agente IA | `PLATFORM` | Revisar evidencia automáticamente (EvidenceReviewService) | Aprobar/rechazar milestone sin actor humano |

Permiso de escritura: `evidence:write`
Permiso de lectura: `evidence:read`

---

## 3. FSM — Máquina de Estados

**Entidad:** `Evidence`
**Referencia canónica:** `docs/foundation/STATE_MACHINES.md`

```
[archivo en storage]
       │
       ▼
   UPLOADED ──────────────────────────► UNDER_REVIEW
  (registrado                          (EvidenceReviewService
   en DB vía                            evalúa con LLM Ollama)
   POST /v1/evidence)                        │
                                       ╱           ╲
                             guard:                guard:
                             review OK             review falla /
                             confidence ≥ 0.5      disputeRisk = true
                                  ▼                     ▼
                              ACCEPTED              REJECTED
                           (habilita                (PRO debe
                            milestone.submit)        resubir)

[TERMINALES: ACCEPTED, REJECTED — no se reabren sin nueva evidencia]
```

### Transiciones y condiciones

| Desde | Hacia | Guard | Actor | Efecto |
|-------|-------|-------|-------|--------|
| — | `UPLOADED` | key válida + contexto (jobId o milestoneId) | PRO vía `POST /v1/evidence` | `evidence.uploaded` event · audit |
| `UPLOADED` | `UNDER_REVIEW` | Review disparado por milestone.submit | PLATFORM (automático) | `evidence.review_started` |
| `UNDER_REVIEW` | `ACCEPTED` | LLM confidence ≥ umbral · disputeRisk=false | PLATFORM (EvidenceReviewService) | `evidence.accepted` · SSE · habilita submit |
| `UNDER_REVIEW` | `REJECTED` | LLM detecta problema crítico o riskLevel=critical | PLATFORM o OPS_ADMIN | `evidence.rejected` · SSE · notifica PRO |

> **Nota:** En el flujo actual, la transición `UPLOADED → UNDER_REVIEW → ACCEPTED/REJECTED`
> ocurre al momento del `milestone.submit`, no de forma asíncrona. El agente evalúa en
> el mismo request cycle vía `EvidenceReviewService`.

### Invariantes
- Evidencia sin contexto de job, proyecto o milestone no entra al flujo core
- Toda revisión registra: actor, motivo, timestamp, confianza, riskLevel
- La evidencia rechazada no bloquea crear nueva evidencia — el PRO puede resubir

---

## 4. Flujo de Subida (dos caminos)

### Camino A — Archivo pequeño (< 25 MB): Single PUT

```
PRO                    API                      Storage
 │                      │                          │
 │─ POST /v1/evidence ──►│                          │
 │  /presign             │                          │
 │◄─ { uploadUrl, key } ─│                          │
 │                       │                          │
 │─ PUT uploadUrl ────────────────────────────────►│
 │◄─ 200 OK ──────────────────────────────────────│
 │                       │                          │
 │─ POST /v1/evidence ──►│                          │
 │  { key, kind,         │                          │
 │    milestoneId }       │                          │
 │◄─ EvidenceRecord ─────│                          │
```

### Camino B — Archivo grande (≥ 25 MB): Multipart

```
PRO                    API
 │─ POST /v1/uploads/plan ──────────────────────────►
 │◄─ { recommendedStrategy: "external_transfer", ... }
 │
 │─ POST /v1/uploads/multipart-session ─────────────►
 │◄─ { sessionId, parts[{partNumber, uploadUrl}] }
 │
 │  (por cada parte):
 │─ PUT /v1/uploads/multipart-session/:id/parts/:n ─►
 │◄─ { partNumber, status:"uploaded", etag }
 │
 │─ POST /v1/uploads/multipart-session/complete ─────►
 │◄─ { status:"completed", partsReceived }
 │
 │─ POST /v1/evidence { key, kind, milestoneId } ───►
 │◄─ EvidenceRecord
```

---

## 5. Escenarios de Usuario

### P1-A — PRO sube foto de trabajo y la registra en un milestone

**Criterio de aceptación:**
```
DADO   que existe un milestone en estado READY
       Y el actor tiene rol PRO con permiso evidence:write
CUANDO POST /v1/evidence/presign con { filename: "foto.jpg", contentType: "image/jpeg" }
  Y   PUT al uploadUrl retornado (upload del archivo real)
  Y   POST /v1/evidence con { key, kind: "PHOTO", milestoneId }
ENTONCES se crea un registro de evidencia en estado UPLOADED
  Y     la evidencia queda vinculada al milestone
  Y     se emite evento audit "evidence.register"
  Y     la evidencia aparece en GET /v1/projects/:projectId/evidence
```

**Casos borde:**
- `filename` vacío → `400 Bad Request`
- `contentType` vacío → `400 Bad Request`
- Actor sin `evidence:write` → `403 Forbidden`

---

### P1-B — PRO sube documento grande (video de obra, ZIP de planos)

**Criterio de aceptación:**
```
DADO   que el archivo supera 25 MB
CUANDO POST /v1/uploads/plan con { fileSizeBytes: 80_000_000, domain: "evidence", ... }
ENTONCES el plan retorna { recommendedStrategy: "external_transfer" }
  Y     incluye { recommendedChunkSizeBytes: 10MB, recommendedPartCount: 8 }
CUANDO POST /v1/uploads/multipart-session
ENTONCES retorna sessionId y array de parts con uploadUrl por parte
CUANDO PUT de cada parte completado
  Y   POST /v1/uploads/multipart-session/complete
ENTONCES { status: "completed", partsReceived: 8, totalParts: 8 }
CUANDO POST /v1/evidence { key, kind: "VIDEO", milestoneId }
ENTONCES EvidenceRecord con status UPLOADED
```

---

### P1-C — Agente IA revisa evidencia al momento del submit

**Criterio de aceptación:**
```
DADO   que existe evidencia UPLOADED vinculada al milestone
CUANDO PRO hace POST /v1/milestones/:id/submit
ENTONCES EvidenceReviewService evalúa la evidencia con Ollama (privacyCritical)
  Y     el resultado incluye: reviewStatus, confidence, riskLevel, findings, ragCitations
  Y     si confidence ≥ umbral Y disputeRisk = false → evidencia pasa a ACCEPTED
  Y     si riskLevel = "critical" O disputeRisk = true → evidencia pasa a REJECTED
  Y     el resultado queda en el registro de la evidencia
  Y     se emite SSE con el resultado de la review
```

**Casos borde:**
- LLM no disponible → fallback rule-based review activo (sin error al cliente)
- evidencia en formato no soportado → riskLevel elevado, requiredActions con instrucción

---

### P2-A — Cliente lista evidencia de su proyecto

**Criterio de aceptación:**
```
DADO   que existen evidencias registradas para el proyecto
       Y el actor tiene rol CLIENT y es dueño del proyecto
CUANDO GET /v1/projects/:projectId/evidence
ENTONCES retorna array de EvidenceRecord con kind en mayúsculas
  Y     no retorna evidencias de otros tenants
```

---

### P2-B — OPS_ADMIN consulta detalle de evidencia específica

**Criterio de aceptación:**
```
DADO   que existe una evidencia con id conocido
CUANDO GET /v1/evidence/:evidenceId con actor OPS_ADMIN
ENTONCES retorna EvidenceRecord completo con todos los campos
```

---

## 6. Contratos de API

### `POST /v1/evidence/presign`

```yaml
método: POST
ruta: /v1/evidence/presign
descripción: Genera URL de subida pre-firmada para un archivo de evidencia

auth: requerida
roles: [PRO, OPS_ADMIN]
permiso: evidence:write
privacyCritical: false

input:
  schema: presignEvidenceSchema
  campos:
    - nombre: filename
      tipo: string
      requerido: true
      validación: min(1)
    - nombre: contentType
      tipo: string
      requerido: true
      validación: min(1) — ej. "image/jpeg", "video/mp4", "application/pdf"
    - nombre: fileSizeBytes
      tipo: number
      requerido: false
      validación: int().positive().max(20GB)
    - nombre: source
      tipo: enum
      requerido: false
      valores: [local_device, camera_capture, field_ops, project_copilot, external_transfer]

output:
  campos:
    - uploadUrl: string — URL para PUT directo del archivo
    - key: string — storage key para usar en POST /v1/evidence
    - contentType: string
    - fileSizeBytes: number | undefined
    - domain: "evidence"
    - source: string
    - maxSingleUploadBytes: 26214400 (25MB)
    - recommendedStrategy: "single_put" | "external_transfer"
    - uploadGuidance: string — instrucción en español
    - multipart: null | { recommendedChunkSizeBytes, recommendedPartCount, requiresOutOfBandTransfer }

errores:
  400: filename o contentType vacíos
  403: actor sin evidence:write

efectos:
  auditLog: false — solo genera URL, no persiste nada
  sse: false
  paymentGovernance: false
```

---

### `POST /v1/uploads/plan`

```yaml
método: POST
ruta: /v1/uploads/plan
descripción: Obtiene plan de subida recomendado (single vs multipart) para cualquier dominio

auth: requerida
roles: [PRO, OPS_ADMIN]
permiso: evidence:write
privacyCritical: false

input:
  schema: uploadPlanSchema
  campos:
    - nombre: domain
      tipo: enum
      requerido: true
      valores: [evidence, contract, dispute, travel]
    - nombre: filename
      tipo: string
      requerido: true
    - nombre: contentType
      tipo: string
      requerido: true
    - nombre: fileSizeBytes
      tipo: number
      requerido: true
      validación: int().positive().max(20GB)
    - nombre: source
      tipo: enum
      requerido: false

output: (igual que presign, adaptado al domain)

errores:
  400: campos inválidos o domain fuera del enum
  403: sin evidence:write
```

---

### `POST /v1/uploads/multipart-session`

```yaml
método: POST
ruta: /v1/uploads/multipart-session
descripción: Crea sesión de subida multipart para archivos grandes

auth: requerida
roles: [PRO, OPS_ADMIN]
permiso: evidence:write
privacyCritical: false

input:
  schema: multipartUploadSessionCreateSchema
  (igual a uploadPlanSchema con source default "external_transfer")

output:
  campos:
    - sessionId: string — "mus_<timestamp>_<random>"
    - provider: string
    - createdAt: string (ISO)
    - expiresAt: string (ISO, +30min)
    - key: string
    - domain: string
    - contentType: string
    - fileSizeBytes: number
    - recommendedStrategy: string
    - parts: array
      - partNumber: number
      - startByte: number
      - endByte: number
      - uploadUrl: string
      - status: "pending"

errores:
  400: campos inválidos
  403: sin evidence:write
```

---

### `PUT /v1/uploads/multipart-session/:sessionId/parts/:partNumber`

```yaml
método: PUT
ruta: /v1/uploads/multipart-session/:sessionId/parts/:partNumber
descripción: Sube una parte de una sesión multipart

auth: requerida
roles: [PRO, OPS_ADMIN]
permiso: evidence:write
privacyCritical: false

input:
  body: binario del chunk
  headers opcionales:
    - x-part-size: number — bytes de la parte
    - content-length: number — alternativa a x-part-size

output:
  campos:
    - sessionId: string
    - partNumber: number
    - status: "uploaded"
    - bytesReceived: number
    - etag: string
    - uploadedAt: string (ISO)

errores:
  400: partNumber inválido o parte no encontrada en sesión
  403: sin evidence:write
```

---

### `POST /v1/uploads/multipart-session/complete`

```yaml
método: POST
ruta: /v1/uploads/multipart-session/complete
descripción: Finaliza sesión multipart y consolida el archivo

auth: requerida
roles: [PRO, OPS_ADMIN]
permiso: evidence:write
privacyCritical: false

input:
  schema: multipartUploadSessionCompleteSchema
  campos:
    - sessionId: string (min 1)
    - parts: array (min 1)
      - partNumber: number int positive
      - etag: string (min 1)

output:
  campos:
    - sessionId: string
    - status: "completed"
    - completedAt: string (ISO)
    - partsReceived: number
    - totalParts: number

errores:
  400: sessionId no existe, parts vacío, etags inválidos
  403: sin evidence:write
```

---

### `POST /v1/evidence`

```yaml
método: POST
ruta: /v1/evidence
descripción: Registra en base de datos la evidencia ya subida al storage

auth: requerida
roles: [PRO, OPS_ADMIN]
permiso: evidence:write
privacyCritical: false

input:
  schema: registerEvidenceSchema
  campos:
    - nombre: key
      tipo: string
      requerido: true
      validación: min(1) — storage key retornado por presign
    - nombre: kind
      tipo: enum
      requerido: true
      valores: [PHOTO, VIDEO, DOCUMENT]
    - nombre: jobId
      tipo: string
      requerido: condicional — al menos uno de jobId, milestoneId, projectId
    - nombre: milestoneId
      tipo: string
      requerido: condicional
    - nombre: projectId
      tipo: string
      requerido: condicional (legacy — preferir jobId o milestoneId)
  refine:
    - Al menos uno de jobId | milestoneId | projectId es requerido
    - projectId-only es legacy — nuevo código debe usar jobId o milestoneId

output:
  shape: EvidenceRecord
  campos:
    - id: string (cuid)
    - tenantId: string
    - projectId: string
    - jobId: string | null
    - milestoneId: string | null
    - key: string
    - kind: "PHOTO" | "VIDEO" | "DOCUMENT"
    - status: "uploaded"
    - createdAt: string (ISO)

errores:
  400: key vacío, kind inválido, ningún contexto (jobId/milestoneId/projectId) proporcionado
  403: actor sin evidence:write

efectos:
  auditLog: true — acción "evidence.register"
    afterJson: { jobId, projectId, milestoneId, kind, canonicalScope }
  evento: "evidence.uploaded"
  sse: false
  fsmTransicion: → UPLOADED
  paymentGovernance: false
  operationalContext: invalidateScope del proyecto
```

---

### `GET /v1/jobs/:jobId/evidence`

```yaml
método: GET
ruta: /v1/jobs/:jobId/evidence
descripción: Lista toda la evidencia vinculada a un job

auth: requerida
roles: [CLIENT, PRO, OPS_ADMIN]
permiso: evidence:read
privacyCritical: false

input: jobId en path

output: array de EvidenceRecord (kind en mayúsculas vía toVisibleEvidence)

errores:
  403: actor sin acceso al job
  404: jobId no existe en el tenant

efectos: auditLog: false
```

---

### `GET /v1/projects/:projectId/evidence`

```yaml
método: GET
ruta: /v1/projects/:projectId/evidence
descripción: Lista toda la evidencia vinculada a un proyecto

auth: requerida
roles: [CLIENT, PRO, OPS_ADMIN]
permiso: evidence:read
privacyCritical: false

input: projectId en path
output: array de EvidenceRecord
errores:
  403: sin acceso al proyecto
  404: proyecto no existe
efectos: auditLog: false
```

---

### `GET /v1/evidence/:evidenceId`

```yaml
método: GET
ruta: /v1/evidence/:evidenceId
descripción: Detalle de una evidencia por id

auth: requerida
roles: [CLIENT, PRO, OPS_ADMIN]
permiso: evidence:read
privacyCritical: false

input: evidenceId en path
output: EvidenceRecord (único)
errores:
  403: sin acceso
  404: evidenceId no existe en el tenant
efectos: auditLog: false
```

---

## 7. Contrato del Agente de Revisión (EvidenceReviewService)

> Este servicio corre internamente al llamar `milestone.submit`. No es un endpoint público.

```yaml
disparador: POST /v1/milestones/:id/submit
actor: PLATFORM (automático)
privacyCritical: true → LLM routing a Ollama local

input:
  - evidenceItemId: string
  - milestoneId: string
  - label: string (title del milestone)
  - kind: "PHOTO" | "VIDEO" | "DOCUMENT"
  - statusBefore: string

output (EvidenceReviewResult):
  - reviewStatus: approved_suggestion | needs_reupload | missing_context |
                  possible_mismatch | rejected_suggestion | manual_review_required
  - confidence: number (0–1)
  - riskLevel: low | medium | high | critical
  - findings: string[]
  - requiredActions: string[]
  - recommendedAction: string
  - disputeRisk: boolean
  - ragSources: string[]
  - ragCitations: [{ documentId, documentTitle, excerpt, score }]
  - ragUsed: boolean
  - fallbackUsed: boolean — true si LLM no disponible y usó rules-based

efectos:
  sse: true — emite resultado al canal del proyecto
  auditReason: string almacenado en registro
  paymentGovernance: false (solo evalúa, no mueve dinero)
```

**Fallback rule-based** (cuando Ollama no disponible):
- `status=approved` → `approved_suggestion, confidence=0.7`
- `status=rejected` → `rejected_suggestion, confidence=0.85`
- Default → `manual_review_required, confidence=0.3, riskLevel=medium`

---

## 8. Criterios de Éxito

| Métrica | Valor objetivo |
|---------|---------------|
| Latencia P95 presign | < 200ms |
| Latencia P95 register | < 300ms |
| Latencia P95 evidence review (con Ollama) | < 5s |
| Latencia P95 evidence review (fallback) | < 100ms |
| Tasa de error 5xx en flujo principal | < 0.1% |
| Cobertura de tests | ≥ 80% branches |
| Audit log presente en register | 100% |
| Fallback activo cuando Ollama no responde | 100% |

---

## 9. Tests Requeridos

```typescript
describe("POST /v1/evidence/presign") {
  it("genera uploadUrl y key para imagen válida")
  it("recomienda single_put para archivo < 25MB")
  it("recomienda external_transfer para archivo > 25MB")
  it("rechaza con 400 si filename está vacío")
  it("rechaza con 400 si contentType está vacío")
  it("rechaza con 403 si actor no tiene evidence:write")
}

describe("POST /v1/evidence (register)") {
  it("registra evidencia PHOTO con milestoneId — status UPLOADED")
  it("registra evidencia VIDEO con jobId — status UPLOADED")
  it("rechaza con 400 si kind no es PHOTO|VIDEO|DOCUMENT")
  it("rechaza con 400 si key está vacío")
  it("rechaza con 400 si no hay jobId ni milestoneId ni projectId")
  it("emite evento audit 'evidence.register' con canonicalScope correcto")
  it("rechaza con 403 si actor no tiene evidence:write")
}

describe("POST /v1/uploads/multipart-session") {
  it("crea sesión con partes calculadas para 80MB")
  it("retorna sessionId, expiresAt, array de parts con uploadUrl por parte")
  it("rechaza con 400 si fileSizeBytes falta")
}

describe("PUT /v1/uploads/multipart-session/:id/parts/:n") {
  it("marca parte como uploaded con etag")
  it("rechaza con 400 si partNumber no existe en sesión")
}

describe("POST /v1/uploads/multipart-session/complete") {
  it("completa sesión con partsReceived correcto")
  it("rechaza con 400 si parts array está vacío")
}

describe("GET /v1/jobs/:jobId/evidence") {
  it("retorna array de evidencias del job para CLIENT dueño")
  it("retorna array para PRO asignado al job")
  it("no retorna evidencias de otros tenants")
  it("retorna kind en mayúsculas (PHOTO, VIDEO, DOCUMENT)")
  it("rechaza con 403 si actor no tiene evidence:read")
}

describe("EvidenceReviewService (unit)") {
  it("retorna approved_suggestion cuando LLM retorna confidence >= 0.5 y disputeRisk=false")
  it("retorna rejected_suggestion cuando riskLevel=critical")
  it("usa fallback rule-based cuando LLM lanza excepción")
  it("incluye ragCitations cuando RAG retorna resultados")
  it("marca privacyMode como privacyCritical en todos los casos")
}
```

---

## 10. Impacto en otros dominios

| Dominio | Impacto | Detalle |
|---------|---------|---------|
| Milestones | ✅ Prerequisito | milestone.submit requiere evidencia UPLOADED en el milestone |
| Escrow/Payments | ⚠️ Indirecto | Evidencia ACCEPTED es condición para approve → escrow release |
| Prometeo RAG | ✅ Directo | EvidenceReviewService usa RAG para evaluar evidencia contra trade docs |
| SSE/Real-time | ✅ Directo | review result se emite por SSE al canal del proyecto |
| BuildOps | ✅ Directo | BuildOpsIntelligenceAgent puede recibir señal de evidence.uploaded |
| Disputes | ✅ Directo | Evidencia con disputeRisk=true puede disparar disputa |
| WhatsApp/Comms | 🟡 Futuro | Notificación al PRO cuando evidencia es rechazada |
| Consciousness | 🟡 Indirecto | Observer registra eventos de evidencia como señales del ecosistema |

---

## 11. Gaps identificados

| Gap | Tipo | Severidad |
|-----|------|-----------|
| No hay endpoint de eliminación/reemplazo de evidencia — el PRO solo puede subir nueva | Feature faltante | 🟡 Media |
| `storageUrl` está en el schema de marketplace pero no se retorna actualmente en el output del controller | Contrato | 🟡 Media |
| El status de evidencia (`UPLOADED`, `UNDER_REVIEW`, etc.) no se expone explícitamente en el GET list — solo en la review | Contrato | 🟡 Media |
| Multipart session expira en 30min — no hay endpoint de renovación de sesión | Operacional | 🟢 Baja |
| `projectId-only` en registerEvidenceSchema es legacy pero sigue funcionando — deprecar con aviso | Deuda técnica | 🟢 Baja |
| EvidenceReviewService no tiene test de integración — solo unit testing de la lógica interna | Testing | 🟡 Media |

---

## 12. Supuestos y Dependencias

- [ ] El storage físico (filesystem en `/tmp/semse-multipart-sessions` o S3-compatible) está disponible antes de `presign`
- [ ] `SEMSE_API_BASE_URL` está configurado en Railway — se usa para construir uploadUrl y multipart part URLs
- [ ] `SEMSE_MULTIPART_STORAGE_ROOT` puede ser configurado para cambiar el directorio de sesiones multipart
- [ ] El archivo se sube al `uploadUrl` directamente desde el cliente — la API no actúa como proxy de subida
- [ ] `EvidenceReviewService` es `@Optional()` — el flujo de milestone.submit no falla si el agente no está disponible
- [ ] Ollama debe estar disponible en Railway para el modo `privacyCritical=true`; si no, el fallback rule-based activa

---

## Checklist de aprobación

- [x] Todos los escenarios P1 tienen criterio de aceptación Given/When/Then
- [x] Todos los endpoints (9) tienen contrato completo con input/output/errores/efectos
- [x] FSM declarada con estados, transiciones, guards y mapeo a código
- [x] Flujo de subida documentado: single PUT y multipart
- [x] Agente IA (EvidenceReviewService) con contrato completo incluyendo fallback
- [x] privacyCritical documentado: Ollama para review, no cloud LLM
- [x] Tests requeridos listados (6 describes, 25+ casos)
- [x] Gaps identificados y documentados (6 gaps)
- [x] Ninguna invariante de `DOMAIN_INVARIANTS.md` violada
- [x] Status: `APPROVED`
