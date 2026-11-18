---
id: "core.worksite-location-binding"
title: "Ubicación verificable de obra y vínculo Job/proyecto libre para geocercas (OPEN-18)"
domain: "core"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags:
  - "SEMSE_WORKSITE_BINDING_ENABLED"
production_evidence: []
related_files:
  - "apps/api/src/modules/geofence/geofence.service.ts"
  - "apps/api/src/modules/organizations/crews.service.ts"
  - "apps/api/src/common/resource-scope.ts"
  - "packages/db/prisma/schema.prisma"
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-11-18"
---
# OPEN-18 — Ubicación verificable de obra y vínculo Job/proyecto libre

> **DRAFT para aprobación del propietario.** Nada de esto está implementado ni migrado. La migración solo se
> ejecutará después de que el propietario apruebe este contrato, su compatibilidad, sus pruebas y su rollback (§7–§9).

## 1. Problema y resultado

`POST /v1/me/geofence-events` solo acepta como sitio válido una `Worksite` (BO-07) de una Org donde la persona es
ACTIVE. Pero `Worksite` **no tiene coordenadas**, y los clientes (web y móvil) detectan proximidad contra **jobs y
proyectos libres**, que sí las tienen (`Job.latitude/longitude`, `FreeProject.latitude/longitude`). Resultado: ningún
cliente puede emitir un evento válido, todos terminan en `IGNORE` y la decisión del servidor (precisión, enfriamiento,
«sin doble sesión», excepción por horario) **no gobierna** el auto-inicio; lo gobierna el interruptor local.

**Decisión del propietario (2026-11-18), dirección de diseño:** modelo **híbrido**. Tanto un `Job` como un
`FreeProject` pueden asociarse a una **ubicación de obra con coordenadas verificables**. El servidor valida esa
asociación, aplica **ResourceScope** y sigue siendo la **autoridad** de las decisiones de geocerca. **`TimeEntry`
permanece como registro canónico** del tiempo.

Resultado esperado: un evento de llegada sobre un job o proyecto libre vinculado a una obra verificada se evalúa en el
servidor, y el auto-inicio solo ocurre si el servidor lo permitió (`AUTO_START_ALLOWED`).

## 2. Alcance

### Incluido
- Coordenadas, radio y procedencia verificable en `Worksite` (aditivo, nulable).
- Tabla nueva `WorksiteBinding`: vínculo de una obra con un `Job` **o** un `FreeProject`.
- Evaluación de eventos por `site = {kind, id}` (JOB / FREE_PROJECT), resuelto por el servidor a la obra vinculada.
- Endpoint de sitios detectables por la persona, con coordenadas y radio de la obra (no las del usuario).
- Exigir, para un `TimeEntry` iniciado con `checkInMethod = "proximity_auto"`, una decisión `AUTO_START_ALLOWED`
  vigente y no consumida del servidor.

### Fuera de alcance
- Cambiar el esquema de `TimeEntry` (sigue igual; ver §7).
- Guardar coordenadas del usuario. El servidor sigue sin recibirlas ni almacenarlas.
- Polígonos y geocercas no circulares. Pruebas en dispositivos (Gate 5 de `core.geofence-policy`, aparte).

## 3. Actores, permisos y límites

| Acción | Quién | Regla |
|---|---|---|
| Fijar coordenadas de una obra | quien tenga `org:crews:manage` en la Org de la obra | Membership ACTIVE en esa Org y tenant (AC-01 de BO-07) |
| Vincular **Job** ↔ obra | `org:crews:manage` en la Org de la obra | El Job es del mismo tenant y la Org de la obra es la **org cliente** o la **org profesional asignada** del proyecto del Job (`hasScopeAccess(actor, scope, "read")` sobre `ProjectScope`); si no → 404 sin oráculo |
| Vincular **FreeProject** ↔ obra | el **creador** del proyecto libre | Debe tener además `org:crews:manage` y Membership ACTIVE en la Org de la obra; un proyecto libre ajeno → 404 |
| Emitir evento sobre un sitio | la persona autenticada | Membership **WORKER ACTIVE** vigente en la Org de la obra, revalidada en cada evento; para FREE_PROJECT, además ser su creador |
| Ver sitios detectables | la persona autenticada | Solo obras vinculadas a jobs/proyectos dentro de su alcance actual |

OPS_ADMIN no cruza tenants (regla de ResourceScope). Un recurso de otro tenant u Org responde 404.

## 4. Escenarios y criterios de aceptación

- **AC-01:** con el flag apagado, el contrato actual no cambia: `site` se ignora y la decisión es la misma que hoy.
- **AC-02:** una obra sin coordenadas **verificadas** solo puede dar `PROMPT` (nunca `AUTO_START_ALLOWED`); motivo
  `site_unverified`.
