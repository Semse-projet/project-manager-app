# SEMSE — Auditoría estática S0: autoridad de supervisor y asignaciones
**Fecha:** 2026-10-22  
**Referencia:** PR documental #1027 — `core.crew-supervisor-delegations` DRAFT  
**Método:** revisión de código fuente en `main` y suites existentes; **ninguna prueba ejecutada**.  
**Evidencia de runtime/producción:** NO_VERIFIED. Los flags de BO-07 y BO-10 figuran INACTIVE en sus specs; no se infiere estado real desde la revisión.

## 0. Resumen

La entrada a `CrewsService.createCrew` exige persona WORKER con
`Membership.status = ACTIVE` en la organización, pero otros flujos
aceptan cualquier membresía ACTIVE del mismo sujeto. Se detectan además
consultas y mutaciones de asignaciones que comprueban identidad/tenant
sin revalidar el estatus organizacional/crew al momento de la petición.

Este informe identifica **potenciales errores de autorización en el
código revisado**, no explotación confirmada ni exposición en producción.
El contrato BO-07/BO-10 sigue DRAFT; toda intervención sobre código debe
respetar SDD y los flags actuales.

## 1. Hallazgos localizados

### S0-F01 — Supervisor con WORKER suspendido y PRO aún ACTIVE (prioridad alta)

**Fuente:** `apps/api/src/modules/organizations/crews.service.ts`

- `createCrew` llama `assertActiveWorker`, que exige WORKER ACTIVE.
- `rosterForSupervisor` (aprox. L220–229) comprueba
  `crew.supervisorUserId`, pero solo requiere que
  `membership.findMany({ status: "ACTIVE", org... })` no esté vacío:
  no exige rol WORKER.
- `listMine` (L199–215) filtra su vista por cualquier membresía ACTIVE,
  por lo que todavía puede mostrar `myRole: SUPERVISOR`.

**Fuente:** `apps/api/src/modules/organizations/task-allocations.service.ts`

- `requireCrewScope` (aprox. L65–76) define
  `isSupervisor = crew.supervisorUserId === actor.userId`, con
  cualquier membership ACTIVE, y no comprueba WORKER vigente.
- Si una persona conserva PRO ACTIVE en esa misma org cuando pierde
  WORKER, el guard de supervisor todavía podría dar acceso.

**Verificación necesaria:** fixture mixto WORKER=SUSPENDED,
PRO=ACTIVE, crew.supervisorUserId=sujeto; roster 404; listMine sin etiqueta
SUPERVISOR; assign/release/list de otra persona denegados salvo permiso
independiente explícito `org:crews:manage` autorizado. **Importante:**
PRO actualmente tiene `org:crews:manage` en RBAC; distinguir el acceso
legítimo por ese permiso del acceso heredado solo por
`supervisorUserId`. No quitar facultades a gestores sin ratificar política.

### S0-F02 — Asignación a miembro cuyo WORKER ya no está ACTIVE (prioridad alta)

**Fuente:** `TaskAllocationsService.assign` (L141–196).

Se filtra `CrewMember.status = ACTIVE`; no se observa consulta a la
membresía WORKER vigente de cada destinatario antes de crear o
reabrir `TaskAllocation`. Una persona puede conservar `CrewMember.ACTIVE`
mientras su Membership es SUSPENDED/REVOKED.

**Prueba negativa:** CrewMember ACTIVE + WORKER SUSPENDED,
`assign` debe rechazar a esa persona sin crear ni reabrir asignación,
sin partial success en una petición con múltiples destinatarios.

### S0-F03 — Actualización de tarea propia tras revocación de Membership (prioridad alta)

**Fuente:** `TaskAllocationsService.updateStatus` (L230–259).

El selector por `id + tenantId + userId` protege la autoría de la
asignación, pero no vuelve a verificar Membership WORKER ACTIVE,
CrewMember ACTIVE ni Crew ACTIVE antes de cambiar de estado.
`listMine` (L221–227) también filtra solo `tenantId + userId`
y `status != RELEASED`; así puede mostrar tareas cuyo acceso
operativo caducó.

**Pruebas negativas:** tras suspension WORKER/retiro CrewMember/archivo
Crew, `updateStatus` deniega mutación y `listMine` no devuelve
información operativa ya no autorizada. Mantener auditoría y
historial a disposición del dueño/gestor autorizado: ocultar acceso
no equivale a eliminar registros.

### S0-F04 — Política de gestor vs. propietario: principio ratificado, prueba pendiente (bloqueador técnico)

**Fuente:** `packages/auth/src/rbac.ts` y
`TaskAllocationsService.requireCrewScope`.

Actualmente CLIENT, PRO y OPS_ADMIN pueden recibir `org:crews:manage`
en el scope de su Membership organizacional. `Org` no define
`ownerUserId` directo. Un PRO independiente que también gestiona su
empresa necesita poder administrar trabajadores, pero un PRO ajeno no
debe convertirse en propietario por solo figurar como miembro.

**Decisión ratificada el 2026-10-22:** solo el propietario o
representante autorizado y verificado de la Org puede nombrar o revocar
supervisores. Una Membership CLIENT/PRO/WORKER, `org:crews:manage`,
o el privilegio OPS_ADMIN no prueban por sí solos representación legal o
administrativa. **Permanece bloqueada la implementación:** falta diseñar
el origen canónico, verificación revocable y control server-side de esa
autoridad. No cambiar `org:crews:manage` globalmente como atajo.
La política actual de PRO gestor es diferente de la nueva autoridad
temporal de supervisor.

