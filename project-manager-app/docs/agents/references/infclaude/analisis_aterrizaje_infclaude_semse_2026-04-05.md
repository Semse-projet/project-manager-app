# Analisis y Aterrizaje de Infclaude en SEMSE

## Objetivo

Usar `infclaude` como referencia de arquitectura agentica antes de seguir materializando mas codigo en `SEMSE`.

Este documento responde tres preguntas:

1. Que patrones de `infclaude` si valen para `SEMSE`
2. Que patrones deben adaptarse en vez de copiarse literal
3. Que decisiones conviene cerrar antes de seguir implementando

## Fuentes revisadas

Infclaude:

- `/home/yoni/infclaude/claurst-main/spec/00_overview.md`
- `/home/yoni/infclaude/claurst-main/spec/01_core_entry_query.md`
- `/home/yoni/infclaude/claurst-main/spec/03_tools.md`
- `/home/yoni/infclaude/claurst-main/spec/05_components_agents_permissions_design.md`
- `/home/yoni/infclaude/claurst-main/spec/06_services_context_state.md`
- `/home/yoni/infclaude/claurst-main/src-rust/crates/core/src/memdir.rs`
- `/home/yoni/infclaude/claurst-main/src-rust/crates/query/src/coordinator.rs`
- `/home/yoni/infclaude/claurst-main/src-rust/crates/tools/src/ask_user.rs`
- `/home/yoni/infclaude/claurst-main/src-rust/crates/tools/src/enter_plan_mode.rs`
- `/home/yoni/infclaude/claurst-main/src-rust/crates/tools/src/tasks.rs`

SEMSE actual:

- `/home/yoni/app semse/project-manager-app/apps/api/src/modules/agents/mvs/mvs.service.ts`
- `/home/yoni/app semse/project-manager-app/apps/api/src/modules/agents/tools/executor.ts`
- `/home/yoni/app semse/project-manager-app/apps/api/src/common/conversation.store.ts`
- `/home/yoni/app semse/project-manager-app/apps/api/src/modules/projects/projects.repository.ts`
- `/home/yoni/app semse/project-manager-app/apps/api/src/modules/projects/projects.service.ts`
- `/home/yoni/app semse/project-manager-app/apps/web/components/projects/project-ai-console.tsx`
- `/home/yoni/app semse/project-manager-app/packages/db/prisma/schema.prisma`
- `/home/yoni/app semse/project-manager-app/packages/agents/src/semseproject.ts`
- `/home/yoni/app semse/project-manager-app/packages/agents/src/infclaude.ts`

## Lectura principal

`infclaude` no es valioso por ser un CLI terminal. Es valioso porque separa muy bien las piezas del sistema agentico:

- loop
- tools
- permisos
- contexto
- estado
- memoria
- coordinacion
- pausa humana
- plan mode
- task tracking
- telemetry

`SEMSE` ya tiene varias de esas piezas, pero todavia no estan cerradas como sistema coherente.

## Lo que SEMSE ya tiene y coincide con Infclaude

### 1. Tool use loop gobernado

Ya existe en:

- `/home/yoni/app semse/project-manager-app/apps/api/src/modules/agents/tools/executor.ts`

Coincidencias fuertes:

- limite de iteraciones
- contexto de ejecucion
- validate input
- permissions check
- pausa por aclaracion
- observabilidad por tool run

Conclusion:

- esta es una base correcta
- no hay que reemplazarla
- hay que encapsularla mejor por `harness`

### 2. Thread persistido

Ya existe en:

- `/home/yoni/app semse/project-manager-app/apps/api/src/common/conversation.store.ts`
- `AgentConversation` en Prisma

Coincidencia con `infclaude`:

- el hilo no vive solo en frontend
- la sesion puede retomarse

Conclusion:

- buena direccion
- falta usar el thread como parte de un runtime mas amplio, no solo como chat history

### 3. Pausa humana

Ya existe en `SEMSE` via `ask_for_clarification`.
En `infclaude` aparece como `ask_user`.

Conclusion:

- el patron es correcto
- conviene convertirlo en primitiva formal del runtime y no solo en caso especial del loop

### 4. Delegacion y planificacion como modelos de dominio

Ya existen en Prisma:

- `AgentDelegation`
- `AgentWorkPlan`

Conclusion:

- `SEMSE` ya tiene el modelo correcto
- todavia no tiene la orquestacion completa encima de ese modelo

