# Evidence Upload UI

**Fecha:** 2026-05-17  
**Estado:** ✅ Implementado

---

## Objetivo

Cuando el `MilestoneGovernancePanel` dice "falta evidencia", el usuario debe poder resolver el bloqueo desde la misma pantalla.

---

## Flujo de upload implementado

```
Usuario selecciona archivo
    ↓
POST /api/semse/evidence/presign → uploadUrl + key
    ↓
PUT file → storage via /api/semse/uploads/files/:key
    ↓
POST /api/semse/evidence { key, kind, milestoneId } → evidenceId
    ↓
PATCH /api/semse/milestones/[id]/evidence-items/[itemId]
  { status: "submitted", evidenceId }
    ↓
POST /api/semse/milestones/[id]/evidence-items/[itemId]/review (opcional)
  → Evidence Review Agent (privacyCritical/localOnly)
    ↓
onUploaded() → refreshGovernance() → MilestoneGovernancePanel re-fetch
```

---

## Componentes

### `MilestoneEvidenceUploader`
**Archivo:** `components/milestones/MilestoneEvidenceUploader.tsx`

**Props:**
- `milestoneId: string`
- `onUploaded?: () => void` — callback para refrescar governance
- `showAll?: boolean` — mostrar items aprobados también (default: false = solo pendientes)
- `maxItems?: number` — límite de items mostrados

**Estados por item:**
- `missing` → botón "Subir" disponible
- `rejected` → botón "Subir" disponible + review note del agente visible
- `submitted` → badge "En revisión" (sin upload)
- `approved` → badge verde "Aprobada" (oculto por defecto)

**Upload states UI:**
```
idle → presigning → uploading → registering → linking → reviewing → done | error
```

**Después del upload:**
- Muestra "Subido correctamente"
- Si el review agent responde: muestra `reviewFindings` (approved_suggestion/needs_reupload/etc.)
- Llama `onUploaded()` → parent refresca governance

---

## BFF Routes añadidas

| Ruta | Método | Backend |
|------|--------|---------|
| `/api/semse/evidence` | POST | `POST /v1/evidence` (registrar archivo subido) |

---

## Integración en páginas

### `/client/milestones`
```
MilestoneTrackerCard (existente)
    ↓
MilestoneEvidenceUploader (nuevo)
  visible para: DRAFT, SUBMITTED, AWAITING_REVIEW
  onUploaded → refreshGovernance(milestoneId)
    ↓
MilestoneGovernancePanel (key={`gov-${id}-${refreshKey}`})
  re-fetch automático cuando governance key cambia
```

---

## Reglas UX

1. **El uploader se muestra antes del governance panel** — el usuario ve primero qué falta y puede resolverlo.
2. **Governance panel usa `key` prop** — cuando `onUploaded` es llamado, el `key` cambia y React re-monta el panel → re-fetch automático.
3. **Review agent se corre silenciosamente** — si falla, el upload igualmente fue exitoso.
4. **No libera pagos** — el uploader solo sube evidencia y muestra el finding del agente. La governance decide si el pago puede avanzar.
5. **Accepted file types** — `image/*` para PHOTO, `video/*` para VIDEO, `*/*` para DOCUMENT.
6. **Input ref limpiado** — `e.target.value = ""` después de selección para permitir re-upload del mismo archivo.

---

## Roles

| Acción | Rol |
|--------|-----|
| Ver evidencia items | cliente, profesional, ops |
| Subir evidencia | cliente, profesional (donde corresponda) |
| Ver review findings | cliente, ops |
| Aprobar/rechazar item | ops/admin (via PATCH con status=approved/rejected) |

---

## Limitaciones pendientes

1. **Sin drag & drop** — el upload es solo via file picker (drag & drop existe en `/worker/evidence` como referencia).
2. **Sin vista previa de imagen** — después de subir no se muestra thumbnail.
3. **Sin progress bar** — el estado "Subiendo..." no muestra % de progreso.
4. **Sin retry individual** — si el upload falla, el usuario puede reintentar manualmente.
5. **Sin upload múltiple** — un archivo por item a la vez.
6. **No integrado en `/buildops/milestones`** — admin/ops puede ver el uploader pero la lógica de quién puede subir vs revisar es diferente.

---

## Próximos pasos

1. Integrar drag & drop (patrón existente en `/worker/evidence/page.tsx`)
2. Thumbnail preview para imágenes
3. Admin panel para aprobar/rechazar evidence items desde `/buildops/milestones`
4. Notificación SSE cuando evidencia cambia de estado
