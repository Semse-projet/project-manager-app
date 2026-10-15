---
id: "labor.free-project-mutation-guard"
title: "Labor Engine — guard de ownership y destino en mutaciones de FreeProject (S0)"
domain: "labor"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "high"
date: "2026-10-15"
author: "Claude"
spec_index: "docs/SPEC_INDEX.md"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/api/src/modules/labor-engine/labor-engine.controller.ts
  - apps/api/src/modules/labor-engine/labor-engine.service.ts
  - apps/api/src/modules/labor-engine/labor-engine.repository.ts
  - apps/api/src/common/job-assignment.ts
  - packages/schemas/src/labor-engine.schema.ts
  - apps/web/app/(app)/worker/tracker/sections/ProyectosTab.tsx
  - docs/foundation/EVENT_CATALOG.md
related_tests:
  - apps/api/test/labor-engine.service.test.ts
  - apps/api/test/labor-engine.controller.test.ts
  - apps/api/test/labor-engine.repository.test.ts
related_endpoints:
  - v1/labor/free-projects/:id
  - v1/labor/free-projects/:id/convert
related_events: []
related_agents: []
last_verified: "2026-10-15"
---

# Spec: guard de ownership y destino en mutaciones de FreeProject (S0)

> Slice **S0/P0** del EPIC
> [#935](https://github.com/Semse-projet/project-manager-app/issues/935),
> derivado de [#934](https://github.com/Semse-projet/project-manager-app/issues/934).
> Contrato SDD 2.0 en `DRAFT`: **no autoriza código** hasta que el owner
> cierre las decisiones de §13 y cambie `status` a `APPROVED`.
> Complementa a `labor.engine-remediation` (APPROVED), cuyo §3 ya establece
> que "`tenantId` acota, pero ownership por `createdBy` autoriza" y cuyo §9
> declara que el ownership no se revierte. Este spec cierra la brecha
> código↔spec en los tres endpoints de mutación de FreeProject que no
> aplican esa regla.

## 1. Problema y resultado

**Para quién:** trabajador o profesional (`WORKER`/`PRO`) que usa
`/worker/tracker → Proyectos` para organizar sus horas personales.

**Problema (diagnóstico por lectura de `main` @ `83375e6`, sin explotación
demostrada ni acceso a datos productivos):**

| # | Ubicación | Hallazgo |
|---|---|---|
| H1 | `labor-engine.controller.ts:85-126` | `PATCH /free-projects/:id`, `DELETE /free-projects/:id` y `POST /free-projects/:id/convert` sólo pasan `a.tenantId` al servicio; `a.userId` y `a.orgId` se descartan. |
| H2 | `labor-engine.repository.ts:528-545` | `updateFreeProject` busca con `{ id, tenantId }` y actualiza con `{ id }`: **no filtra `createdBy`**. Lo usan PATCH, archivar y convertir. |
| H3 | `labor-engine.service.ts:143-145` | `convertToJob` escribe `status: "converted"` y `convertedJobId: jobId` sin verificar que el Job exista, no esté eliminado, pertenezca al tenant ni esté asignado al actor; tampoco revisa el estado de origen (archivado/ya convertido) y una segunda llamada sobrescribe `convertedJobId`. |
| H4 | `schema.prisma:1671` | `convertedJobId String?` no tiene FK: cualquier string se persiste. |
| H5 | `labor-engine.service.ts:90-119` + `controller.ts:99` | `PATCH` acepta cualquier `status` salvo `"converted"`: p.ej. `"active"` sobre un archivado/convertido (restauración implícita que deja `convertedJobId` colgado) o valores fuera del dominio `active|archived|converted`. El contrato compartido `freeProjectUpdateSchema` (`packages/schemas/src/labor-engine.schema.ts:43`) **no incluye `status`**, y ni web (`ProyectosTab.tsx:110-116`) ni móvil (`apps/mobile/src/api/labor.ts:44-49`) lo envían. |
| H6 | `labor-engine.repository.ts:541-544` | La respuesta del PATCH devuelve el registro completo (`name`, `location`, `latitude`, `longitude`, `description`): un PATCH con cuerpo vacío sobre un id ajeno funciona como **lectura** de un proyecto personal de otra persona. |
| H7 | `labor-engine.service.ts:139-141` | Archivar no verifica actor; como `listFreeProjects` excluye archivados (`repository.ts:521-526`) y no hay restauración en UI (#933), un archivado por tercero oculta el proyecto a su dueño. |

Contexto que acota el riesgo y fija la solución:

- **Hallazgo nuevo, no duplicado:** `docs/AUDIT_REMEDIATION_PLAN.md` 2.9
  (PR #414) agregó ownership a `startTimer`/entrada manual y 2.16 bloqueó
  `status: "converted"` por PATCH; ninguno cubrió ownership de PATCH,
  archivar ni el Job destino de `convert`.
- `field-ops:write` lo tienen `PRO`, `WORKER` y `OPS_ADMIN`
  (`packages/auth/src/rbac.ts:109-110, 145-146, 233-234`): el permiso no
  distingue dueño.
- Los ids de FreeProject son UUID/cuid (`repository.ts:502-506`), no
  enumerables. Esto reduce la probabilidad, **no es un control**.
- Las reglas correctas ya existen en el mismo módulo y no se usan aquí:
  `isFreeProjectOwnedByWorker` (`repository.ts:182-188`),
  `isJobAssignedToWorker` (`repository.ts:168-180`) y `assertOwnership`
  (`service.ts:225-234`), aplicadas hoy por `startTimer` y entradas manuales.
- `isJobAssignedToWorker` usa `jobAssignmentWhere`
  (`apps/api/src/common/job-assignment.ts:13-22`), **la misma regla** con la
  que `field-ops.repository.ts:210-216` arma la lista de Jobs que el selector
  "Elegir job destino" ofrece (`ProyectosTab.tsx:302-316`). Exigirla en el
  backend no quita ninguna opción legítima de la UI actual.
- `live-sessions.resource-access.ts:55-62` ya resuelve acceso a FreeProject
  por `createdBy`: el patrón existe en el repo.
- Convertir **no** toca `TimeEntry`, Job, membresías ni pagos: sólo
  metadatos del FreeProject (`grep convertedJobId`: únicamente repo, schema
  Zod y la etiqueta de `ProyectosTab.tsx:260`).

**Resultado esperado:** sólo el creador de un FreeProject puede editarlo,
archivarlo o convertirlo; la conversión sólo apunta a un Job existente, no
eliminado, del mismo tenant y asignado al actor según `jobAssignmentWhere`;
toda petición rechazada deja `status`, `convertedJobId` y el resto del
registro **sin cambios**; las transiciones permitidas quedan en AuditLog.

## 2. Alcance

### Incluido

- Scope por `createdBy = actor.userId` (además de `tenantId`) en
  `PATCH`, `DELETE` (archivar) y `POST …/convert` de FreeProject.
- Validación del Job destino en `convert` con `isJobAssignedToWorker`.
- Guard de estado en `convert`: origen `active` únicamente; reintento con el
  mismo `jobId` idempotente; otro `jobId` sobre un convertido = conflicto.
- `PATCH` deja de aceptar `status` (alineado al contrato Zod compartido).
- Escritura condicional (compare-and-set) para que la comprobación de
  estado y la escritura no tengan carrera.
- AuditLog para `convert` y `archive` permitidos (sujeto a D4).
- Tests negativos y de aceptación en `apps/api/test/` (unitarios de
  servicio/repositorio/controlador, sin DB real ni datos productivos).

### Fuera de alcance

- Restaurar archivados, listado de archivados, nombre histórico en
  Registros/CSV → **S1 / #933**.
- Ubicación aproximada/desconocida, mapa → **S2 / #931**.
- Invitación/asignación de trabajador a Job del patrón, grants de
  supervisor/cuadrilla, delegación de mutaciones → **S3 / #932, #934 B**.
- Conciliación histórica de horas FreeProject→Job → **#934 C**.
- FK o migración de `convertedJobId`; limpieza de datos existentes.
- Override de `OPS_ADMIN` sobre FreeProjects ajenos (ver D5).
- Bloquear `startTimer`/entrada manual sobre FreeProject archivado o
  convertido (comportamiento actual se conserva; candidato a S1).
- Cambios de UI más allá de comprobar que el mensaje de error del API se
  muestra (ya ocurre vía `setError` en `ProyectosTab.tsx`).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| Creador del FreeProject (`WORKER`/`PRO`) | `field-ops:write` | `tenantId` + `createdBy = userId` | Editar campos descriptivos, archivar, convertir a Job asignado | Cambiar `status` por PATCH; convertir a Job no asignado/inexistente/eliminado/de otro tenant; reconvertir a otro Job |
| Otro usuario mismo tenant/org | `field-ops:write` | — | Nada sobre ese FreeProject | Leer (vía respuesta de PATCH), editar, archivar ni convertir |
| Usuario de otra org/tenant | cualquiera | — | Nada | Ídem |
| `OPS_ADMIN` | `field-ops:write` | — en S0 (D5) | Nada sobre FreeProjects ajenos | Ídem; sin override en este slice |
| `CLIENT` | sin `field-ops:write` | — | — | Ya rechazado por RBAC (403) |

- **Tenant boundary:** se mantiene `tenantId` en todas las consultas.
- **Ownership/resource policy:** `createdBy = actor.userId` para el
  FreeProject; para el Job destino, `tenantId` + `deletedAt: null` +
  `jobAssignmentWhere({ orgId, userId })`.
- **Delegación:** no existe modelo de delegación; S0 es *owner-only*. Las
  "mutaciones explícitamente delegadas" del handoff quedan para S3.
- **Step-up/aprobación humana:** no aplica (acción personal sin dinero).
- **`privacyCritical`:** no (no hay LLM). Sí hay datos personales
  (ubicación/coordenadas) → la respuesta nunca se devuelve a no-dueños.
- **`paymentGovernance`:** no. Convertir no crea escrow, contrato, factura ni
  participación en el Job (§1).
- **`sse`:** no.
- **`fsmTransicion`:** `active → converted`, `* → archived` (no hay FSM
  formal de FreeProject en `STATE_MACHINES.md`; ver §6).
- **`auditLog`:** sí, para `convert` y `archive` (D4).

## 4. Escenarios y criterios de aceptación

### P1 — Conversión legítima

```gherkin
DADO un FreeProject F activo creado por W en el tenant T
  Y un Job J del tenant T, no eliminado, asignado a W según jobAssignmentWhere
CUANDO W hace POST /v1/labor/free-projects/F/convert { jobId: J }
ENTONCES 200 y F queda status "converted", convertedJobId J
  Y J, sus TimeEntry, contratos y pagos no cambian
  Y se registra AuditLog free_project.converted (actor W, before/after status) — D4
```

### P1 — Rechazos sin efecto

```gherkin
DADO un FreeProject F activo creado por W en el tenant T
CUANDO <actor> llama <endpoint> sobre F
ENTONCES responde <código>
  Y F conserva status, convertedJobId, name, location, latitude, longitude y description
  Y la respuesta no incluye ningún campo de F
```

| ID | Actor / entrada | Endpoint | Código esperado |
|---|---|---|---|
| N1 | Otro usuario, mismo tenant y misma org | PATCH / DELETE / convert | 404 (D1) |
| N2 | Usuario de otra org, mismo tenant | PATCH / DELETE / convert | 404 |
| N3 | Usuario de otro tenant | PATCH / DELETE / convert | 404 |
| N4 | W, `id` inexistente/arbitrario | PATCH / DELETE / convert | 404 |
| N5 | W, `jobId` inexistente | convert | 403 genérico (D1) |
| N6 | W, Job eliminado (`deletedAt` no nulo) | convert | 403 genérico |
| N7 | W, Job de otro tenant | convert | 403 genérico |
| N8 | W, Job del tenant **no asignado** a W (incluye org sin asignación individual, #934 caso 7) | convert | 403 genérico |
| N9 | W, F ya convertido a J, nuevo `jobId` K | convert | 409 |
| N10 | W, F archivado | convert | 409 |
| N11 | W, `jobId` ausente o no string | convert | 400 (ya existe) |
| N12 | W, PATCH con `status` (cualquier valor) | PATCH | 400 (D2) |
| N13 | Rol sin `field-ops:write` | cualquiera | 403 (RBAC actual) |
| N14 | Dos `convert` concurrentes de W con Jobs distintos | convert | uno 200, otro 409; `convertedJobId` = el del 200 |

### P2 — Idempotencia y compatibilidad

```gherkin
DADO F convertido por W a J
CUANDO W repite POST convert { jobId: J } (reintento offline/red)
ENTONCES 200 con el registro actual, sin nueva escritura ni nuevo AuditLog — D3
```

```gherkin
DADO F activo de W
CUANDO W hace PATCH con name/color/location/latitude/longitude/description
ENTONCES 200 con los cambios (comportamiento actual preservado)
```

```gherkin
DADO F de W (activo, convertido o ya archivado)
CUANDO W hace DELETE /v1/labor/free-projects/F
ENTONCES 200, status "archived"; si ya estaba archivado no se reescribe ni audita
```

Casos borde:

- [ ] Reintento idéntico de convert/archive no duplica escritura ni audit.
- [ ] Carrera convert/convert y convert/archive resuelta por escritura
      condicional (N14).
- [ ] Aislamiento mismo tenant/otra persona, otra org, otro tenant (N1–N3).
- [ ] El mensaje 403 de Job es idéntico para inexistente, eliminado, otro
      tenant y no asignado (sin oráculo de existencia).
- [ ] `startTimer`/manual siguen funcionando con F propio activo
      (regresión).

## 5. Contratos

### API — `PATCH /v1/labor/free-projects/:id`

```yaml
auth: required
permissions: [field-ops:write]
input_schema: freeProjectUpdateSchema (name, color, location, latitude, longitude, description); status rechazado
output_schema: FreeProjectView (sólo al creador)
errors:
  400: "status" presente en el cuerpo (D2)
  401: sin sesión
  403: sin field-ops:write
  404: no existe o no pertenece al actor en el tenant
effects:
  audit_log: no (metadatos descriptivos; regla anti-ruido)
  domain_event: none
  sse: none
  payment_governance: none
```

### API — `DELETE /v1/labor/free-projects/:id` (archivar)

```yaml
auth: required
permissions: [field-ops:write]
output_schema: FreeProjectView (sólo al creador)
errors:
  401: sin sesión
  403: sin field-ops:write
  404: no existe o no pertenece al actor
effects:
  audit_log: free_project.archived con before.status (D4); no si ya estaba archivado
  domain_event: none
  sse: none
  payment_governance: none
```

### API — `POST /v1/labor/free-projects/:id/convert`

```yaml
auth: required
permissions: [field-ops:write]
input_schema: { jobId: string }
output_schema: FreeProjectView (sólo al creador)
errors:
  400: jobId ausente o no string
  401: sin sesión
  403: sin field-ops:write, o Job destino no disponible para el actor (mensaje único)
  404: FreeProject no existe o no pertenece al actor
  409: FreeProject archivado, o ya convertido a otro Job
effects:
  audit_log: free_project.converted con before/after status y jobId (D4)
  domain_event: none
  sse: none
  payment_governance: none — no crea escrow, contrato, factura ni membresía
```

### UI

```yaml
surfaces: [apps/web/app/(app)/worker/tracker/sections/ProyectosTab.tsx]
states: [ready, error]
required_behavior:
  - Sin cambios funcionales: el selector ya sólo ofrece Jobs de jobAssignmentWhere.
  - Un 403/404/409 del API se muestra con el texto de error existente (setError) y no altera la lista.
```

### Agente/Prometeo

No aplica: Cronos/LaborChat no muta FreeProjects.

## 6. FSM, eventos y reconstrucción

- **Estado/FSM afectado:** `FreeProject.status ∈ {active, archived, converted}`
  (`schema.prisma:1670`). No está en `STATE_MACHINES.md`. Transiciones que
  este spec permite por API: `active → converted` (convert), `active |
  converted → archived` (DELETE). `archived → active` (restaurar) **no**
  existe tras S0 hasta S1. No se agrega FSM a `packages/fsm` en este slice.
- **Invariantes:** `DOMAIN_INVARIANTS.md` "Ownership por Agregado";
  `labor.engine-remediation` §2–§3.
- **Eventos declarados:** `EVENT_CATALOG.md` no tiene sección Labor. Este
  spec **propone** (D4) registrar acciones de AuditLog *audit-only*
  `free_project.converted` y `free_project.archived` (formato
  `aggregate.action`, sin productor de bus ni outbox). No se emiten hasta
  aprobación y registro en el catálogo.
- **Productor + outbox atómico:** no aplica (sin bus).
- **Consumidores + idempotencia:** AuditLog; reintentos idempotentes no
  generan filas nuevas.
- **Replay/rebuild / DLQ:** no aplica.

## 7. Datos y migración

- **Modelos Prisma:** sin cambios.
- **Migración:** ninguna (`migration_status: NOT_APPLICABLE`).
- **Backfill:** ninguno. No se tocan filas existentes.
- **Compatibilidad hacia atrás:** clientes web/móvil no envían `status` en
  PATCH ni operan sobre FreeProjects ajenos; el selector de Jobs ya filtra
  por la misma regla. Única ruptura deliberada: llamadas directas al API que
  dependían de la ausencia de guard.
- **Datos ya escritos:** puede haber filas con `convertedJobId` que no
  resuelve a un Job asignado, o proyectos archivados por terceros; sin
  AuditLog previo **no es posible atribuirlo**. Un censo de sólo lectura en
  producción requiere autorización del owner (D6); este spec no lo ejecuta
  ni modifica datos.
- **Rollback de código:** revert del PR. No hay datos que deshacer.
- **Rollback/forward-fix de datos:** no aplica.

## 8. Observabilidad, despliegue y activación

- **Logs:** rechazos de ownership/destino con `logger.warn` estructurado
  (`requestId`, `tenantId`, `actorUserId`, `freeProjectId`, código de razón);
  **sin** `name`, `location`, coordenadas ni `description`.
- **Feature flag:** ninguno; es un control de seguridad, no una función
  activable (D7).
- **Canary/smoke:** tras deploy, smoke autenticado con dos usuarios de
  prueba autorizados del mismo tenant: A no puede PATCH/DELETE/convert el
  proyecto de B; A sí puede convertir el propio a un Job asignado. IDs de
  prueba ficticios; nunca proyectos de usuarios reales.
- **Señal de rollback:** aumento de 4xx en `/v1/labor/free-projects/*` desde
  la UI propia (no desde llamadas directas) o reportes de "no puedo editar
  mi proyecto".
- **Owner operativo:** semse-core.

## 9. Tests requeridos

Todos en `apps/api/test/` con `node --test`, stubs de repositorio/Prisma y
fixtures ficticios. Deben **fallar contra `main` @ `83375e6`** (gap
demostrado) y pasar tras la implementación.

- [ ] Servicio: N1–N12 con el stub de `labor-engine.service.test.ts`;
      verifica que en cada rechazo no se llamó a la escritura del repo.
- [ ] Servicio: P1 conversión legítima; P2 idempotencia (sin escritura ni
      audit); archivar idempotente.
- [ ] Servicio: `isJobAssignedToWorker` recibe `tenantId`, `orgId`,
      `jobId` y `userId` del actor (no del cuerpo).
- [ ] Repositorio: la escritura condicional incluye `createdBy` y
      `status: "active"` en el `where`; `count = 0` no escribe (N14).
- [ ] Controlador: pasa `userId`/`orgId` del contexto; `status` en PATCH →
      400; `jobId` no string → 400.
- [ ] Regresión: `startTimer`/manual con FreeProject propio siguen pasando.
- [ ] Audit: payload sin PII (sólo ids, estados, `jobId`, `requestId`).

## 10. Mapa de implementación

### API

- `apps/api/src/modules/labor-engine/labor-engine.controller.ts` — pasar
  `a.userId`/`a.orgId`/`requestId`; rechazar `status` en PATCH.
- `apps/api/src/modules/labor-engine/labor-engine.service.ts` — actor en
  `updateFreeProject`/`archiveFreeProject`/`convertToJob`; validar Job con
  `repo.isJobAssignedToWorker`; guard de estado; AuditService.
- `apps/api/src/modules/labor-engine/labor-engine.repository.ts` — búsqueda
  y escritura con `createdBy`; método de conversión condicional.

### Web

- Sin cambios de código previstos (verificación manual del mensaje de error).

### Worker/Packages/DB

- Sin cambios. `docs/foundation/EVENT_CATALOG.md` sólo si D4 se aprueba.

### Tests

- `apps/api/test/labor-engine.service.test.ts`
- `apps/api/test/labor-engine.repository.test.ts`
- `apps/api/test/labor-engine.controller.test.ts`

## 11. Investigación externa

- OWASP API Security Top 10 (2023) — API1 *Broken Object Level
  Authorization*: el chequeo de autorización debe hacerse por objeto en cada
  función que recibe un id del cliente, no sólo por rol/permiso. Aplicado
  ahora (scope por `createdBy` + Job asignado).
- OWASP ASVS v4 §4.2 (operation-level access control / IDOR): mismo
  principio; aplicado.
- Responder 404 en vez de 403 para recursos ajenos para no revelar
  existencia: práctica común (p.ej. API de GitHub para repos privados);
  propuesto como D1, pendiente de decisión.
- Backlog: FK/constraint para `convertedJobId`; política de override de
  administrador con justificación auditada.

## 12. Gates de cierre

- [ ] D1–D7 resueltas por el owner y `status: APPROVED`
- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests negativos rojos contra `main` y verdes tras el cambio
- [ ] `pnpm spec:validate:strict` verde
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED` del servicio API
- [ ] Smoke autenticado de dos usuarios (§8) con evidencia sin PII
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`; #935 no se cierra por este slice

## 13. Decisiones pendientes para aprobación

| ID | Decisión | Recomendación | Alternativa |
|---|---|---|---|
| D1 | Código para FreeProject ajeno y para Job destino inválido | FreeProject ajeno = **404** (indistinguible de inexistente, igual que hoy el repo); Job inválido = **403** con mensaje único, coherente con `startTimer` | 403 para todo (revela existencia del FreeProject) |
| D2 | `status` en PATCH | **Rechazar con 400** cualquier `status`: el contrato Zod no lo tiene y ningún cliente lo envía; archivar = DELETE; restaurar = endpoint dedicado en S1 | Permitir sólo `active↔archived` al dueño (adelanta S1 sin su spec) |
| D3 | Reintento de convert con el mismo `jobId` | **200 idempotente** sin escritura ni audit (colas offline) | 409 también para el mismo Job |
| D4 | Auditoría | AuditLog awaited (patrón `jobs.service.ts:255`) con acciones audit-only `free_project.converted` / `free_project.archived`, registradas en `EVENT_CATALOG.md` dentro del PR de implementación | Sólo log estructurado en S0 y audit en S1 |
| D5 | `OPS_ADMIN` sobre FreeProjects ajenos | **Sin override** en S0: FreeProject es personal (`labor.engine-remediation` §3) | Override con justificación + audit (requiere su propio spec) |
| D6 | Datos existentes posiblemente afectados | Censo de **sólo lectura** (conteo de `converted` cuyo `convertedJobId` no resuelve a Job del tenant) ejecutado por el owner, sin PII ni mutación | No censar; sólo prevenir hacia adelante |
| D7 | Activación | **Sin flag**: control de seguridad activo al desplegar; rollback = revert | Flag de kill-switch (agrega superficie sin beneficio claro) |