### 5. Telemetry-first mindset

`infclaude` trata costos, duraciones, session state y counters como parte del runtime.

En `SEMSE` ya hay una intuicion similar:

- `AgentRun`
- `AuditLog`
- `CorpusStatus`
- warnings del workspace
- refresh fino tras acciones

Conclusion:

- hay buena base
- falta formalizar `agent runtime state`

## Lo que SEMSE deberia adoptar de Infclaude

## A. Agent harness formal

En `infclaude`, el valor no esta solo en tools. Esta en el arnes que junta:

- input
- thread
- contexto
- permisos
- tools
- plan mode
- ask user
- telemetry
- salida

### Aterrizaje en SEMSE

Antes de seguir agregando features, `SEMSE` deberia declarar un `AgentHarness` tipado por superficie:

- `ProjectCopilotHarness`
- `DisputeHarness`
- `PaymentsHarness`
- `FieldOpsHarness`

Cada uno debe fijar:

- input permitido
- contexto requerido
- memory readable
- memory writable
- tools permitidos
- approval boundaries
- audit outputs

## B. Context assembly explícito

En `infclaude`, el contexto del turno es una construccion deliberada. No entra todo el historial indiscriminadamente.

### Aterrizaje en SEMSE

El copiloto de proyecto ya va bien porque usa:

- `ProjectWorkspaceView`
- `ProjectAgentContextView`
- `ProjectCopilotJournalView`
- `CorpusStatusView`

Pero falta decidir por contrato:

- tamaño maximo del contexto
- orden de prioridad de fuentes
- cuando usar activity vs docs vs memory
- que entra en chat y que entra en search

## C. Plan mode real

En `infclaude`, `EnterPlanMode` separa explicitamente la fase de pensar de la fase de actuar.

### Aterrizaje en SEMSE

Esto es muy util para:

- disputas complejas
- liberacion de pagos
- runbooks de incidentes
- analisis de riesgo

Antes de ejecutar mutaciones sensibles, el agente deberia poder entrar en:

- `plan`
- `review`
- `execute`

Hoy `SEMSE` tiene:

- acciones aprobables
- `AgentWorkPlan`

Pero no tiene todavia un `plan mode` de producto.

## D. Task graph / work plan vivo

En `infclaude`, el tracking de tareas no es accesorio. Forma parte del trabajo del agente.

### Aterrizaje en SEMSE

`AgentWorkPlan` debe usarse como task graph por proyecto o caso:

- pasos
- dependencias
- estado
- agente responsable
- bloqueos

No para todo. Solo para:

- trabajos multi-step
- casos largos
- coordinacion entre agentes

## E. Coordinator mode controlado

El `coordinator` de `infclaude` no delega por defecto. Orquesta cuando hace falta y protege sus tools internas.

### Aterrizaje en SEMSE

`SEMSE` no necesita swarm por moda. Necesita coordinacion en casos acotados:

- dispute review
- incident response
- high-risk project analysis
- payout resolution

Modelo recomendado:

- un coordinador por `project` o `case`
- subagentes especializados por dominio
- herramientas internas no delegables
- consolidacion final siempre en el coordinador

## F. Memoria durable fuera del loop principal

La leccion fuerte de `memdir` no es “guardar markdowns en disco”.
La leccion es esta:

- la memoria durable no debe vivir pegada al prompt del turno
- debe escanearse, resumirse e inyectarse por relevancia

### Aterrizaje en SEMSE

No copiar `memdir` literal.

Usar:

- `AgentMemory` como persistencia durable
- `AgentConversation` para session memory
- corpus documental para grounding
- `AuditLog` solo como evidencia de eventos, no como memoria principal

## Lo que NO conviene copiar literal

## 1. Global session state gigantesco

`infclaude` usa un singleton de estado enorme porque resuelve un CLI complejo.

En `SEMSE`, copiar eso seria un error.

### En lugar de eso

Separar:

- estado de UI
- estado de agente
- estado de dominio
- telemetria operacional

## 2. Tool sprawl

`infclaude` tiene decenas de tools porque su superficie es enorme.

En `SEMSE`, meter tools indiscriminadamente haria ruido y riesgo.

### Regla para SEMSE

Cada tool nueva debe justificar:

- dominio
- permiso
- actor
- riesgo
- salida auditable

## 3. Plugin marketplace como prioridad temprana

`infclaude` tiene skills y plugins como capa fuerte de extensibilidad.

