---
id: "core.worksite-location-binding"
title: "Ubicación verificable de obra y vínculo Job/proyecto libre para geocercas (OPEN-18)"
domain: "core"
sdd_version: "2.0"
version: "0.3"
status: "APPROVED"
owner: "semse-core"
risk: "critical"
code_status: "IN_PROGRESS"
ci_status: "PASS"
merge_status: "MERGED"
deploy_status: "DEPLOYED"
activation_status: "INACTIVE"
migration_status: "APPLIED"
feature_flags:
  - "SEMSE_WORKSITE_BINDING_ENABLED"
production_evidence:
  - "2026-11-25: #1168 fusionado (main@bc127c90); migración 20261120120000_worksite_location_binding aplicada por pre-migrate en semse-API (deploy 744e05fa); health gitSha bc127c90, flag apagado"
  - "2026-11-25: #1172 (clientes W-07) fusionado (main@384859ff); 4 servicios SUCCESS; health gitSha 384859ff; flag apagado"
  - "2026-11-27: #1189 (v0.3, AC-11…AC-15) fusionado (main@60bcff1c, árbol idéntico a la candidata 572c9344); CI, API Integration, API Smoke y Operación Asistida en verde; Railway Deploy y Production Health Gate OK; health gitSha 60bcff1c; sin migración; SEMSE_WORKSITE_BINDING_ENABLED y SEMSE_GEOFENCE_POLICY_ENABLED sin definir en semse-API y semse-web"
related_files:
  - "apps/api/src/modules/geofence/site-binding.ts"
  - "apps/api/src/modules/geofence/geofence.policy.ts"
  - "apps/api/src/modules/geofence/geofence.service.ts"
  - "apps/api/src/modules/geofence/geofence.controller.ts"
  - "apps/api/src/modules/organizations/worksite-location.service.ts"
  - "apps/api/src/modules/organizations/worksite-location.controller.ts"
  - "apps/api/src/modules/labor-engine/labor-engine.service.ts"
  - "apps/api/src/modules/labor-engine/labor-engine.repository.ts"
  - "apps/api/src/common/resource-scope.ts"
  - "packages/schemas/src/worksite-binding.schema.ts"
  - "packages/db/prisma/schema.prisma"
  - "packages/db/prisma/migrations/20261120120000_worksite_location_binding/migration.sql"
related_tests:
  - "apps/api/test/worksite-location-binding.test.ts"
  - "apps/api/test/worksite-location-binding-integration.test.ts"
  - "apps/api/test/geofence-policy.test.ts"
related_endpoints:
  - "PUT /v1/organizations/:orgId/worksites/:worksiteId/location"
  - "POST /v1/organizations/:orgId/worksites/:worksiteId/bindings"
  - "GET /v1/organizations/:orgId/worksites/:worksiteId/bindings"
  - "POST /v1/organizations/:orgId/worksites/:worksiteId/bindings/:bindingId/end"
  - "GET /v1/me/geofence-sites"
  - "POST /v1/me/geofence-events"
  - "POST /v1/labor/timer/start"
related_events:
  - "worksite.location_set"
  - "worksite_binding.created"
  - "worksite_binding.ended"
related_agents: []
last_verified: "2026-11-27"
---
# OPEN-18 — Ubicación verificable de obra y vínculo Job/proyecto libre