### S0-F05 — Riesgo transaccional en asignación múltiple (necesita prueba)

**Fuente:** `TaskAllocationsService.assign` (L153–196).

La función procesa destinatarios en un bucle con persistencia y
auditoría por persona. **No se observa transacción envolvente** que
garantice atomicidad de una petición con varios destinatarios.
Si uno falla después de haber creado anteriores, puede quedar
un subconjunto persistido; una revocación concurrente también
necesita política consistente. Evaluar si el contrato exige
semántica all-or-nothing o resultados parciales explícitos.

**Prueba:** lote [miembro válido, miembro suspendido] y excepción tardía
de DB: no producir cambios parciales invisibles ni auditar éxito
para operación finalmente abortada.

## 2. Suite actual: qué cubre y qué no

### `apps/api/test/crews-worksites.test.ts`

- Cubierto: crear supervisor WORKER ACTIVE, roster cross-crew,
  supervisor sin *ninguna* Membership ACTIVE.
- No cubierto: WORKER suspendido + PRO ACTIVE en misma org,
  actor de otra org con permisos de gestor, salida de trabajador
  sin revocación coordinada de CrewMember.

### `apps/api/test/task-allocations.test.ts`

- Cubierto: cross-crew, cross-tenant, trabajador suspendido sin otra
  Membership, tarea distinta, idempotencia, liberar, FSM de asignación.
- No cubierto: WORKER suspendido + PRO ACTIVE cuando supervisor,
  destinatario CrewMember ACTIVE/Membership WORKER SUSPENDED,
  actualizar tarea propia después de revocación, tareas de crew archivada
  con sesión antigua, error tardío en lote múltiple.

## 3. Matriz de tests rojos obligatorios antes del parche

| ID | Precondición | Acción | Resultado esperado | Invariante |
|---|---|---|---|---|
| N01 | Supervisor WORKER=SUSPENDED + PRO=ACTIVE | roster | 404 si autoridad exclusiva de supervisor | Sin privilegio residual |
| N02 | Igual, PRO sin autorización gerente efectiva | assign | 403/404 | No supervisor stale |
| N03 | CrewMember=ACTIVE, WORKER=SUSPENDED | asignar nueva tarea | 422, 0 mutaciones | Destinatario elegible |
| N04 | TaskAllocation activa, WORKER=REVOKED | updateStatus | 404/403, estado intacto | Membresía actual |
| N05 | TaskAllocation activa, CrewMember=REMOVED | updateStatus | 404/403, estado intacto | Pertenencia actual |
| N06 | TaskAllocation activa, Crew=ARCHIVED | updateStatus | 404/403, estado intacto | Recurso actual |
| N07 | Igual N04/N05/N06 | listMine | no exponer asignación ya inaccesible | Lectura revocada |
| N08 | Gestor PRO legítimo de su org | administrar su crew | permitir si policy vigente lo autoriza | No regresión |
| N09 | Actor tenant1 / crew tenant2 | cualquier operación | 404 | Aislamiento |
| N10 | Operación de lote y error tardío | asignar a 2 trabajadores | sin parcial silencioso | Atomicidad/contrato |
| N11 | Revocación confirmada antes de escritura | asignar/actualizar | denegar | Carrera segura |
| N12 | Reintento de asignación/revocación | repetir | 1 efecto + audit coherente | Idempotencia |

Códigos propuestos: 404 neutro para recurso/relación inaccesible,
403 para capacidad denegada sobre recurso propio, 422 para destinatario
inelegible y 409 para conflictos de versión. El contrato final debe
evitar revelar existencia de recursos ajenos.

## 4. Recomendación de separación de cambios

**S0a — parche mínimo de guardas, PR de código independiente:**
después de spec aprobada, reforzar elegibilidad efectiva de
supervisor y trabajador sin cambiar ownership ni crear tabla nueva.
Corregir lecturas `rosterForSupervisor`, `listMine`,
`TaskAllocationsService.requireCrewScope`, `assign`,
`listMine` y `updateStatus`; probar matriz N01-N09.

**S0b — atomicidad:** decidir semántica de lote, agregar
transaction/invariantes y pruebas N10-N12 en PR separado si
impacta demasiado la superficie de S0a. No alterar
`JobTask`, `TimeEntry`, Evidence, pagos ni contratos.

**S1-S4 — delegación explícita:** tras resolver propietario/representación
legal y OPEN-SUP-01…06, implementar grants temporales con policy
independiente, API, UI ES/EN y canary autorizado.

## 5. Bloqueos y siguiente gate

- [x] Ratificada OPEN-SUP-01: delegación exclusivamente por propietario
  o representante verificado (2026-10-22).
- [ ] Definir evidencia canónica y guardas de verificación del delegante;
  reconciliar `org:crews:manage` sin eliminar accesos legítimos de gestión.
- [ ] Determinar si revocación WORKER implica inhabilitar inmediatamente
  TaskAllocation y si se permite progreso posterior solo como registro
  histórico supervisado (propuesta: bloquear mutaciones normales).
- [ ] Acordar semántica all-or-nothing para lote de asignaciones.
- [ ] Ratificar spec, actualizar specs BO-07/BO-10 y checklist.
- [ ] Tests rojos reales, posteriormente patch mínimo y CI.
- [ ] PR técnico, review independiente, staging y activación por separado.

**Estado de esta revisión:** STATIC_ANALYSIS_ONLY. No se ejecutó build,
typecheck, tests, deploy, migración ni comando de producción.
