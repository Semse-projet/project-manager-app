# S0b — Integridad de asignaciones: lote atómico, idempotencia y cuadrillas
**SEMSE Project | 2026-10-26 | PR documental #1027 (Draft)**  
**Estado:** revisión estática y CONTRATO PROPUESTO; pruebas **NO EJECUTADAS**, código **SIN MODIFICAR**.  
**Relaciones:** S0-F05 / P-11 / BO-10 / S0a N01–N09. CI manual **AL FINAL** de la preparación y antes de merge.

## 1. Contexto AS-IS comprobado

Código consultado en `main`:
- `apps/api/src/modules/organizations/task-allocations.service.ts`;
- `apps/api/test/task-allocations.test.ts`;
- `apps/api/src/infrastructure/audit/audit.service.ts`;
- `packages/db/prisma/schema.prisma`.

El servicio `assign(actor, crewId, taskId, requestId, userIds, reason)`:
1. valida actor y crew activa en tenant y membership org; la vía supervisor
   legacy usa `supervisorUserId`; el refuerzo WORKER es parte de S0a;
2. busca `JobTask` por `id+tenantId+orgId` y estado no terminal;
   no comprueba `entityType="Crew" -> entityId===crew.id` en ese
   punto (mientras `createCrewTask` sí crea `JobTask` con
   `entityType="Crew", entityId=crew.id`);
3. valida `CrewMember.ACTIVE`, sin `Membership WORKER.ACTIVE`
   de destinatarios (S0a);
4. deduplica `userIds` e itera en un `for` sin `$transaction`
   envolvente visible, buscando asignación por
   `taskAllocation.findFirst({where:{taskId,userId}})`;
5. si hay asignación existente `ACTIVE` de **otra crew**, la
   devuelve como idempotente sin comprobar `existing.crewId===crew.id`;
   la respuesta puede contener `crewId` y datos de la otra crew;
6. si `existing.status==="RELEASED"`, la actualiza en la misma fila
   para `crewId=crew.id` (transferencia de historial en lugar de
   crear un nuevo ciclo de asignación);
7. crea una auditoría por destinatario después de cada persistencia.

La base define `TaskAllocation @@unique([taskId,userId])`:
**una persona solo puede tener una fila por tarea, sin separar crews
ni ciclos históricos**. `taskId` debe seguir apuntando a una única
`JobTask`; no duplicar tareas solo para resolver el problema.

`AuditService.append()` usa `ActorContextService.ensureActorContext()`
y `prisma.auditLog.create()` sobre el Prisma inyectado, no acepta
un cliente de transacción. Por tanto, poner `$transaction` alrededor
del bucle **no basta** para asegurar atomicidad entre asignación y
auditoría: requiere reconciliar la infraestructura de auditoría
sin perder seguridad de actor, claves ni contratos existentes.

La suite actual cubre idempotencia en la **misma crew** (AC-04),
reapertura después de RELEASED (AC-06), tareas canónicas (AC-09),
pero no verifica asignación existente de distinta crew, falla tardía,
dos llamadas concurrentes o tarea interna de otra crew.

**Alcance de este documento:** riesgos deducidos por lectura; no
se verificó comportamiento por pruebas ni existe evidencia de
explotación en producción. El flag BO-10 figura INACTIVE en su spec;
no afirmar valor real de Railway.

## 2. Hallazgos adicionales propuestos

### S0-F06 — Reutilización inter-cuadrilla de la misma asignación (alta)

Escenario: usuario `ana` es miembro legítimo de `c1` y `c2`,
`task1` es visible en orgA; asignación `(task1,ana,c1,ASSIGNED)`.
El supervisor de c2 solicita `assign(c2,task1,[ana])`.
El `findFirst` encuentra la fila c1 y, como no está RELEASED,
la devuelve sin cambio. Esto puede exponer datos de c1 a c2 o producir
la falsa impresión de que c2 recibió una asignación. No resuelto
por el índice único global de `taskId,userId`.

**Política segura propuesta para MVP:** si existe una asignación de
esa tarea/persona en otra crew, no devolverla como idempotente
ni cambiarla silenciosamente. Responder conflicto `409` acotado,
sin datos de la otra crew. Una transferencia debe ser explícita,
autorizada, auditada, con motivos y secuencia de release/reassign
reconciliada por el dueño de recurso. **Requiere aprobación de BO-10**.

