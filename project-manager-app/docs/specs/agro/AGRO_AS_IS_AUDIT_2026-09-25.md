# SEMSE Agro — Auditoría AS-IS, gap matrix y arquitectura de consolidación

Fecha: 2026-09-25
Alcance: `project-manager-app/` (monorepo canónico)
Regla de trabajo: Auditar → consolidar → completar → extender.

Este documento es la Fase 0 de la consolidación de Semse Agro. Todo lo que se
afirma aquí está verificado contra el código en la fecha indicada (rutas y
líneas reales), no contra documentos de visión. Las clasificaciones usan:

| Etiqueta | Significado |
|---|---|
| REAL | DB → servicio → API → BFF → UI conectados y con tests unitarios |
| PARTIAL | Existe la cadena pero con huecos funcionales o de validación |
| UI_ONLY | Pantalla sin backend propio (localStorage o reutiliza otra entidad) |
| BACKEND_ONLY | Modelo + servicio + endpoint sin BFF/UI |
| DESIGNED_ONLY | Columnas/documentos que nada escribe todavía |
| DUPLICATED | Capacidad que existe en paralelo en SEMSE Core |
| LEGACY | Vigente pero con convergencia decidida hacia otro modelo |

---

## 1. Inventario AS-IS

### 1.1 Modelos Prisma (`packages/db/prisma/schema.prisma`)

| Modelo | Uso real | Notas |
|---|---|---|
| `AgroFarm` | REAL | Aislamiento por `ownerId` (sin `tenantId`, sin `orgId`). |
| `AgroFarmUnit` | REAL | `type` string libre validado en servicio. |
| `AgroAnimal`, `AgroAnimalGroup` | REAL | Timeline vía `AgroAuditEvent`. |
| `AgroFarmTask` | REAL + LEGACY | Modelo vivo de tareas Agro; convergencia decidida hacia `JobTask`. |
| `AgroInventoryItem`, `AgroInventoryMovement`, `AgroCostEntry` | REAL | `relatedTaskId` polimórfico a `AgroFarmTask`. |
| `AgroEvidenceItem` | REAL + DUPLICATED | Evidencia Agro paralela a `Evidence` (ver §3). |
| `AgroAuditEvent` | REAL + DUPLICATED | Auditoría Agro paralela a `AuditLog` (ver §3). |
| `AgroProductionRecord`, `AgroSaleRecord` | REAL | Economía F1. |
| `AgroProductionCycle`, `AgroCropCycle`, `AgroInputApplication`, `AgroHarvestRecord` | BACKEND_ONLY | Sin BFF ni UI. |
| `AgroTraceabilityEvent`, `AgroComplianceCheck` | BACKEND_ONLY | Sin BFF ni UI. |
| `JobTask` columnas Agro (`farmId`, `taskType`, `targetType`, `domain`…) | DESIGNED_ONLY | Ningún código escribe `domain = "agro"`. Comentario del schema: "Fase 3 will migrate AgroFarmTask here". |
| `Evidence.farmId` / `mediaType` / `capturedById` | DESIGNED_ONLY | Ningún código escribe evidencia canónica con `farmId`. `Evidence.projectId` es obligatorio, lo que impide usarla sin proyecto. |

No existían antes de este trabajo: membresía de finca, taxonomía de oficios
Agro, capacidades de trabajador, verificación de capacidades ni incidencias Agro.

### 1.2 API (`apps/api/src/modules/agro/`, 30 archivos, ~4.6k líneas)

Nueve controllers bajo `v1/agro`: farm, animal, task, inventory, evidence,
dashboard (+ `sync/events` + `audit-report`), production-cycle, traceability,
economics. Todos protegidos con `agro:read` / `agro:write`.

Patrón de autorización uniforme: `farm.ownerId === ctx.userId`, si no → 404.
Consecuencia: **solo el propietario puede operar una finca**. No hay forma de
que un trabajador, capataz o veterinario acceda a datos de una finca ajena.