- **AC-03:** coordenadas verificadas = `locationSource ∈ {"manual_pin","onsite_capture"}` con `locationVerifiedAt` y
  `locationVerifiedBy`; `"geocoded"` sola no basta para AUTO.
- **AC-04:** a lo sumo **un vínculo ACTIVE** por (tenant, kind, targetId). Vincular de nuevo el mismo par es
  idempotente; vincular a otra obra exige terminar el anterior (409 si no).
- **AC-05:** el evento con `site` resuelve el vínculo ACTIVE; si no existe, la obra está archivada o la persona ya no
  tiene alcance → `IGNORE`, motivo `site_not_allowed`. Sin oráculo de existencia.
- **AC-06:** si llegan `worksiteId` y `site` y no coinciden con el vínculo → 422.
- **AC-07:** el `GeofenceEvent` guarda `worksiteId` resuelto y `bindingId` (nuevo, nulable) para auditoría.
- **AC-08:** iniciar un `TimeEntry` con `checkInMethod = "proximity_auto"` exige `geofenceEventId` de la misma
  persona y tenant, decisión `AUTO_START_ALLOWED`, mismo `jobId`/`freeProjectId` que el vínculo, antigüedad
  ≤ 10 min y **no consumido**. Si falla → 409 `auto_start_not_authorized`; el cliente debe pedir confirmación
  (`proximity_confirmed`). El consumo se marca en `GeofenceEvent.consumedByTimeEntryId` en la misma transacción.
- **AC-09:** `proximity_confirmed` y `manual_tagged` no cambian (no exigen evento).
- **AC-10:** revocar la Membership o terminar el vínculo invalida decisiones pendientes no consumidas.

## 5. Contratos (propuestos)

### API
- `PUT /v1/organizations/:orgId/worksites/:worksiteId/location` — `{ latitude, longitude, radiusMeters (50–1000),
  source: "manual_pin" | "onsite_capture" | "geocoded" }`. Devuelve la obra con `locationVerifiedAt`.
- `POST /v1/organizations/:orgId/worksites/:worksiteId/bindings` — `{ kind: "JOB" | "FREE_PROJECT", targetId }`.
- `GET /v1/organizations/:orgId/worksites/:worksiteId/bindings`
- `POST /v1/organizations/:orgId/worksites/:worksiteId/bindings/:bindingId/end`
- `GET /v1/me/geofence-sites` — `[{ kind, targetId, worksiteId, latitude, longitude, radiusMeters, verified }]`.
- `POST /v1/me/geofence-events` — añade `site?: { kind, id }` (opcional; `worksiteId` se conserva).
- Tracker (labor engine) — al iniciar con `checkInMethod: "proximity_auto"` acepta `geofenceEventId`.

### UI
- Web `/client/crews` y `/worker/crews`: fijar ubicación de la obra (pin o captura en sitio) y vincular jobs/proyectos.
- Web y móvil: la detección usa `GET /v1/me/geofence-sites` con el flag encendido y envía `site`.

## 6. FSM, eventos y reconstrucción

`WorksiteBinding.status`: `ACTIVE → ENDED` (sin vuelta atrás; un nuevo vínculo es otra fila).

Eventos de auditoría **a registrar en `EVENT_CATALOG.md` en el mismo PR de implementación** (hoy no existen):
`worksite.location_set`, `worksite_binding.created`, `worksite_binding.ended`. Observación: el código actual ya emite
`location_preference.changed` (BO-09), que **no** figura en el catálogo; se registrará también.

## 7. Datos y migración (propuesta; NO ejecutada)

```sql
-- Aditiva y nulable: no reescribe filas existentes.
ALTER TABLE "Worksite"
  ADD COLUMN "latitude" DECIMAL(10,7),
  ADD COLUMN "longitude" DECIMAL(10,7),
  ADD COLUMN "radiusMeters" INTEGER,
  ADD COLUMN "locationSource" TEXT,
  ADD COLUMN "locationVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "locationVerifiedBy" TEXT;

CREATE TABLE "WorksiteBinding" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "worksiteId" TEXT NOT NULL REFERENCES "Worksite"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,                       -- JOB | FREE_PROJECT
  "jobId" TEXT REFERENCES "Job"("id") ON DELETE CASCADE,
  "freeProjectId" TEXT REFERENCES "FreeProject"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',    -- ACTIVE | ENDED
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "WorksiteBinding_target_ck" CHECK (
    ("kind" = 'JOB' AND "jobId" IS NOT NULL AND "freeProjectId" IS NULL) OR
    ("kind" = 'FREE_PROJECT' AND "freeProjectId" IS NOT NULL AND "jobId" IS NULL))
);
CREATE UNIQUE INDEX "WorksiteBinding_active_job_uq" ON "WorksiteBinding"("tenantId","jobId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "WorksiteBinding_active_fp_uq"  ON "WorksiteBinding"("tenantId","freeProjectId") WHERE "status" = 'ACTIVE';
CREATE INDEX "WorksiteBinding_worksite_idx" ON "WorksiteBinding"("tenantId","worksiteId","status");

ALTER TABLE "GeofenceEvent"
  ADD COLUMN "bindingId" TEXT,
  ADD COLUMN "consumedByTimeEntryId" TEXT;
CREATE UNIQUE INDEX "GeofenceEvent_consumed_uq" ON "GeofenceEvent"("consumedByTimeEntryId");
```