`SEMSE` todavia no necesita marketplace de plugins. Primero necesita estabilizar:

- harnesses
- memory
- delegation
- work plans
- policies

## 4. File-based memory como implementación primaria

`memdir` como markdown en filesystem sirve para un CLI local.

`SEMSE` necesita multi-tenant, ACL, audit y consistencia.

### Decision

- conservar la idea
- no copiar el mecanismo

## Estado actual de aterrizaje en SEMSE

| Area | Estado actual | Lectura |
|---|---|---|
| Tool loop | fuerte | ya es reutilizable |
| Thread persistence | fuerte | ya hay base durable |
| Copilot journal | medio | bien encaminado, aun hibrido |
| Memory durable | debil | existe modelo, falta servicio real |
| Plan mode | debil | existe modelo, falta runtime |
| Delegation | debil | existe tabla, falta coordinacion |
| Task/work plan | debil | existe tabla, falta uso operativo |
| Context assembly | medio | bien en proyectos, falta contrato global |
| Telemetry runtime | medio | hay piezas, falta consolidacion |
| Permissions | fuerte | buena direccion |

## Decisiones que conviene cerrar antes de seguir codificando

## Decision 1. Que es un agente en SEMSE

Definicion recomendada:

Un agente en `SEMSE` es una unidad operacional compuesta por:

- rol
- harness
- tools
- memory policy
- approval policy
- audit contract

No solo por un prompt.

## Decision 2. Cual es el source of truth de cada capa

- thread -> `AgentConversation`
- events -> `AuditLog`
- durable memory -> `AgentMemory`
- delegated work -> `AgentDelegation`
- multi-step plans -> `AgentWorkPlan`
- grounding docs/evidence -> corpus del proyecto

## Decision 3. En que casos habra coordinator mode

No global. Solo para flujos complejos:

- disputas
- incidentes
- pagos con riesgo
- analisis de proyecto de alto riesgo

## Decision 4. Como se activa plan mode

Recomendacion:

- automatico en acciones de alto riesgo
- opcional para casos complejos
- salida del plan mode requiere confirmacion o transicion de estado

## Decision 5. Como se inyecta memoria

Orden recomendado:

1. contexto actual del caso
2. thread resumido o reciente
3. memory relevante por entidad
4. corpus search si hace falta grounding

## Roadmap recomendado antes de mas features

### Fase 1. Cerrar runtime

- formalizar `AgentHarness`
- separar mejor thread, journal, memory y context
- consolidar `copilot journal` server-side

### Fase 2. Cerrar memoria

- crear `AgentMemoryService`
- definir tipos de memoria utilizables
- crear politicas de lectura/escritura
- diferenciar memoria de evento

### Fase 3. Cerrar planificacion

- usar `AgentWorkPlan`
- exponer estados `draft`, `active`, `blocked`, `completed`
- conectar planes a copiloto de proyecto y disputas

### Fase 4. Cerrar delegacion

- activar `AgentDelegation`
- agregar coordinador por caso
- definir tools no delegables

### Fase 5. Cerrar telemetry runtime

- consolidar contadores operativos por run
- surfaced backlog, dead-letter, retries, durations
- exponer estado de runtime por proyecto/caso

## Traduccion concreta a donde estamos hoy

## Lo que SI deberiamos hacer ya

- mantener `ProjectCopilot` como harness principal
- mover memoria util a `AgentMemory`
- hacer `plan mode` en pagos/disputas
- conectar `AgentWorkPlan`
- usar `AgentDelegation` en coordinacion compleja

## Lo que NO deberiamos hacer ya

- crear docenas de tools nuevas
- construir swarm mode general
- copiar un gran singleton de session state
- montar plugin marketplace temprano

## Conclusión

`infclaude` confirma que `SEMSE` va por la direccion correcta en cuatro cosas:

- permiso antes de ejecucion
- loop con tools y pausa humana
- thread persistido
- runtime observable

Pero tambien deja claro el hueco principal:

`SEMSE` ya tiene piezas de sistema agentico, pero todavia no tiene sistema agentico cerrado.

La prioridad antes de materializar mucho mas codigo no es agregar features aisladas. Es cerrar estos contratos:

- harness
- memory
- plan mode
- delegation
- task graph
- runtime telemetry

Si eso se cierra primero, lo que venga despues en `AI`, `RAG`, `Payments` y `Disputes` va a salir con mucha mas coherencia.