### 1.3 Web (`apps/web/app/agro/**`, 27 archivos, ~7.2k líneas; BFF en `apps/web/app/api/semse/agro/**`, 45 rutas)

| Pantalla | Fuente de datos | Clasificación |
|---|---|---|
| `/agro` (lista fincas), dashboard, animales, grupos, detalle animal/grupo | API | REAL |
| tareas, calendario, salud | API (`AgroFarmTask`) | REAL (salud = tareas filtradas por tipo) |
| inventario, costos, producción, ventas, rentabilidad, simulador, analítica | API | REAL |
| evidencia, auditoría | API (`AgroEvidenceItem`, `AgroAuditEvent`) | REAL |
| alimentación (`feeding`) | API inventario + **plan de raciones en `localStorage`** | PARTIAL / UI_ONLY |
| reproducción | API tareas con tipos `BREEDING`, `PREGNANCY_CHECK`, `BIRTH`, `WEANING`, `HEAT_DETECTION` | **ROTO** (el API rechaza esos tipos con 400) |
| infraestructura | API unidades con tipos `PADDOCK`, `MILKING_AREA`, `FEEDLOT`, `QUARANTINE`, `SCALE` | **ROTO** para esos 5 tipos (400) |
| `/admin/verticals/agro` | `GET /api/semse/agro` (fincas del propio admin) | PARTIAL: lee `location/farmType/hectares/status`, campos que `AgroFarm` no tiene; no ve fincas ajenas |
| `/demo/agro` | rol `DEMO_AGRO` | REAL (sandbox) |

Mobile (`apps/mobile`): **no hay ninguna pantalla Agro**. El offline de Agro
vive en web (`agroLocalStore.ts` + `AgroSyncProvider` → `POST v1/agro/sync/events`).

### 1.4 Integraciones

| Integración | Estado | Evidencia |
|---|---|---|
| JobTask / TaskOps | DESIGNED_ONLY | columnas Agro en `JobTask`; nada las escribe ni lee |
| EvidenceOps (`Evidence`) | DESIGNED_ONLY | `Evidence.farmId` sin escritores; Agro usa `AgroEvidenceItem` |
| AuditLog | DUPLICATED | Agro usa `AgroAuditEvent`; `AuditLog.tenantId` es obligatorio y `AgroFarm` no tiene tenant |
| Usuarios / profesionales | Parcial | solo `ownerId`, `assignedToId`, `capturedById` como strings; `ProfessionalCredential`/`WorkerApplication` son de construcción/jobs, sin relación con Agro |
| Organizaciones / tenants | Ausente | `AgroFarm` no pertenece a `Org` ni `Tenant` |
| Prometeo | PARTIAL | 11 tools `agro.*` en `prometeo-tool-registry.ts`; **2 rotas**: `/v1/agro/farms/:farmId/inventory` y `/v1/agro/farms/:farmId/cost-summary` no existen (reales: `/inventory/items`, `/costs/summary`) |
| Offline sync | REAL | `AgroSyncService` con idempotencia por `clientEventId` |
| Eventos de dominio | Ausente | `EVENT_CATALOG.md` no tiene eventos Agro; Agro no usa outbox |
| RBAC | PARTIAL | `WORKER` no tiene ningún permiso `agro:*` |

### 1.5 Tests existentes

`apps/api/test/agro-*.service.test.ts` (10 archivos, servicios con stubs) y
`tests/unit/agro-*.test.ts` (6, copias casi idénticas). Sin tests de
integración con DB ni E2E Agro.

---

## 2. Relaciones rotas UI → API → DB

