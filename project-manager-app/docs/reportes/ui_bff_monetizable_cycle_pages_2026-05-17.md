# UI/BFF Ciclo Monetizable — Integración en Páginas Reales

**Fecha:** 2026-05-17  
**Estado:** ✅ Cerrado  
**Builds:** API OK · Web OK · TypeScript 0 errores · 61/61 tests

---

## Páginas integradas

### 1. `/client/milestones` — Vista del cliente

**Componente añadido:** `MilestoneGovernancePanel` debajo de `MilestoneTrackerCard`

**Condición de display:** Solo para milestones en `SUBMITTED`, `AWAITING_REVIEW`, `APPROVED`

**Lo que el cliente ve:**
- Badge `releaseStatus`: LISTO PARA LIBERAR / BLOQUEADO / REQUIERE REVISIÓN / EN DISPUTA
- Lista de blockers con iconos XCircle
- Contador de evidencias: aprobadas / faltantes / rechazadas
- Contador de change orders pendientes
- Contador de señales críticas
- `nextBestAction`: acción concreta en texto legible
- `auditReason`: razón auditable al pie

### 2. `/buildops/milestones` — Vista admin/ops

**Componente añadido:** `MilestoneGovernancePanel` debajo de cada `Card`

**Condición de display:** Solo para milestones en `submitted`, `awaiting_review`, `approved`

**Lo que admin/ops ve:**
- Mismo panel de gobernanza con perspectiva operativa
- Badge de riesgo con color semántico
- Refresh integrado

### 3. `/buildops/projects/[id]` — Detalle del proyecto BuildOps

**Componente añadido:** `BuildOpsProjectHealthPanel` al tope del detalle

**Condición de display:** Siempre que el proyecto esté cargado (no loading)

**Lo que admin/ops ve:**
- Señales críticas (contador + color rojo si > 0)
- Señales abiertas totales
- Change order candidates pendientes
- Completion %
- riskLevel
- Confianza del algoritmo (si existe)
- `nextBestAction` en texto claro
- Refresh manual

---

## Componentes creados

| Componente | Archivo | Endpoint consumido |
|-----------|---------|-------------------|
| `MilestoneGovernancePanel` | `components/milestones/MilestoneGovernancePanel.tsx` | `GET /api/semse/milestones/[id]/payment-governance` |
| `ChangeOrderImpactCard` | `components/change-orders/ChangeOrderImpactCard.tsx` | `GET /api/semse/change-orders/[id]/impact` |
| `BuildOpsProjectHealthPanel` | `components/buildops/BuildOpsProjectHealthPanel.tsx` | `GET /api/semse/buildops/projects/[id]/health` |

---

## BFF Routes creadas

| Ruta | Método | Backend |
|------|--------|---------|
| `/api/semse/milestones/[id]/payment-governance` | GET | `GET /v1/milestones/:id/payment-governance` |
| `/api/semse/milestones/[id]/evidence-items/[id]/review` | GET + POST | `GET/POST /v1/milestones/:id/evidence-items/:id/run-review-agent` |
| `/api/semse/change-orders/[id]/impact` | GET | `GET /v1/change-orders/:id/impact` |
| `/api/semse/change-orders/[id]/apply-to-buildops` | POST | `POST /v1/change-orders/:id/apply-to-buildops` |
| `/api/semse/change-orders/[id]/request-changes` | POST | `POST /v1/change-orders/:id/request-changes` |
| `/api/semse/buildops/projects/[id]/health` | GET | `GET /v1/buildops/projects/:id/health` |

---

## Estados visuales implementados

### MilestoneGovernancePanel

| releaseStatus | Badge | Color | Descripción |
|--------------|-------|-------|-------------|
| `ready` | "Listo para liberar" | Verde | Todos los checks OK |
| `blocked` | "Bloqueado" | Rojo | Evidencia/aprobación faltante |
| `needs_review` | "Requiere revisión" | Amarillo | Change orders o señales pendientes |
| `released` | "Liberado" | Índigo | Pago ya realizado |
| `disputed` | "En disputa" | Rojo crítico | Disputa activa |

**Loading:** "Evaluando gobernanza de pago..."  
**Error:** Mensaje rojo con el error del servidor  
**Sin datos:** Fallback al error state

### BuildOpsProjectHealthPanel

