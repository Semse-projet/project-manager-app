# S0a — Contrato de pruebas negativas para supervisores y asignaciones

**SEMSE Project · Corte: 2026-10-25**  
**PR documental:** #1027 · **Estado:** PROPUESTA TÉCNICA / NO EJECUTADA  
**Alcance:** P-07…P-10, hallazgos S0-F01…F04 y casos N01…N09.

> Este documento prepara el primer parche de seguridad, pero no autoriza
> implementación, migraciones, merge, despliegue ni activación. El SDD continúa
> DRAFT y OPEN-SUP-02…06 siguen pendientes de ratificación.

## 1. Objetivo y frontera

S0a debe cerrar privilegios residuales del modelo legacy sin introducir todavía
`OrgAuthorityGrant` ni `CrewSupervisorDelegation`. La corrección mínima debe:

1. exigir una `Membership WORKER ACTIVE` efectiva para operar como supervisor;
2. exigir `Membership WORKER ACTIVE` + `CrewMember ACTIVE` al destinatario de
   una asignación;
3. revalidar pertenencia y recursos vigentes en `listMine` y `updateStatus`;
4. preservar a gestores legítimos que ya tengan `org:crews:manage`, sin
   convertir ese permiso en prueba de propietario/representante;
5. mantener aislamiento por tenant/org/crew y no alterar TimeEntry, Evidence,
   Payment Governance ni la clasificación W-2/1099.

## 2. Semántica de rechazo propuesta

| Situación | HTTP/resultado | Motivo |
|---|---:|---|
| Recurso de otro tenant, otra Org o crew no visible/archivada | `404` | No revelar existencia ni estado del recurso. |
| Actor fue supervisor, pero ya no conserva WORKER ACTIVE | `404` en rutas exclusivas de supervisor | La autoridad dejó de existir; no exponer roster/tareas. |
| Actor pertenece a la Org pero carece de capacidad vigente para la acción | `403` | Recurso visible, acción no autorizada. |
| Destinatario visible de la misma crew, pero sin WORKER ACTIVE | `422` | La solicitud es válida sintácticamente, pero el destinatario no es elegible. |
| Transición propia inválida con acceso vigente | `422` | Conservar la FSM actual, separado de autorización. |

Todo rechazo debe producir **cero cambios** en `JobTask`, `TaskAllocation`,
`Crew`, `CrewMember`, `TimeEntry`, Evidence y pagos. No debe emitir audit/evento
de éxito. Si existe auditoría de intento denegado, debe ser acotada, sin datos
sensibles y fuera de la transacción de negocio fallida.

## 3. Matriz N01…N09 normalizada

| ID | Preparación | Acción | Resultado esperado | Invariantes |
|---|---|---|---|---|
| N01 | `Crew.supervisorUserId=actor`; WORKER `SUSPENDED`; PRO `ACTIVE` en misma Org | `GET /v1/crews/:crewId/roster` | `404` | Sin roster ni identidad de miembros. |
| N02 | Igual N01; PRO no tiene una ruta de gestión aplicable a esa acción | crear/listar/asignar tarea como supervisor | `404` o `403` según visibilidad efectiva; nunca por `supervisorUserId` solo | Cero tarea/asignación/audit de éxito. |
| N03 | Destinatario `CrewMember ACTIVE`; WORKER `SUSPENDED` o `REVOKED` | asignar tarea | `422` | Cero asignaciones, incluso en lote; respuesta no revela otras membresías. |
| N04 | Asignación vigente; trabajador perdió WORKER ACTIVE | avanzar estado | `404` | Estado, timestamps y audit intactos. |
| N05 | Asignación vigente; `CrewMember REMOVED` | avanzar estado | `404` | Historial conservado; no nueva transición. |
| N06 | Asignación vigente; `Crew ARCHIVED` | avanzar estado | `404` | No reactivar crew ni allocation. |
| N07 | Cualquiera de N04–N06 | `GET /v1/task-allocations/mine` | lista filtrada sin la asignación revocada | Sin fuga de título, crew u Org; historial permanece en DB. |
| N08 | Gestor con Membership ACTIVE y permiso efectivo `org:crews:manage` en su Org | gestionar crew bajo rutas ya autorizadas | permitido según contrato BO-07/10 vigente | No obtiene por ello `org:supervisors:delegate` ni autoridad empresarial. |
| N09 | Actor tenant A; recurso tenant B, incluida colisión de IDs | cualquier lectura/escritura | `404` | Cero consulta/mutación posterior fuera del scope autorizado. |