| # | Origen | Destino | Rotura | Acción en esta consolidación |
|---|---|---|---|---|
| R1 | `agro/[farmId]/reproduction` | `POST v1/agro/farms/:id/tasks` | Tipos de tarea reproductivos no aceptados → 400 | **Corregido**: tipos añadidos a servicio, controller y tool de Prometeo |
| R2 | `agro/[farmId]/infrastructure` | `POST v1/agro/farms/:id/units` | 5 tipos de unidad no aceptados → 400 | **Corregido**: tipos añadidos |
| R3 | Prometeo `agro.list_inventory` | `/v1/agro/farms/:farmId/inventory` | Ruta inexistente | **Corregido** → `/inventory/items` |
| R4 | Prometeo `agro.get_cost_summary` | `/v1/agro/farms/:farmId/cost-summary` | Ruta inexistente | **Corregido** → `/costs/summary` |
| R5 | BFF `api/semse/agro/production/[recordId]` | `v1/agro/production/:id` | Ruta inexistente en API | Documentado (no se usa desde UI) |
| R6 | `/admin/verticals/agro` | `AgroFarm` | Campos inexistentes y alcance por owner | Documentado (requiere decisión de acceso admin cross-owner) |
| R7 | Rol `WORKER` | `v1/agro/*` | Sin permisos Agro | **Corregido** para lectura y reporte de campo (ver §5) |
| R8 | Controllers Agro existentes | `schema.parse(body)` | Un body inválido lanza `ZodError` (no es `HttpException`) → **500** en vez de 400 | Controllers nuevos usan `parseWithSchema` (400). Los existentes quedan documentados (cambio de comportamiento fuera de alcance) |
| R9 | Miembros de finca | `farms/:id/units`, `animal-groups`, `animals`, `tasks` | Solo el propietario accede: un trabajador no puede elegir contexto ni completar tareas | Nuevo `GET farms/:farmId/incidents/context` para miembros. Pendiente: migrar los servicios existentes a `AgroFarmAccessService` (§7.2) |

---

## 3. Duplicaciones Agro ↔ SEMSE Core

| Capacidad | Core | Agro | Decisión |
|---|---|---|---|
| Auditoría | `AuditLog` (requiere `tenantId`) | `AgroAuditEvent` (por `farmId`, alimenta timelines) | No se crea un tercer sistema. Todo lo nuevo audita en `AgroAuditEvent` vía `AgroAuditRepository`. Convergencia a `AuditLog` bloqueada hasta que `AgroFarm` tenga tenant. |
| Evidencia | `Evidence` (requiere `projectId`) | `AgroEvidenceItem` | No se crea otro subsistema. Verificaciones e incidencias referencian `AgroEvidenceItem` (nuevos `entityType`). Migración a `Evidence` = Fase 2 de evidencias, requiere `projectId` opcional. |
| Tareas | `JobTask` (canónico, columnas Agro listas) | `AgroFarmTask` | Nuevos módulos referencian tareas por `AgroTaskRef {source, id}` y resuelven ambas fuentes. Ningún módulo nuevo tiene FK a `AgroFarmTask`. |
| Incidencias | `JobIncident` (requiere `jobId`), `MissionControlIncident` (postura IA) | — | Ninguna encaja: una incidencia de finca no tiene job. `AgroIncident` es nuevo, pero audita/evidencia/tareas se delegan a lo existente. |
| Capacidades de persona | `ProfessionalCredential.specialties` (JSON libre, construcción) ; `Capability` (registro de madurez de *features*, no de personas) | — | Ninguno modela capacidades de trabajador verificables. `AgroCapability` + `AgroWorkerCapability` son nuevos y referencian `User.id` (no duplican usuarios). |
| Membresía | `Membership` (User↔Org↔Role global) | — | Las fincas no pertenecen a Orgs y los roles globales no expresan "capataz"/"veterinario de finca". `AgroFarmMember` es la membresía de recurso de la finca. |

---

## 4. Gap matrix (capacidad solicitada → estado → cierre)