### S0-F07 — Alcance de tareas internas a crew (alta)

Si `JobTask.entityType==="Crew"`, el `entityId` ya marca la crew
canónica. Con las consultas actuales, un supervisor c2 podría
intentar asignar esa tarea a miembros de c2 siempre que
`orgId` coincida. **Recomendación:** negar con 404 tareas
`Crew` originadas en otra crew. Para futuras tareas org-wide,
permitir asignación multi-crew solo si hay policy empresarial y
alcance explícito; no convertir todas las tareas de la Org
en visibles a cada supervisor.

### S0-F08 — Escrituras parciales y auditoría fuera del lote (alta)

Si asignar a `ana` se confirma y crear la asignación de `bob`
falla, puede permanecer la primera mutación y su auditoría,
aunque la petición HTTP en su conjunto falle. La validación
completa de S0a antes del bucle evita miembros inelegibles,
pero **no** evita excepciones tardías DB, concurrencia,
revocación durante operación o error de AuditService.

**Propuesta de contrato del lote:** `all-or-nothing` para una
sola petición; la respuesta exitosa contiene exactamente los
destinatarios deduplicados; errores devuelven cero nuevas
asignaciones, cero reaperturas y cero audit de éxito.
No manipular horas/pagos, y no usar saga silenciosa.

### S0-F09 — Concurrencia y unicidad (media-alta)

Dos peticiones simultáneas de asignar misma `(taskId,userId)`
pueden observar ausencia de fila y competir en `create`;
el índice `@@unique` impide duplicar pero una petición
puede fallar por `P2002` en lugar de responder con el
resultado idempotente esperado. Retry debe obtener el
estado final solo si la fila está en la **misma crew y mismo
alcance**; de otra crew no se retorna contenido ajeno.

### S0-F10 — Estado de reasignación/custodia (pendiente de decisión)

`RELEASED -> ASSIGNED` en la misma fila conserva identidad
`TaskAllocation.id`, pero el estado anterior y su secuencia no
quedan versionados en dicha tabla. Existe AuditLog de transición,
pero el historial completo de custodias/reasignaciones debe
seguir siendo recuperable, sobre todo si cambia de crew.
En S0b no rediseñar histórico: exigir auditoría íntegra y
definir transferencia como un slice separado si se requiere
versionado de ciclos.

## 3. Matriz de pruebas S0b (nuevas N10–N18)

| ID | Fixture y operación | Resultado esperado (propuesto) |
|---|---|---|
| N10 | `assign(c1,task1,[ana,bob])`, bob provoca fallo de escritura tardío | Ninguna mutación ni audit de éxito sobre ambos; petición fallida |
| N11 | revocación confirmada antes del commit de assign | Abortar sin asignaciones posteriores a revocación y sin audit de éxito |
| N12 | dos asignaciones simultáneas idénticas en c1 | Una fila; respuestas idempotentes, sin audit duplicado |
| N13 | ana ya tiene ASSIGNED `task1` en c1; c2 solicita misma pareja `task1+ana` | `409`, sin DTO de c1, sin cambiar crew ni reabrir |
| N14 | tarea interna `entityType:Crew,entityId:c1`; c2 con supervisor propio intenta assign | `404`, aunque ambas crews sean orgA |
| N15 | fila `RELEASED` vinculada a c1; c2 intenta reabrirla | No cambiar `crewId` silenciosamente; conflicto/flujo de transferencia explícita |
| N16 | `P2002` por carrera mismo task/persona misma crew | Reconsultar y responder resultado legítimo o `409` determinista, no 500 |
| N17 | falla AuditLog luego de escribir assignment | Rollback de escrituras de negocio, no audit de éxito parcial |
| N18 | usuario tiene WORKER ACTIVE en orgA y en orgB con dos crews | Búsqueda y mutación limitadas a tenant/org/crew correctos, sin obtener asignación de otra Org |

**No inferir PASS.** Primero tests rojos; luego cambios de código
con spec BO-10 aplicable APPROVED y prueba de integración
PostgreSQL real sobre índices `taskId,userId`.

