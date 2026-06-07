# Evidence CRUD Avanzado — Fase 1

**Fecha:** 2026-05-17  
**Estado:** ✅ Fase 1 cerrada  
**Tests:** 78/78 · API build OK · Web TypeScript 0 errores

---

## Frase guía

> SEMSE no debe tratar la evidencia como archivos sueltos; debe tratarla como prueba operacional versionada y auditable.

---

## Alcance implementado (Fase 1)

```
✅ GET /v1/milestones/:id/evidence-items/:itemId         — detalle con Evidence + reviewer + uploader
✅ GET /v1/milestones/:id/evidence-items/:itemId/history — historial desde AuditLog existente
✅ POST /v1/milestones/:id/evidence-items/:itemId/replace — reemplazo con trazabilidad
✅ BFF routes equivalentes
✅ EvidenceItemDetailPanel component
✅ SSE evidence-item:replaced + evidence-item:updated
✅ Historial en AuditLog (sin migración)
✅ Integrado en MilestoneEvidenceUploader (botón "Ver detalle")
```

---

## Modelo de trazabilidad — sin migración

**Decisión:** Reutilizar `AuditLog` existente.

```
model AuditLog {
  entityType: "MilestoneEvidenceItem"
  entityId:   <itemId>
  action:     "evidence_replaced"
  beforeJson: { status, evidenceId }
  afterJson:  { status: "submitted", evidenceId: new, replacedReason }
  actorUserId
  occurredAt
}
```

No se creó nueva tabla. Historia disponible sin migración.

---

## Endpoints API

| Endpoint | Permiso | Qué hace |
|----------|---------|---------|
| `GET /v1/milestones/:id/evidence-items/:itemId` | `milestones:read` | Detalle completo: item + Evidence (bucketKey, kind, validationStatus) + uploader + reviewer |
| `GET /v1/milestones/:id/evidence-items/:itemId/history` | `milestones:read` | Historial desde AuditLog (max 20 entradas) |
| `POST /v1/milestones/:id/evidence-items/:itemId/replace` | `milestones:write` | Vincula nuevo Evidence + reset status=submitted + AuditLog + SSE |

### Reglas del replace

- `evidenceId` y `replacedReason` son obligatorios
- Status vuelve a `"submitted"` (no aprobado automáticamente)
- `reviewNote`, `reviewedById`, `reviewedAt` se limpian (nueva revisión requerida)
- `AuditLog` registra `action: "evidence_replaced"` con before/after JSON
- SSE: `evidence-item:replaced` + `evidence-item:updated`
- Re-evaluación de milestone intelligence (fire-and-forget)

---

## BFF Routes

| BFF Route | Método | Backend |
|-----------|--------|---------|
| `/api/semse/milestones/[id]/evidence-items/[itemId]` | GET + PATCH | `/v1/milestones/:id/evidence-items/:itemId` |
| `/api/semse/milestones/[id]/evidence-items/[itemId]/history` | GET | `/v1/milestones/:id/evidence-items/:itemId/history` |
| `/api/semse/milestones/[id]/evidence-items/[itemId]/replace` | POST | `/v1/milestones/:id/evidence-items/:itemId/replace` |

---

## Componente `EvidenceItemDetailPanel`

**Ubicación:** `components/milestones/EvidenceItemDetailPanel.tsx`

**Muestra:**
- Badge de status con color semántico
- Preview de imagen (si es PHOTO y tiene bucketKey → `/api/semse/uploads/files/:key`)
- Link "Ver archivo" para documentos/videos
- Metadata: uploadedBy, uploadedAt, aiQualityScore
- Revisión IA (desde reviewNote.__agentReview)
- Revisión ops (desde reviewNote.adminReview)
- Formulario de reemplazo (solo para rejected/needs_reupload): reason + file picker
- Historial expandible (desde AuditLog)

**Integración:** Se abre desde `MilestoneEvidenceUploader` con "Ver detalle / historial"

---

## SSE emitidos en replace

```
channel: buildops:${tenantId}
events:
  - evidence-item:replaced  { milestoneId, itemId, status, previousStatus, replaced }
  - evidence-item:updated   { milestoneId, itemId, status, updatedAt }
```

Páginas que reaccionan:
- `/client/milestones` → `refreshGovernance(milestoneId)`
- `/buildops/milestones` → `refreshGov(milestoneId)`

---

## Estados visuales

| Status | Badge | Acción disponible |
|--------|-------|------------------|
| `missing` | Faltante | Subir (MilestoneEvidenceUploader) |
| `submitted` | En revisión | Ver detalle |
| `approved` | Aprobada | Ver detalle |
| `rejected` | Rechazada | Ver detalle + Reemplazar |
| `needs_reupload` | Requiere nueva carga | Ver detalle + Reemplazar |
| `archived` | Archivada | Ver historial |

---

## Reglas de seguridad

- `milestones:write` requerido para replace
- `milestones:read` requerido para detail/history
- `milestones:approve` requerido para approve/reject (PATCH status)
- Tenant/project ownership verificado via `milestone.project.tenantId`
- `replacedReason` obligatorio para replace
- Status aprobado no se regenera automáticamente tras replace

---

## Validaciones

```
API TypeScript      : 0 errores ✅
API nest build      : OK ✅
Web TypeScript      : 0 errores ✅
78/78 tests         : passing ✅
AuditLog sin migración : ✅
SSE evidence-item:replaced : ✅
governance refresh tras replace : ✅
replace evidencia rejected → submitted : ✅
replace no auto-aprueba : ✅
```

---

## Limitaciones pendientes (Fase 2)

1. **Archive/delete lógico** — `POST /v1/.../archive` con archiveReason no implementado
2. **Preview de PDF** — solo imagen y link, no visor embebido
3. **Multifile/reemplazo por lotes** — solo 1 archivo por vez
4. **Integración en EvidenceReviewAdminCard** — el panel de admin no tiene botón "Ver detalle" todavía
5. **Filter/search en history** — historial sin paginación o filtros
6. **RAG sobre evidencia** — no implementado (Fase 3)

---

## Fase 2 recomendada

```
- POST /v1/.../archive con archiveReason obligatorio
- Integrar EvidenceItemDetailPanel en EvidenceReviewAdminCard (ops view)
- Thumbnail pequeño en listas de evidence items
- Paginación en history
- Comparación visual entre versiones
```
