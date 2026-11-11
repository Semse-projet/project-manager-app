# Conway Automaton × SEMSE — comparación de código y primer endurecimiento

**Corte:** 2026-11-07  
**Estado:** cambio propuesto en PR DRAFT; CI, merge, deploy y verificación funcional **NO VERIFICADOS**.  
**Alcance:** solo SEMSEproject. Omniverse sigue siendo otro repositorio y otra autoridad.  
**Objetivo:** aprovechar una mejora verificable de Automaton sin sustituir agentes ni duplicar servicios.

## Fuentes examinadas

- Conway Automaton, commit `d8f816881fd24b6f5e3d616e59edec387a447667`:
  [task-graph.ts](https://github.com/Conway-Research/automaton/blob/d8f816881fd24b6f5e3d616e59edec387a447667/src/orchestration/task-graph.ts),
  [scheduler.ts](https://github.com/Conway-Research/automaton/blob/d8f816881fd24b6f5e3d616e59edec387a447667/src/heartbeat/scheduler.ts),
  [loop-detector.ts](https://github.com/Conway-Research/automaton/blob/d8f816881fd24b6f5e3d616e59edec387a447667/src/agent/loop-detector.ts).
- SEMSE `main` de comparación: `99d06d02fb8498d2b8e4e824abde6c0b0bc561e5`.
- Contratos existentes: `docs/specs/api/agents.spec.md` (Plan Mode y lifecycle),
  `docs/specs/agents/SEMSE_AGENT_ARCHITECTURE.spec.md`, constitución y
  `docs/SOURCE_OF_TRUTH.md`.
- Automaton está bajo licencia MIT. Este cambio **no importa ni copia** código del proyecto externo;
  reproduce independientemente un invariante general de grafos.

## Matriz de convergencia (código, no afirmaciones de producción)

| Idea en Automaton | Equivalente en SEMSE | Decisión |
| --- | --- | --- |
| Grafo de tareas: dependencias, validación de ciclos y referencias | `AgentWorkPlanService` + `PlanExecutionService` contienen pasos y dependencias; al inicio no se encontró validación previa a la persistencia | **ADAPTAR:** impedir ciclos, IDs repetidos y referencias inexistentes |
| Scheduler durable: leases, timeout y reintentos | `AgentQueueService` usa BullMQ/Redis; `AgentsRepository.reclaimStale` y sus pruebas gestionan tareas obsoletas | **REUTILIZAR, NO REEMPLAZAR**. Medir recuperación end-to-end antes de extender |
| Memoria y recuperación de contexto | `AgentMemoryService`, `AgentMemoryRepository`, `WorkspaceMemoryRepository`, inyección de contexto y gobernanza C85 | **REUTILIZAR**. No crear otro almacén de memoria |
| Coordinación/delegación | `CoordinatorService`, `AgentDelegationService`, planes y aprobaciones | **REUTILIZAR**. No crear nuevos agentes ni otro orquestador |
| Políticas y aprobación para operaciones sensibles | `AgentPolicyService`, `AgentApprovalService`, `PlanToolPolicyService`, Tool Registry | **MANTENER AUTORIDAD CANÓNICA**. No permitir auto-merge, pagos ni cambios productivos |
| Detección de repeticiones de llamadas y turnos | `loop-detector.ts` externo; falta una prueba comparativa de todos los caminos internos de tools en SEMSE | **INVESTIGAR DESPUÉS**, sin introducir un guard global a ciegas |
| Routing/budgets de modelos | SEMSE ya tiene proveedores LLM, orquestadores y componentes de presupuesto de tokens | **VALIDAR INTEGRACIÓN**, sin añadir un router paralelo |

## Primer cambio acotado: invariante DAG para Plan Mode

**Defecto comprobado por lectura:** `AgentWorkPlanService.create()` aceptaba dependencias
arbitrarias; `saveGraph()` podía grabar un ciclo de dependencias; `approve()`
no comprobaba si esas dependencias podían resolverse. Un ciclo A→B→A haría que
`PlanExecutionService.evaluateStepReadiness()` bloqueara ambos pasos.

**Corrección propuesta:**
- `assertValidPlanDependencies()` comprueba IDs repetidos, referencias inexistentes,
  autorreferencias y ciclos (recorrido topológico iterativo O(V+E)).
- Validar antes de `create`, de `approve` y al modificar la **definición**
  con `saveGraph`. No realizar ninguna escritura cuando el grafo es inválido.
- Los updates que solo cambian progreso en planes legacy no quedan bloqueados
  por defectos previos que no alteran la definición. Un plan legacy inválido
  no puede obtener una nueva aprobación sin corregirse.
- Ninguna nueva dependencia, tabla, migración, evento de negocio ni endpoint.
- No hay ejecución automática de tareas, acceso cruzado de tenants ni cambio
  de permisos. Se mantiene `planDefinitionFingerprint` y la invalidez de
  aprobación al editar la definición.

**Pruebas añadidas (autoría, no ejecución):**
`apps/api/test/plan-dependency-graph.test.ts` cubre DAG válido, orden arbitrario,
IDs duplicados, referencia ausente, autorreferencia, ciclo de tres pasos,
rechazo antes de insert/update, aprobación legacy inválida y compatibilidad
con progreso legacy. La suite completa y CI deben ejecutarse antes de promover
el PR desde DRAFT.

## Próximo hito verificable: continuidad de Hermes

Este PR **no** afirma que Hermes ya recupere una misión completa tras una caída.

Antes de otra implementación: realizar una prueba integrada con PostgreSQL + Redis +
Worker en staging aislado, con un plan inofensivo y un reinicio deliberado, y
demostrar con evidencia de ejecución que: (1) estado y salida persisten,
(2) se retoman solo pasos seguros, (3) no hay duplicación de efectos,
(4) se respetan tenant/org y autorización, y (5) no se emite éxito simulado.
Si falla, abrir un cambio dirigido al punto exacto de pérdida de continuidad.

## Límites de entrega

- **Código:** propuesto en rama; sin garantía de integración hasta pasar checks.
- **CI:** pendiente y no inferible de lectura estática.
- **Merge:** NO realizado.
- **Railway / producción:** NO tocados.
- **Autonomía sensible:** ninguna ampliación, aprobaciones existentes intactas.
- **Automaton:** usado como referencia de arquitectura, sin instalación ni dependencia.
