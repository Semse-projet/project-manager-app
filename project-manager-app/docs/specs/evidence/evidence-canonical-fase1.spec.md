---
id: "evidence.canonical-fase1"
title: "Evidence canónica — Fase 1 (tenantId, entityType/entityId, farmId)"
type: spec
feature: "evidence-canonical-fase1"
domain: "evidence"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "high"
branch: "devin/documentos-evidencias"
date: "2026-07-17"
author: "Devin"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/evidence/evidence.repository.ts
  - apps/api/src/modules/evidence/evidence.service.ts
  - apps/api/src/modules/evidence/evidence.controller.ts
  - apps/api/src/modules/evidence-gateway/evidence-gateway.controller.ts
  - apps/api/src/modules/evidence-gateway/evidence-gateway.service.ts
  - apps/api/src/modules/evidence-gateway/evidence-gateway.repository.ts
  - apps/api/src/modules/buildops/buildops-legacy-promotion.service.ts
  - apps/api/src/modules/browser-agent/browser-agent.service.ts
  - packages/db/prisma/schema.prisma
  - packages/db/prisma/migrations/20260721000000_evidence_canonical_fase1
  - packages/db/prisma/seed.ts
related_tests:
  - apps/api/test/evidence-gateway.controller.test.ts
  - apps/api/test/buildops-legacy-promotion.service.test.ts
  - apps/api/test/buildops-legacy-promotion-integration.test.ts
related_endpoints:
  - v1/evidence
  - v1/evidence/upload
  - v1/buildops/plans/:buildOpsProjectId/promote-legacy
related_events:
  - evidence.uploaded.v1
related_agents: []
last_verified: "2026-07-19"
---

# Spec: Evidence canónica — Fase 1

Extiende `Evidence` para que sea la entidad única de evidencia operativa y pueda, en Fase 2, absorber `AgroEvidenceItem`.

---

## 1. Qué resuelve

**Para quién:** plataforma, contratistas, supervisores de campo, módulo agro, agentes de visión/QA.

**Problema:** `AgroEvidenceItem` duplica la semántica de `Evidence` (foto, video, documento, nota, URL, geolocalización) sin integrarse con el pipeline de QA/visión ni con `tenantId`.

**Solución (Fase 1):**

- Añadir `tenantId`, `entityType`/`entityId`, `farmId`, `mediaType`, `title`, `notes`, `fileUrl` y `capturedById` a `Evidence`.
- Establecer `Tenant` y `AgroFarm` como relaciones canónicas.
- Rellenar `tenantId` de filas existentes a partir de `Project.tenantId`.
- Actualizar todos los creadores de `Evidence` para que incluyan `tenantId`.
- Dejar `projectId` requerido por ahora; `AgroEvidenceItem` se migra en Fase 2 (requiere `tenantId` en `AgroFarm`).

---

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| PRO / CLIENT / FIELD_OPS | * | subir evidencia a project/milestone | subir evidencia a project de otro tenant |
| OPS_ADMIN / PLATFORM | `PLATFORM` | leer/auditar evidencia cross-tenant vía Mission Control | borrar evidencia sin trazabilidad |
| Agro operator | `AGRO` | subir evidencia a granja/animales (Fase 2) | ver evidencia de otra granja |

---

## 3. Escenarios de Usuario (P1)

### P1 — Crear evidencia sigue funcionando y ahora escribe tenantId

**Journey:** un contratista sube una foto a un milestone desde `/v1/evidence` o `/v1/evidence-gateway/upload`.

**Criterio de aceptación:**
```
DADO   un actor autenticado con tenantId válido
CUANDO se registra una nueva Evidence
ENTONCES la fila incluye tenantId, projectId, uploadedById, kind y bucketKey
  Y    los endpoints de lectura existentes siguen devolviendo el mismo shape
```

### P2 — Evidencia agro futura se almacenará en Evidence

**Criterio de aceptación:**
```
DADO   que Evidence ya soporta entityType/entityId, farmId y mediaType
CUANDO en Fase 2 se añada tenantId a AgroFarm y se migren los datos
ENTONCES AgroEvidenceItem se podrá deprecar
  Y    toda evidencia operativa residirá en Evidence con tenantId
```

**Errores esperados:**
- `400` si falta `tenantId`, `projectId` o `bucketKey`.
- `403` si el actor no pertenece al tenant del project.
- `404` si el project/milestone no existe.

---

## 4. FSM — Máquina de Estados

No aplica. Estados de `validationStatus` (`pending` | `passed` | `failed` | `manual_review`) se mantienen.

---

## 5. Contratos de API

No hay cambios de API. Los DTOs (`EvidenceView`, `EvidenceValidationResult`) conservan sus campos públicos. Los campos nuevos son internos a la capa de datos y se expondrán progresivamente en Fase 2.

Endpoints afectados internamente:
- `POST /v1/evidence` (repository `create`)
- `POST /v1/evidence-gateway/upload`
- `POST /v1/buildops/:id/promote` (legacy promotion crea Evidence)
- Browser agent sube screenshot a Evidence Gateway.

---

## 6. Criterios de Éxito

| Métrica | Valor objetivo |
|---------|---------------|
| Typecheck | 0 errores |
| Lint | 0 errores (warnings web preexistentes permitidos) |
| Tests unitarios API | ≥ 1887 pass / 0 fail |
| Tests unitarios workspace | ≥ 918 pass / 0 fail |
| `pnpm spec:preflight` | pass |
| `pnpm db:generate` | OK |

---

## 7. Tests Requeridos

```typescript
describe("evidence-canonical-fase1") {
  it("Evidence schema incluye tenantId, entityType, entityId, farmId")
  it("Evidence.create escribe tenantId correctamente")
  it("migration backfilla tenantId desde Project")
  it("evidence-gateway/upload persiste tenantId")
  it("buildops legacy promotion crea Evidence con tenantId")
}
```

---

## 8. Impacto en otros dominios

| Dominio | Impacto | Acción requerida |
|---------|---------|-----------------|
| Evidence | Alto | Schema + repository + service/controller |
| BuildOps legacy promotion | Medio | Añadir `tenantId` en `tx.evidence.create` |
| Evidence Gateway | Medio | Añadir `tenantId` a input/DTO/controller |
| Browser Agent | Bajo | Pasar `tenantId` al Evidence Gateway |
| Agro | Fase 2 | Migrar `AgroEvidenceItem` a `Evidence`; requiere `tenantId` en `AgroFarm` |

---

## 9. Supuestos y Dependencias

- Fase 2 requiere añadir `tenantId` a `AgroFarm` (deuda ya identificada en tareas Fase 3).
- `projectId` permanece requerido en Fase 1; en Fase 2 se hará opcional para evidencia agro pura.
- `AgroEvidenceItem` no se elimina en esta fase.

---

## Checklist de aprobación

- [x] Escenario P1 con Given/When/Then
- [x] Contratos/API documentados (sin cambios públicos)
- [x] Impacto en otros dominios documentado
- [x] Tests requeridos listados
- [x] Ninguna invariante de `DOMAIN_INVARIANTS.md` violada (Article VII: añade `tenantId` a `Evidence`)
- [x] Spec agregado a `docs/SPEC_INDEX.md`
- [x] Status cambiado a `APPROVED`