| Capacidad | Antes | Después de este trabajo |
|---|---|---|
| Acceso multiusuario a finca | Ausente | `AgroFarmMember` + `AgroFarmAccessService` (REAL, solo módulos nuevos) |
| Taxonomía de oficios (rol/especialidad/capacidad) | Ausente | `AgroRole`, `AgroSpecialty`, `AgroRoleSpecialty`, `AgroCapability` jerárquica + seed |
| Capacidades del trabajador con nivel/estado | Ausente | `AgroWorkerCapability` (BASIC…EXPERT; SELF_REPORTED…EXPIRED/REVOKED) |
| Verificación con evidencia y auditoría | Ausente | `AgroCapabilityVerification` append-only + `AgroEvidenceItem` + `AgroAuditEvent` |
| Incidencias operativas | Ausente | `AgroIncident` + FSM + timeline sobre `AgroAuditEvent` |
| Relación incidencia ↔ tarea canónica | Ausente | `AgroTaskRef` (AGRO_FARM_TASK \| JOB_TASK) |
| UI Workforce / Incident Center / reporte móvil | Ausente | Páginas web responsive bajo `/agro/[farmId]/…` |
| Prometeo Agro operacional | Solo lectura + `create_task` | Intake determinista: texto → propuesta → revisión humana → endpoints normales |
| Mobile nativo Agro | Ausente | **Pendiente** (el flujo de reporte es web responsive) |
| Transcripción de audio / visión | Ausente | **Pendiente** (el intake recibe texto; el audio se adjunta como evidencia) |
| JobTask `domain="agro"` como escritura | DESIGNED_ONLY | **Pendiente** (plan §7, sin migración destructiva) |

---

## 5. Arquitectura propuesta (ajustada al código real)