- **Por qué una tabla de vínculo y no `worksiteId` en `Job`/`FreeProject`:** el `Job` pertenece a la org cliente y la
  obra a la org que gestiona cuadrillas; escribir en `Job` desde el módulo de cuadrillas violaría «no cross-module
  DB writes». El vínculo vive en el módulo dueño de las obras.
- **Índices parciales:** Prisma no los genera y el repo **no tiene precedente** (ninguna migración usa
  `CREATE UNIQUE INDEX … WHERE`). Irían en SQL crudo dentro de la migración, documentados en `schema.prisma`, con la
  prueba PostgreSQL del §9 como garantía; el plan debe confirmar que `prisma migrate diff` no intenta borrarlos.
- **`TimeEntry` no cambia.** La relación evento→sesión se guarda en `GeofenceEvent.consumedByTimeEntryId`.
- **Sin backfill.** Las obras existentes quedan sin coordenadas (solo `PROMPT` hasta verificarlas).

## 8. Compatibilidad, despliegue y activación

- **Orden:** (1) migración aditiva; (2) código tolerante con el flag apagado; (3) activar
  `SEMSE_WORKSITE_BINDING_ENABLED` **solo en staging** para el piloto; (4) producción, con autorización explícita.
- **Clientes antiguos:** siguen enviando `worksiteId` o nada; con el flag apagado o sin `site`, el comportamiento es
  el actual. AC-08 solo se aplica con el flag encendido, para no romper builds móviles ya instalados.
- **Requiere** `core.geofence-policy` v0.3 y `core.crews-worksites` v0.3 (extracción FieldOps, apilada sobre #1054).

## 9. Tests requeridos (antes de implementar, T-002)

- Unitarios de API: AC-01…AC-10, incluidos los negativos de ResourceScope:
  - Job de otro tenant → 404;
  - Org de la obra que no es cliente ni profesional asignado → 404;
  - FreeProject ajeno → 404;
  - WORKER suspendido → `IGNORE`;
  - vínculo terminado → `IGNORE`;
  - evento consumido dos veces → 409;
  - evento con más de 10 min → 409.
- **PostgreSQL real** (API Integration):
  - índices parciales: dos vínculos ACTIVE para el mismo Job → violación de unicidad;
  - CHECK de `kind`;
  - consumo concurrente del mismo evento por dos `TimeEntry` → solo uno gana.
- Web/móvil: `GET /v1/me/geofence-sites` alimenta la detección; con el flag apagado, el comportamiento es el anterior.
- Dispositivos (Gate 5): llegada real a una obra verificada en el Motorola y en ambos iPhone.

## 10. Rollback

1. **Inmediato:** apagar `SEMSE_WORKSITE_BINDING_ENABLED`. El servidor ignora `site` y AC-08, y los clientes vuelven a
   la confirmación local. No se pierde ningún dato.
2. **Código:** revertir el PR de implementación (la migración aditiva puede quedarse).
3. **Esquema (solo si se pide):** exportar `WorksiteBinding` y las columnas nuevas, y luego aplicar una migración
   inversa: `DROP TABLE "WorksiteBinding"` y `DROP COLUMN` de las 6 + 2 columnas. Ningún `TimeEntry` se toca en
   ningún paso.

## 11. Preguntas abiertas para el propietario

- Q1: ¿un proyecto libre de un trabajador independiente sin Org gestionable puede vincularse? Propuesta: no en el
  piloto; requiere `org:crews:manage` en la Org de la obra.
- Q2: radio por defecto y límites (propuesta: 150 m; 50–1000 m).
- Q3: ventana de validez de una decisión `AUTO_START_ALLOWED` (propuesta: 10 min).

## 12. Gates de cierre

Aprobación del propietario de §7–§10, después plan y tareas SDD, tests antes del código, CI completa con PostgreSQL
real, staging aislado y Gate 5 en dispositivos. Ningún gate está cerrado.