La alternativa `403/404` de N02 debe resolverse por la ruta concreta: si el
actor no supera el lookup de recurso/autoridad de supervisor, `404`; si el
recurso es visible por una relación independiente y solo falta la capacidad de
acción, `403`. No usar diferencias de mensaje para revelar el estado de otra
Org.

## 4. Trazabilidad a código y pruebas

| Hallazgo | Código AS-IS | Prueba roja mínima | Corrección esperada |
|---|---|---|---|
| S0-F01 | `CrewsService.listMine/rosterForSupervisor`; `TaskAllocationsService.requireCrewScope` aceptan cualquier Membership ACTIVE | N01, N02 | helper común que compruebe WORKER ACTIVE para la vía supervisor; vía manager separada por permiso. |
| S0-F02 | `TaskAllocationsService.assign` comprueba `CrewMember.ACTIVE`, no WORKER | N03 | resolver elegibilidad por tenant+org+user y abortar el lote antes de la primera escritura. |
| S0-F03 | `TaskAllocationsService.listMine/updateStatus` filtran por tenant+user, sin crew/membership actual | N04–N07 | consultas con relaciones vigentes o policy común, conservando historial sin exponerlo. |
| S0-F04 | `org:crews:manage` existe en roles operativos | N08, N09 | no mezclar gestión de crew, supervisión delegada y autoridad empresarial. |

Los tests deben vivir junto a los contratos existentes en
`apps/api/test/crews-worksites.test.ts` y
`apps/api/test/task-allocations.test.ts`. La integración PostgreSQL/HTTP se
añade después de que los unitarios prueben el fallo y el parche mínimo lo
corrija. No declarar PASS por enumerar casos.

## 5. Orden de ejecución de S0a

1. Ratificar la semántica anterior dentro del SDD aplicable.
2. Añadir N01…N09 como tests rojos sin cambiar producción.
3. Extraer policy/helper común, manteniendo separadas las vías
   `supervisor WORKER ACTIVE` y `manager con permiso vigente`.
4. Corregir `assign` con validación completa previa al bucle; la atomicidad
   general N10…N12 pertenece a S0b.
5. Corregir `listMine/updateStatus` para acceso vigente y preservar historial.
6. Ejecutar unitarios dirigidos, integración PostgreSQL y revisión de seguridad.
7. Actualizar evidencia por SHA. CI manual permanece como último gate antes de
   merge; no se relajan ni omiten checks.

## 6. Gates por etapa

| Etapa | Estado | Condición de cierre |
|---|---|---|
| Diseño S0a | `PENDIENTE` | Semántica N01…N09 ratificada y reconciliada con BO-07/BO-10. |
| Implementación | `BLOQUEADA` | SDD aplicable APPROVED y tests rojos preparados. |
| Merge | `BLOQUEADO` | Tests locales, revisión independiente y CI terminal PASS sobre HEAD final. |
| Deploy/activación | `NO AUTORIZADO` | PR técnico fusionado, staging aislado, smoke autenticado y rollback probado. |

## 7. Evidencia no producida todavía

- No se ejecutaron tests, PostgreSQL, HTTP autenticado, UAT ni rollback.
- No se modificaron servicios, controladores, RBAC, Prisma, flags o Railway.
- No se verificó producción.
- No se cerraron S0-F01…F04: quedaron convertidos en un contrato ejecutable
  para el siguiente gate.