```txt
                          ┌───────────────────────── SEMSE Core ─────────────────────────┐
                          │ User · RBAC (packages/auth) · JobTask · (AuditLog/Evidence)  │
                          └───────────▲───────────────────▲──────────────────────────────┘
                                      │ userId            │ AgroTaskRef{JOB_TASK}
┌──────────────────────────── apps/api/src/modules/agro ─────────────────────────────────┐
│ AgroFarm ──< AgroFarmMember(role)            AgroFarmAccessService + agro-farm-policy   │
│    │                                                                                    │
│    ├── Workforce: AgroRole >─< AgroSpecialty ──< AgroCapability(parentId)               │
│    │              AgroWorkerRole · AgroWorkerCapability ──< AgroCapabilityVerification  │
│    ├── IncidentOps: AgroIncident → unit/animal/group/crop/inventory · AgroTaskRef       │
│    ├── Evidencia: AgroEvidenceItem(entityType INCIDENT | WORKER_CAPABILITY | …)         │
│    ├── Auditoría/timeline: AgroAuditEvent (una sola vía: AgroAuditRepository)           │
│    └── Prometeo Agro: AgroIntakeService (buscar → relacionar → completar → proponer)    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

Decisiones:

1. **Aislamiento.** Se respeta la estrategia real: la finca es la frontera
   (owner-scoped). No se añade `tenantId` a los modelos nuevos porque ningún
   modelo Agro lo tiene y no habría contra qué validarlo. El propietario sigue
   siendo implícito (`AgroFarm.ownerId`); el resto de actores entra por
   `AgroFarmMember` con estado `ACTIVE`.
2. **Autorización en dos capas.** RBAC global (`@RequirePermissions`) +
   política de recurso por rol de finca (`agro-farm-policy.ts`, función pura
   testeada). Nuevos permisos mínimos: `agro:report` (reporte de campo),
   `agro:workforce:verify` (verificar capacidades), `agro:workforce:admin`
   (catálogo de taxonomía). `WORKER` recibe `agro:read` + `agro:report`.
   `DEMO_AGRO` no se toca.
3. **Taxonomía global, extensible.** Catálogo sembrado en la migración
   (`isSystem = true`), ampliable por `agro:workforce:admin`. La jerarquía
   Producción animal → Porcinos → Maternidad → Porcicultor → Manejo de lechones
   → Alimentación se expresa como `sector` + `species` en especialidad, M:N rol
   ↔ especialidad y `parentId` en capacidades.
4. **Capacidades por persona, verificación por finca.** La capacidad es
   portable (única por `userId + capabilityId`); cada verificación registra la
   finca, el verificador, el rol con el que verificó, método, resultado,
   evidencia y queda en `AgroAuditEvent`. Nadie puede auto-verificarse; una
   capacidad `requiresProfessional` solo la verifican roles profesionales.
5. **Tareas.** Referencia por `AgroTaskRef {source, id}` resuelta por
   `AgroTaskRefResolver`, que acepta `AgroFarmTask` (vigente) y `JobTask` con
   `domain = "agro"` y `farmId` coincidente (canónico).
6. **Prometeo no diagnostica.** El intake devuelve una propuesta con
   `requiresHumanReview: true` y severidad *sugerida* (`severityConfirmed =
   false` al persistir). Nunca escribe; la persistencia pasa por los endpoints
   normales, con auditoría y `source = "PROMETEO"`.

---

## 6. Permisos por actor

| Acción | OWNER | MANAGER | SUPERVISOR | WORKER | TECHNICIAN / SPECIALIST | VETERINARIAN / AGRONOMIST | OPS_ADMIN sin membresía |
|---|---|---|---|---|---|---|---|
| Ver incidencias / perfiles de la finca | ✔ | ✔ | ✔ | ✔ (incidencias; su propio perfil) | ✔ | ✔ | — |
| Reportar incidencia, comentar, adjuntar evidencia | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Clasificar, cambiar severidad, asignar, relacionar tarea | ✔ | ✔ | ✔ | — | — | — | — |
| Iniciar / resolver | ✔ | ✔ | ✔ | si es responsable | ✔ | ✔ | — |
| Evaluación profesional | — | — | — | — | ✔ | ✔ | — |
| Cerrar / reabrir / cancelar / duplicado | ✔ | ✔ | ✔ | — | — | — | — |
| Gestionar miembros | ✔ | ✔ | — | — | — | — | — |
| Asignar rol de oficio / capacidad a otro | ✔ | ✔ | ✔ | — | — | — | — |
| Autodeclarar capacidad | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Verificar / revocar capacidad estándar | ✔ | ✔ | ✔ | — | ✔ | ✔ | — |
| Verificar capacidad `requiresProfessional` | — | — | — | — | ✔ | ✔ | — |
| Gestionar catálogo de taxonomía | — | — | — | — | — | — | ✔ (`agro:workforce:admin`) |

---

## 7. Plan de migración

1. **Esta entrega (aditiva, sin tocar datos existentes).** Migración
   `20260925120000_agro_workforce_incidentops`: 9 tablas nuevas, seed idempotente
   de taxonomía, FKs `ON DELETE SET NULL`/`CASCADE` coherentes con Agro. Ninguna
   columna existente cambia; los servicios existentes mantienen el control
   owner-only.
2. **Membresía en servicios existentes (siguiente PR).** Sustituir
   `assertFarmAccess` owner-only de tareas/animales/evidencia por
   `AgroFarmAccessService` para que trabajadores miembros operen tareas.
   Requiere revisar cada acción mutante contra la matriz §6.
3. **Tareas → JobTask (progresivo).**
   a. Hoy: lectura dual vía `AgroTaskRefResolver` (hecho).
   b. Dual-write: `AgroTaskService.createTask` crea también `JobTask{domain:"agro"}` y guarda el vínculo.
   c. Backfill idempotente `AgroFarmTask → JobTask` con tabla puente.
   d. Cambiar lecturas web/sync/Prometeo a `JobTask`.
   e. Congelar `AgroFarmTask` (solo lectura) y documentar retirada. Nunca `DROP` sin confirmación explícita.
4. **Evidencia → `Evidence`.** Requiere `Evidence.projectId` opcional (cambio de
   Core, fuera de alcance Agro). Mientras tanto `AgroEvidenceItem` es la
   evidencia Agro canónica.
5. **Auditoría → `AuditLog`.** Requiere `AgroFarm.tenantId`/`orgId` con backfill
   desde el owner. Tras ello, `AgroAuditRepository.record` puede escribir en
   ambos durante una ventana de transición.
6. **Eventos de dominio.** Añadir `agro.incident.*` / `agro.capability.*` a
   `EVENT_CATALOG.md` antes de emitir por outbox (no se inventan nombres aquí).
