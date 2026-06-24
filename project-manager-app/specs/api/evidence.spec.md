# SPEC: Evidence API
**Versión:** 1.0
**Dominio:** Evidence
**Estado:** APPROVED
**Depende de:** milestones.spec.md
**Implementado en:** apps/api/src/modules/evidence/evidence.controller.ts
**Tests:** apps/api/tests/ (MISSING — crear)

## Qué resuelve
La evidencia es infraestructura, no un adjunto. Es la llave de paso que desbloquea la aprobación de un milestone. Incluye fotos, videos, documentos y metadata verificable (timestamp, GPS, checksum). Sin evidencia válida no hay aprobación, sin aprobación no hay pago.

## Actores
- **Pro:** sube evidencia vinculada a un milestone
- **Client:** revisa evidencia antes de aprobar
- **Evidence Agent:** valida metadata, GPS, timestamp, checksum automáticamente
- **Admin:** puede marcar evidencia como inválida en disputas

## Tipos de evidencia
```
PHOTO     — imagen (jpg, png, webp), max 20MB
VIDEO     — video (mp4, mov), max 200MB
DOCUMENT  — PDF, max 50MB
NOTE      — texto libre, max 2000 chars
```

---

## Contratos de API

### POST /v1/milestones/:milestoneId/evidence
Subir evidencia para un milestone.

**Input (multipart/form-data):**
```ts
{
  file: File                        // según tipo permitido
  type: "PHOTO" | "VIDEO" | "DOCUMENT" | "NOTE"
  note?: string                     // max 500 chars
  location?: {
    lat: number
    lng: number
    accuracy?: number
  }
  takenAt?: string                  // ISO datetime (cuándo se capturó)
}
```
**Output:**
```ts
{
  id: string
  milestoneId: string
  type: EvidenceType
  url: string                       // presigned S3 URL
  thumbnailUrl?: string
  metadata: {
    fileSize: number
    mimeType: string
    checksum: string                // SHA-256
    location?: { lat, lng }
    takenAt?: string
    uploadedAt: string
  }
  status: "PENDING_VALIDATION"
}
```
**Errores:** `400` tipo no permitido · `413` archivo demasiado grande · `403` no es pro del milestone · `409` milestone no está IN_PROGRESS
**Guards:** rol = pro · milestone.job.assignedProId = user.id · milestone.status = IN_PROGRESS
**Efectos:** AuditLog: `EVIDENCE_UPLOADED` · S3 upload · Evidence Agent valida async · checksum calculado en server

---

### GET /v1/milestones/:milestoneId/evidence
Listar evidencia de un milestone.

**Output:**
```ts
{
  items: [{
    id, type, url, thumbnailUrl,
    metadata, status, validationResult,
    uploadedBy: { id, name },
    createdAt
  }]
}
```
**Errores:** `403` no es miembro del job · `404` milestone no existe
**Guards:** autenticado · miembro del job O admin

---

### GET /v1/evidence/:id
Ver detalle de una evidencia.

**Output:** evidencia completa con metadata, historial de validación y URL fresca (presigned)
**Errores:** `403` cross-tenant · `404` no existe
**Guards:** autenticado · miembro del job O admin

---

### DELETE /v1/evidence/:id
Eliminar evidencia (solo si el milestone aún está IN_PROGRESS y no fue submitted).

**Output:** `{ success: true }`
**Errores:** `403` no es quien subió · `409` milestone está PENDING_REVIEW o APPROVED
**Guards:** rol = pro · evidence.uploadedBy = user.id · milestone.status = IN_PROGRESS
**Efectos:** AuditLog: `EVIDENCE_DELETED` · S3 soft-delete

---

### POST /v1/evidence/:id/validate (interno / agent)
Resultado de validación del Evidence Agent.

**Input:**
```ts
{
  agentRunId: string
  result: "VALID" | "INVALID" | "REQUIRES_REVIEW"
  issues?: string[]
  score?: number                    // 0-100
}
```
**Output:** `{ id, status: "VALIDATED" | "INVALID" }`
**Errores:** `403` solo llamable por agent token · `404` evidencia no existe
**Guards:** agentToken válido (no user JWT)
**Efectos:** AuditLog: `EVIDENCE_VALIDATED` · Si INVALID → notificación al pro · SSE: `evidence.validated`

---

### GET /v1/evidence/:id/download
Obtener URL de descarga fresca (presigned S3, expira en 15min).

**Output:** `{ url: string, expiresAt: string }`
**Errores:** `403` no miembro del job · `404`
**Guards:** autenticado · miembro del job O admin

---

## Validación automática del Evidence Agent

El agent verifica al recibir el archivo:
```
PHOTO:
  - Resolución mínima 800x600
  - No es screenshot (metadata EXIF)
  - Timestamp dentro de los últimos 7 días
  - GPS presente si se exige para la categoría
  - No duplicado (checksum comparado vs evidencias del job)

DOCUMENT:
  - PDF válido, no corrupto
  - No contraseña protegido
  - Tamaño > 1KB (no vacío)

VIDEO:
  - Duración mínima 5 segundos
  - No rotación excesiva
  - Audio presente (opcional según categoría)

GENERAL:
  - Checksum SHA-256 único (no duplicado)
  - Metadata de subida registrada
```

---

## Tests requeridos

### POST /evidence
- [ ] Pro sube foto válida → 201 con status PENDING_VALIDATION
- [ ] Client intenta subir → 403
- [ ] Archivo demasiado grande → 413
- [ ] Milestone no IN_PROGRESS → 409
- [ ] Checksum calculado y guardado
- [ ] S3 upload llamado
- [ ] Evidence Agent notificado async

### GET /evidence (list)
- [ ] Pro ve su propia evidencia
- [ ] Client ve evidencia del milestone de su job
- [ ] Pro de otro job no puede ver → 403
- [ ] Cross-tenant → 403

### DELETE /evidence/:id
- [ ] Pro elimina evidencia en IN_PROGRESS → 200
- [ ] Milestone PENDING_REVIEW → 409
- [ ] Otro pro intenta eliminar → 403

### POST /evidence/:id/validate (agent)
- [ ] Agent token válido → actualiza status
- [ ] User JWT intenta llamar → 403
- [ ] INVALID → notificación al pro
- [ ] SSE emitido

### Integridad
- [ ] Evidencia duplicada (mismo checksum en el job) → rechazada
- [ ] Evidencia vinculada a milestone correcto en AuditLog