| Estado | Visual |
|--------|--------|
| 0 señales críticas | Contador verde con CheckCircle |
| N señales críticas | Contador rojo con AlertTriangle |
| 0 change orders | Contador muted |
| N change orders | Contador amarillo |
| riskLevel=low | Border verde |
| riskLevel=high/critical | Border rojo/rosa |

---

## Reglas UX

1. **canRelease=false no expone acción de pago** — El `MilestoneGovernancePanel` es puramente informativo. El botón "Release payment" no existe en los componentes nuevos. El release real (`POST /escrow/release`) tiene guards backend independientes.

2. **nextBestAction siempre visible** — Aparece resaltado en azul/indigo en ambos paneles. Texto en español, en lenguaje de negocio, no técnico.

3. **Condición de display inteligente** — Los paneles solo aparecen cuando hay implicaciones de pago (milestones en estados activos). No contamina milestones en DRAFT o PAID.

4. **Lazy loading correcto** — Cada panel hace su propio fetch al montarse. No bloquea la carga inicial de la página.

5. **Refresh manual** — Botón de actualización en ambos paneles para casos donde el estado cambió externamente.

---

## Roles y permisos

| Panel | Visible para | Puede accionar |
|-------|-------------|----------------|
| `MilestoneGovernancePanel` | cliente, ops | Solo lectura + refresh |
| `BuildOpsProjectHealthPanel` | admin, ops | Solo lectura + refresh |
| `ChangeOrderImpactCard` | cliente, admin | Apply (solo admin con change-orders:approve) |

**Nota:** El botón "Aplicar a BuildOps" en `ChangeOrderImpactCard` llama a `POST /apply-to-buildops` que requiere `change-orders:approve` en el backend. El frontend tiene `canApply` como prop controlable por el parent.

---

## Sin datos mock en componentes nuevos

Todos los componentes consumen endpoints reales:
- `MilestoneGovernancePanel` → `/api/semse/milestones/[id]/payment-governance`
- `BuildOpsProjectHealthPanel` → `/api/semse/buildops/projects/[id]/health`
- `ChangeOrderImpactCard` → `/api/semse/change-orders/[id]/impact`

No hay datos hardcodeados, fallbacks ficticios ni mocks en producción.

---

## Validaciones ejecutadas

```
API typecheck:    0 errores ✅
API build:        nest build OK ✅
Web typecheck:    0 errores ✅
Web build:        next build OK ✅ (exit code 0)
Tests:            61/61 passing ✅
Sin mock data:    verificado ✅
canRelease UX:    sin botón de pago habilitado ✅
```

---

## Limitaciones pendientes

1. **Evidence CRUD HTTP + UI:** El panel puede decir "falta evidencia" pero el usuario no puede subir desde la misma pantalla. Requiere conectar `POST /v1/evidence` + flujo de upload.

2. **ChangeOrderImpactCard sin `canApply` inteligente:** Actualmente el parent pasa `canApply` manualmente. Debería derivarse del rol del usuario y del status del change order automáticamente.

3. **Sin notificaciones en tiempo real:** Los paneles usan polling manual (botón refresh). SSE podría actualizar automáticamente cuando cambia el estado.

4. **Sin i18n en componentes nuevos:** Los textos están en español hardcodeado. Falta conectar al sistema de traducciones existente (`useLanguage`/`t()`).

5. **BuildOps Project detail sin milestones:** La página `/buildops/projects/[id]` muestra el health del proyecto pero no lista los milestones con sus governance panels. Habría que agregar una sección de milestones.

---

## Próximos pasos recomendados

### Prioridad 1 — Evidence CRUD + Upload UI
```
POST /v1/evidence/items/:id/submit
GET  /v1/evidence/items/:id/review (ya existe BFF)
UI:  subir foto/documento desde milestone card cuando hay reupload requerido
```

### Prioridad 2 — SSE en governance panels
```
Cuando la governance cambia (CO applied, evidence approved), actualizar automáticamente
Sin necesidad de refresh manual
```

### Prioridad 3 — i18n en componentes nuevos
```
MilestoneGovernancePanel → t("governance.*")
BuildOpsProjectHealthPanel → t("health.*")
ChangeOrderImpactCard → t("changeOrder.*")
```

### Prioridad 4 — Change order inline creation
```
Cuando Evidence Review detecta scope extra → sugerir crear CO desde la misma UI
```