> **APPROVED por el propietario el 2026-11-20** («Apruebo OPEN-18»), incluidas las propuestas de Q1–Q3 (§11).
> **v0.3 (2026-11-25):** el propietario aprueba la opción A para trabajadores de varias Org (AC-11) y los arreglos de
> clientes AC-12…AC-14, que salen de la revisión automatizada de #1172.
> **Estado de entrega.** Los campos `ci_status`, `merge_status`, `deploy_status` y `migration_status` del encabezado
> cubren v0.2 (#1168, #1172) y v0.3 (#1189, main@60bcff1c, desplegado el 2026-11-27). `activation_status` sigue
> `INACTIVE`: el flag está apagado y Gate 5 (dispositivos reales) sigue abierto. Fusionar y desplegar no implica
> activación.
> Servidor (#1168) y clientes (#1172) fusionados y desplegados. La migración aditiva está
> aplicada en producción y en el staging aislado. `SEMSE_WORKSITE_BINDING_ENABLED` está **apagado** en producción:
> encenderlo exige una orden aparte del propietario, después de AC-12…AC-14 y del cierre de Gate 5.

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
- **AC-02:** una obra sin coordenadas **verificadas** solo puede dar `PROMPT` (nunca `AUTO_START_ALLOWED`). El
  motivo es un texto descriptivo, como el resto de `GeofenceEvent.reason` («obra sin ubicación verificada…»); el
  contrato que consumen los clientes es `decision`, no el texto.
- **AC-03:** coordenadas verificadas = `locationSource ∈ {"manual_pin","onsite_capture"}` con `locationVerifiedAt` y
  `locationVerifiedBy`; `"geocoded"` sola no basta para AUTO.
- **AC-04:** a lo sumo **un vínculo ACTIVE** por (tenant, kind, targetId), garantizado en la base por el índice
  único de `activeTargetKey` (§7). Vincular de nuevo el mismo par es
  idempotente; vincular a otra obra exige terminar el anterior (409 si no).
- **AC-05:** el evento con `site` resuelve el vínculo ACTIVE; si no existe, la obra está archivada o la persona ya no
  tiene alcance → `IGNORE`, con el motivo descriptivo existente («obra no permitida para esta persona»). Sin oráculo
  de existencia.
- **AC-06:** si llegan `worksiteId` y `site` y no coinciden con el vínculo → 422.
- **AC-07:** el `GeofenceEvent` guarda `worksiteId` resuelto y `bindingId` (nuevo, nulable) para auditoría.
- **AC-08:** iniciar un `TimeEntry` con `checkInMethod = "proximity_auto"` exige `geofenceEventId` de la misma
  persona y tenant, decisión `AUTO_START_ALLOWED`, mismo `jobId`/`freeProjectId` que el vínculo, antigüedad
  ≤ 10 min y **no consumido**. Si falla → 409 `auto_start_not_authorized`; el cliente debe pedir confirmación
  (`proximity_confirmed`). El consumo se marca en `GeofenceEvent.consumedByTimeEntryId` en la misma transacción,
  con aislamiento `Serializable`; un conflicto de serialización (`P2034`) también responde 409. La distancia del
  fichaje se mide contra la obra autorizada, no contra las coordenadas del Job o del proyecto.
- **AC-09:** `proximity_confirmed` y `manual_tagged` no cambian (no exigen evento).
- **AC-10:** revocar la Membership, terminar el vínculo, reasignar el Job o salir de AUTO (retirar el consentimiento)
  invalida las decisiones pendientes no consumidas. Se revalida **dentro** de la transacción de consumo, así que una
  revocación que confirma entre la validación previa y la reclamación tampoco deja pasar el inicio.
- **AC-11 (v0.3, opción A):** solo cuentan las obras de la **Org de la sesión**. `GET /v1/me/geofence-sites` lista
  únicamente obras de esa Org; una llegada a una obra de otra Org de la persona → `IGNORE`, sin oráculo; y una
  decisión de otra Org no autoriza un inicio desde esta sesión (409). Motivo: el Time Tracker valida la asignación
  contra la Org de la sesión. **Al cambiar de Org:** los clientes vuelven a pedir `geofence-sites` al cargar el
  reloj (web) o al ganar el foco el Reloj o Ajustes (móvil), y entonces aparecen las obras de la Org nueva. Las
  decisiones pendientes de la Org anterior no sirven en la nueva.
- **AC-12 (v0.3):** un inicio `proximity_auto` que no se completa (409 `auto_start_not_authorized`, sin conexión o
  5xx) **nunca** se guarda para reintentarlo: un reintento posterior no llevaría la decisión y saldría como inicio
  manual. Se descarta y se ofrece la confirmación normal; solo un toque explícito envía `proximity_confirmed`
  (web y móvil).
- **AC-13 (v0.3):** una respuesta de llegada que llega después de que la detección se detuvo (salir del reloj,
  cambiar de pestaña, apagar la detección) se descarta: no inicia ni avisa.
- **AC-14 (v0.3):** en obras vinculadas, el enfriamiento de avisos (20 min por defecto) solo empieza tras una acción
  visible (aviso o inicio). Un `IGNORE` no lo activa; un límite de 1 min por sitio evita informar la llegada en
  cada lectura del GPS. El intervalo de distancia del GPS en segundo plano es de 40 m, por debajo del radio mínimo
  de 50 m. Si el sistema conserva una tarea de ubicación registrada por una versión anterior de la app, se reinicia
  una vez con las opciones actuales.
- **AC-15 (v0.3):** una sesión **en pausa** también cuenta como sesión activa al evaluar la llegada, igual que en el
  Time Tracker: la llegada se ignora y no se ofrece ni se auto-inicia un reloj que el servidor rechazaría.

## 5. Contratos (propuestos)

### API
- `PUT /v1/organizations/:orgId/worksites/:worksiteId/location` — `{ latitude, longitude, radiusMeters (50–1000),
  source: "manual_pin" | "onsite_capture" | "geocoded" }`. Devuelve la obra con `locationVerifiedAt`.
- `POST /v1/organizations/:orgId/worksites/:worksiteId/bindings` — `{ kind: "JOB" | "FREE_PROJECT", targetId }`.
- `GET /v1/organizations/:orgId/worksites/:worksiteId/bindings`
- `POST /v1/organizations/:orgId/worksites/:worksiteId/bindings/:bindingId/end`
- `GET /v1/me/geofence-sites` — `[{ kind, targetId, worksiteId, worksiteName, latitude, longitude, radiusMeters,
  verified }]`. Los filtros de elegibilidad se aplican en la consulta antes del límite (200 sitios).
- Contratos compartidos en `packages/schemas/src/worksite-binding.schema.ts` (`siteRefSchema`,
  `worksiteLocationInputSchema`, `worksiteBindingInputSchema` y vistas) y `geofenceEventId` en `startTimerSchema`.
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
-- v0.2: en lugar de índices parciales, una clave nulable con índice único (ver la nota de abajo).
--   "activeTargetKey" = '<tenantId>:<kind>:<targetId>' mientras ACTIVE; NULL al terminar.
CREATE UNIQUE INDEX "WorksiteBinding_activeTargetKey_key" ON "WorksiteBinding"("activeTargetKey");
ALTER TABLE "WorksiteBinding" ADD CONSTRAINT "WorksiteBinding_active_key_ck" CHECK (
  ("status" = 'ACTIVE' AND "activeTargetKey" IS NOT NULL) OR ("status" = 'ENDED' AND "activeTargetKey" IS NULL));
CREATE INDEX "WorksiteBinding_tenantId_worksiteId_status_idx" ON "WorksiteBinding"("tenantId","worksiteId","status");

ALTER TABLE "GeofenceEvent"
  ADD COLUMN "bindingId" TEXT,
  ADD COLUMN "consumedByTimeEntryId" TEXT;
CREATE UNIQUE INDEX "GeofenceEvent_consumed_uq" ON "GeofenceEvent"("consumedByTimeEntryId");
```

- **Por qué una tabla de vínculo y no `worksiteId` en `Job`/`FreeProject`:** el `Job` pertenece a la org cliente y la
  obra a la org que gestiona cuadrillas; escribir en `Job` desde el módulo de cuadrillas violaría «no cross-module
  DB writes». El vínculo vive en el módulo dueño de las obras.
- **Unicidad del vínculo activo (cambio de implementación en v0.2, misma garantía):** la v0.1 proponía índices
  únicos parciales (`… WHERE "status" = 'ACTIVE'`). Prisma no los representa y el repo no tiene precedente, así que
  `prisma migrate diff` los vería como deriva. Se sustituyen por `activeTargetKey`: una clave nulable con índice
  único que Prisma sí gestiona. Postgres admite varios NULL, así que los vínculos ENDED no colisionan. Un CHECK
  ata la clave al estado. Lo prueba PG-01 sobre PostgreSQL real.
- **CHECK constraints** (objetivo coherente con `kind`, clave ligada al estado, radio de 50–1000 m): van en SQL
  dentro de la migración. Prisma no los gestiona ni los borra; `migrate diff` contra la base migrada no muestra
  deriva propia.
- **`TimeEntry` no cambia.** La relación evento→sesión se guarda en `GeofenceEvent.consumedByTimeEntryId`.
- **Sin backfill.** Las obras existentes quedan sin coordenadas (solo `PROMPT` hasta verificarlas).

## 8. Compatibilidad, despliegue y activación

- **Orden:** (1) migración aditiva; (2) código tolerante con el flag apagado; (3) activar
  `SEMSE_WORKSITE_BINDING_ENABLED` **solo en staging** para el piloto; (4) producción, con autorización explícita.
- **Clientes antiguos:** siguen enviando `worksiteId` o nada; con el flag apagado o sin `site`, el comportamiento es
  el actual. AC-08 solo se aplica con el flag encendido, para no romper builds móviles ya instalados.
- **Clientes antes de encender el flag:** hoy web (`useProximityCheckIn`) y móvil (`proximityService`) envían
  `checkIn.method = "proximity_auto"` sin `geofenceEventId`. Con el flag encendido, esos inicios reciben 409
  (`auto_start_not_authorized`) y el cliente debe pedir confirmación. Antes de activarlo hay que adaptar ambos
  clientes: detectar con `GET /v1/me/geofence-sites`, enviar `site` en el evento y pasar el `id` de la decisión
  como `geofenceEventId` al iniciar. Es la tarea W-07 del plan, que depende de la extracción FieldOps (#1169).
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
   - **Móvil en segundo plano (v0.3):** la tarea de ubicación usa las obras vinculadas guardadas hasta la siguiente
     actualización. Esta ocurre al iniciar sesión o al ganar el foco el Reloj o Ajustes. Mientras tanto, cada
     llegada a una obra vinculada se envía con `site`. Con el flag apagado, el servidor la ignora y, sin
     `worksiteId`, decide `IGNORE`: **no hay auto-inicio ni aviso**, es un fallo seguro. Tras la actualización,
     `geofence-sites` responde 404 y vuelven los jobs y proyectos locales (test
     `refreshSites.test.ts › rollback`). Para recuperar antes la detección local, basta con abrir el Reloj.
2. **Código:** revertir el PR de implementación (la migración aditiva puede quedarse).
3. **Esquema (solo si se pide):** exportar `WorksiteBinding` y las columnas nuevas, y luego aplicar una migración
   inversa: `DROP TABLE "WorksiteBinding"` y `DROP COLUMN` de las 6 + 2 columnas. Ningún `TimeEntry` se toca en
   ningún paso.

## 11. Preguntas del propietario (resueltas el 2026-11-20: aprobadas las propuestas)

- Q1: ¿un proyecto libre de un trabajador independiente sin Org gestionable puede vincularse? Propuesta: no en el
  piloto; requiere `org:crews:manage` en la Org de la obra.
- Q2: radio por defecto y límites (propuesta: 150 m; 50–1000 m).
- Q3: ventana de validez de una decisión `AUTO_START_ALLOWED` (propuesta: 10 min).

## 12. Gates de cierre

Aprobación del propietario de §7–§10, después plan y tareas SDD, tests antes del código, CI completa con PostgreSQL
real, staging aislado y Gate 5 en dispositivos. Ningún gate está cerrado.