## 4. Decisiones de dominio por ratificar

1. **D-S0B-01:** un mismo `JobTask` de origen `Crew` pertenece a
   una crew; queda vedada a supervisores de otra crew por defecto.
2. **D-S0B-02:** si existe un `TaskAllocation` vigente para
   `taskId+userId` en otra crew, devolver conflicto neutral 409
   en vez de respuesta idempotente o transferencia implícita.
3. **D-S0B-03:** `assign([...])` es una operación atómica
   todo-o-nada; un error DB/audit no deja asignaciones parciales.
4. **D-S0B-04:** reasignación/traslado entre cuadrillas
   requiere acción explícita y aprobación empresarial adicional;
   no se interpreta `RELEASED` como permiso para cambiar crew.
5. **D-S0B-05:** conservar `@@unique([taskId,userId])` en
   S0b y no crear otro `JobTask`; si el negocio necesita
   una misma persona en múltiples crews sobre una misma tarea
   simultáneamente, diseñar cambio de modelo con ADR y migración
   independientes antes de autorizarlo.

Si se prefiere *partial success* por lote, se necesita contrato
alternativo (207/resultados individuales, idempotency/compensación)
y UI que muestre cada parcial; **no** reinterpretar un HTTP failure
como éxito parcial invisible. La opción todo-o-nada se recomienda
por simplicidad y seguridad operativa.

## 5. Diseño de implementación orientativo (NO AUTORIZADO)

- S0a primero: membership WORKER ACTIVE, recurso/actor/elegibilidad.
- S0b tests N10–N18 en
  `apps/api/test/task-allocations.test.ts`, complementados
  con integración PostgreSQL (mock in-memory no garantiza
  SQL, serialización, constraints, CAS ni rollback).
- Guard de origen `JobTask`: si entidad Crew, aplicar
  `entityId===crew.id` o permiso de negocio excepcional
  especificado. El lookup siempre acotado por tenant+org.
- Buscar `TaskAllocation` por `taskId,userId` y **validar
  tenantId+orgId+crewId** de la fila recuperada *antes*
  de DTO, reapertura o idempotencia; 409/404 neutros
  de acuerdo con visibilidad.
- Definir serialización/retries con `P2002` y race
  release/assign usando transacciones y CAS;
  evitar afirmar idempotencia sin probar dos peticiones paralelas.
- Diseñar vía de auditoría compatible con transacción Prisma:
  `AuditService.append` hoy usa `this.prisma`, no el
  `tx` recibido por `$transaction`. Reconciliar con
  `ActorContextService.ensureActorContext` sin escribir
  fuera de transacción ni omitir audit. Evaluar adaptador
  `audit.appendInTransaction(tx, ...)` mediante contrato
  reusable, sin duplicar formato ni bypass de auth,
  **solo tras revisión de seguridad**.
- No agregar eventos sin registro en `EVENT_CATALOG.md`.
- Mantener `SEMSE_TASK_ALLOCATION_ENABLED` OFF
  donde corresponda hasta canary autorizado.
- Retrocompatibilidad: no alterar `JobTask`, Evidence,
  TimeEntry, Payment Governance, ni otras asignaciones
  legales existentes sin plan de compatibilidad probado.
- Documentar rollback/forward-fix de datos; no usar `db push`
  en producción.

## 6. Gates

- [x] Revisión estática del comportamiento y schema actual.
- [x] Contrato escrito para casos N10…N18.
- [ ] Ratificación D-S0B-01…05 y reconciliación con spec BO-10.
- [ ] BO-10/SDD aplicable APPROVED antes de implementación.
- [ ] Tests rojos y luego verdes con PostgreSQL real.
- [ ] Integridad de AuditLog comprobada y cobertura de carreras.
- [ ] Revisión de seguridad y tests locales completos.
- [ ] **CI manual al final de preparación, antes de merge**.
- [ ] Merge autorizado, staging aislado, smoke y producción por separado.

**Conclusión:** riesgos **documentados**, no cerrados. Esta rama
solo contiene documentos; no hay cambio operativo, migración,
despliegue ni evidencia de pruebas ejecutadas.
