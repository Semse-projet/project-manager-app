# Auditoría de concurrencia de AgentRun — claim atómico (2026-11-07)

**Estado:** cambio propuesto, en rama separada. CI, merge, staging y producción pendientes.

## Contexto de la auditoría

Se comparó el runtime implementado con la capacidad deseada de continuidad robusta,
sin sustituir agentes ni herramientas. Se revisaron `AgentsRepository`,
`AgentsService`, `apps/worker/src/main.mjs`, y
`agent-run-reclaim-race.test.ts`.

## Hallazgo comprobado — P1: doble claim en el endpoint canónico

`AgentsRepository.claimNext` hacía `findFirst(status=QUEUED)` y luego
`update(where={id})` en la misma transacción. Bajo dos peticiones concurrentes
ambas pueden seleccionar un mismo run, y la segunda escritura no exige que siga
en `QUEUED`. Una transacción por sí sola **no** garantiza una reclamación
única bajo todo nivel de aislamiento.

### Corrección propuesta

Usar `updateMany` como compare-and-set, con predicados:
- `id`, `tenantId`, estado `QUEUED`, `deadLettered:false`,
  `attempts < maxAttempts` y filtro `agentType` opcional.
- Solo `count === 1` constituye reclamación exitosa.
- Leer de vuelta con `id`, `tenantId`, estado `RUNNING` y
  `workerId`. Si otra transición ocurrió, no devolver una falsa reclamación.
- La selección inicial conserva el orden cronológico y el mismo ámbito de tenant.
- No hay cambio de DB, rutas, contratos públicos, permisos o configuración.

### Pruebas de regresión añadidas

`apps/api/test/agent-run-claim-race.test.ts` cubre:
1. Dos intentos sobre la misma fila seleccionada: solo uno puede reclamarla.
2. Un cambio concurrente anterior al CAS produce `null`.
3. Run sin intentos restantes nunca se reclama.
4. Las condiciones de tenant, estado, dead-letter, rol y presupuesto
   figuran en la escritura condicional.

**Nota:** los tests usan doble de base de datos y no sustituyen pruebas
multi-Worker contra PostgreSQL real.

## Otro hallazgo — NO corregido por este PR

La ruta efectiva de `apps/worker/src/main.mjs` llama al endpoint `/start`,
no necesariamente al endpoint `/claim`. En `AgentsRepository.start`
un run ya `RUNNING` devuelve éxito sin comprobar reclamante. Las rutas
`complete` y `fail` tampoco exigen `workerId` como *fencing token*,
por lo que los resultados tardíos de un Worker desplazado podrían
sobrescribir los de su sucesor.

La corrección de claim **NO constituye exactly-once**. La próxima fase
debe introducir identidad/fencing de ejecuciones (sin romper compatibilidad)
y pruebas reales de inicio simultáneo, reclaim, cancelación y finalización
tardía antes de afirmar reanudación segura.

## Otros huecos verificables, aún sin remediation

- `chat-thread.store.ts` conserva el chat genérico solo en un `Map`
  del proceso. `AgentMemory` persistente no hace duradero ese historial.
- `AgentsService.reclaimStale` cambia la fila de BD a `QUEUED`,
  pero no reconcilia explícitamente el job en BullMQ.
- `AgentWorkPlanService.saveGraph` hace read-modify-write de todos los pasos
  sin comparación de versión: dos ediciones pueden pisarse.
- ADR-037 y ADR-039 clasifican rutas de roles y el verification loop que
  tienen código, pero no un disparador productivo equivalente.
- El Worker interpreta respuestas `denied` de ciertos runtimes como
  resultados a persistir; auditar clasificación terminal antes de cambiarla.

Estos puntos **no se atribuyen** a los dos huecos desconocidos señalados por
el propietario: todavía no hay evidencia para identificarlos.

## Gate previo a merge

1. Compilar API, ejecutar unit/coverage e integración Postgres.
2. Prueba de dos peticiones concurrentes reales al mismo tenant/run.
3. Verificar no regresión de `claimNext`, `reclaimStale` y cancelación.
4. Revisión humana de la semántica de lock y compatibilidad del Worker.
5. No desplegar hasta cerrar los riesgos que afectan a la ejecución efectiva.
