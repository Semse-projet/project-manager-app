# Capa de Agentes Agentic-Native — SEMSEproject

Fecha: 2026-04-08
Repositorio: `/home/yoni/labsemse/project-manager-app`
Inspiración estratégica aplicada desde: `/home/yoni/infclaude/claurst-main/spec`

## Resumen

Se terminó la evolución base de la capa de agentes de SEMSEproject desde un catálogo/runtime heurístico hacia una capa agentic gobernada.

Estado alcanzado:

- identidad por agente runtime: implementada
- manifests de capacidades: implementados
- tool registry gobernado: implementado
- risk scoring: implementado
- policy engine estructurado: implementado
- runtime gobernado: implementado
- approvals base: implementados
- auditoría estructurada de la nueva capa: implementada
- integración con API y worker: implementada
- build y tests: validados

## Diagnóstico inicial

Antes de esta ronda, `packages/agents` tenía:

- catálogo de agentes nombrados y especializados;
- runtime heurístico para pocos agentes;
- ninguna capa explícita de capabilities;
- ningún policy engine estructurado;
- ningún tool registry gobernado;
- ningún approval flow real;
- integración del worker centrada en `executeSpecializedAgent(...)`.

Esto servía para demos y automación simple, pero no para un ecosistema agentic con gobernanza explícita.

## Señales útiles destiladas desde infclaude

Se tomaron como referencia de arquitectura las ideas presentes en:

- `spec/05_components_agents_permissions_design.md`
- `spec/06_services_context_state.md`

Lo útil que se aterrizó en SEMSE fue:

- permisos explícitos por agente y por tool;
- estado y runtime coordinados, no llamadas sueltas;
- contexto disciplinado;
- approvals como primitive del sistema;
- audit trail estructurado;
- visión de coordinator/runtime con límites y trazabilidad.

No se copió código. Solo ideas de comportamiento y estructura.

## Arquitectura final implementada

### 1. Agent Identity Layer

Archivo:

- `packages/agents/src/governance.ts`

Se definieron manifests runtime por agente:

- `pricing`
- `job-planner`
- `trust-match`
- `evidence-coach`
- `risk`
- `dispute`
- `orchestrator`
- `ecv`

Cada manifiesto declara:

- `id`
- `role`
- `name`
- `version`
- `status`
- `description`
- `capabilities`
- `metadata`

### 2. Capability & Permission Layer

En cada manifiesto quedaron explícitos:

- `allowedTools`
- `allowedActions`
- `allowedContextSources`
- `allowedInputKeys`
- `maxRiskLevel`
- `networkScopes`
- `fileScopes`
- `approvalRules`

La capacidad ya no queda implícita dentro del runtime.

### 3. Tool Registry

También en `packages/agents/src/governance.ts` se creó `agentToolRegistry` con tools tipadas:

- `context.read.job`
- `context.read.market`
- `context.read.evidence`
- `context.read.dispute`
- `context.read.trust`
- `memory.read.agent`
- `decision.recommend`
- `decision.plan`
- `decision.classify_risk`
- `audit.record.agent`
- `event.emit.domain`
- `approval.request.human`
- `runtime.complete_run`

Cada tool define:

- `category`
- `description`
- `actionType`
- `targetKind`
- `inherentRisk`

### 4. Risk Classification Layer

Se implementó `classifyAgentRisk(...)`.

Evalúa:

- `actionType`
- `toolName`
- `target`
- `targetKind`
- `environment`

Devuelve:

- `riskLevel`
- `riskScore`
- `reasons`
- `tags`

### 5. Policy Engine

Se implementó `evaluateAgentPolicy(...)`.

Devuelve respuesta estructurada:

- `decision`
- `reason`
- `riskScore`
- `riskLevel`
- `violatedPolicies`
- `requiredApprovals`
- `auditTags`

Reglas aplicadas:

- agente deshabilitado => `deny`
- action fuera del manifiesto => `deny`
- tool fuera del manifiesto => `deny`
- context source no permitido => `deny`
- riesgo por encima del umbral o regla de approval => `require_approval`
- caso normal => `allow`

### 6. Runtime Layer

Archivo:

- `packages/agents/src/runtime.ts`

Se creó `executeGovernedAgentRun(...)`, que:

1. resuelve manifiesto;
2. filtra contexto;
3. evalúa policy del run;
4. evalúa policy por tool planeada;
5. ejecuta handler especializado;
6. clasifica riesgo final;
7. abre approvals si aplica;
8. devuelve output + `policy` + `risk` + `toolDecisions` + `approvalRequests` + `auditTrail`.

También se preservó compatibilidad con:

- `executeSpecializedAgent(...)`

### 7. Approval Layer

Se implementó base de approvals en:

- `apps/api/src/modules/agents/agent-approval.service.ts`

Estado actual:

- store en memoria;
- creación automática de approvals cuando el runtime los devuelve;
- lectura de approvals;
- decisión `approved | rejected`;
- auditoría de create/decision.

Nota:

No existía modelo Prisma de approvals. Se dejó una base técnica limpia, integrada y extensible, sin romper el repositorio. La siguiente evolución natural es persistirla en DB.

### 8. Audit & Observability Layer

La nueva capa agrega trazabilidad en:

- `agent.policy.evaluate`
- `agent.tool.evaluate`
- `agent.runtime.complete`
- `agent.approval.create`
- `agent.approval.decision`

Además, el runtime devuelve `auditTrail` estructurado dentro del output del run.

## Integración real hecha

### API

Se tocaron:

- `apps/api/src/modules/agents/agents.module.ts`
- `apps/api/src/modules/agents/agents.controller.ts`
- `apps/api/src/modules/agents/agents.service.ts`
- `apps/api/src/modules/agents/agent-approval.service.ts`
- `apps/api/src/modules/ops/ops.module.ts`
- `apps/api/src/modules/ops/ops.controller.ts`
- `apps/api/src/modules/ops/ops.service.ts`

Nuevas capacidades expuestas:

- catálogo enriquecido de agentes
- detalle de manifiesto por agente
- listado de tools
- evaluación manual del policy engine
- listado de approvals
- detalle de approval
- decisión de approval desde `agents` y desde `ops`

### Worker

Se actualizó:

- `apps/worker/src/main.mjs`

Cambios:

- usa `executeGovernedAgentRun(...)` en vez de `executeSpecializedAgent(...)`;
- persiste policy/risk/approvals/toolTrace/auditTrail en el output del run;
- mantiene compatibilidad con la cola BullMQ ya existente.

### Schemas

Se añadió:

- `packages/schemas/src/agent-governance.schema.ts`

Contratos nuevos:

- `governedAgentTypeSchema`
- `governedAgentToolSchema`
- `governedAgentRiskLevelSchema`
- `governedPolicyDecisionSchema`
- `agentTypeParamSchema`
- `agentPolicyEvaluationSchema`
- `agentApprovalIdParamSchema`
- `agentApprovalDecisionSchema`

También se exportó desde:

- `packages/schemas/src/index.ts`

## Archivos creados

- `packages/agents/src/governance.ts`
- `packages/agents/src/runtime.ts`
- `packages/schemas/src/agent-governance.schema.ts`
- `apps/api/src/modules/agents/agent-approval.service.ts`
- `apps/api/test/agent-governance.test.ts`
- `reportes/capa_agentes_agentic_native_2026-04-08.md`

## Archivos modificados

- `packages/agents/src/index.ts`
- `packages/agents/README.md`
- `packages/schemas/src/index.ts`
- `apps/api/src/modules/agents/agents.module.ts`
- `apps/api/src/modules/agents/agents.controller.ts`
- `apps/api/src/modules/agents/agents.service.ts`
- `apps/api/src/modules/ops/ops.module.ts`
- `apps/api/src/modules/ops/ops.controller.ts`
- `apps/api/src/modules/ops/ops.service.ts`
- `apps/worker/src/main.mjs`
- `apps/api/test/agent-governance.test.ts`

## Checks ejecutados

Validados en esta ronda:

- `npm run build --workspace @semse/agents`
- `npm run build --workspace @semse/schemas`
- `npm run test:unit --workspace @semse/api`
- `npm run build:api`
- smoke directo del runtime con `node --experimental-strip-types -e ...` sobre `executeGovernedAgentRun(...)`

Resultado:

- build de `@semse/agents`: OK
- build de `@semse/schemas`: OK
- tests unitarios del API: OK
- build del API: OK

## Nota sobre lint

Se intentó ejecutar:

- `npm run lint --workspace @semse/api`

y también ESLint directo sobre los archivos tocados.

En este entorno, el runner de ESLint quedó sin salida útil y terminó agotando `timeout` cuando se forzó. No apareció un error sintáctico ni de regla asociado a los archivos nuevos, pero el gate completo de lint no entregó cierre confiable dentro del tiempo razonable de ejecución.

Se deja documentado como problema de ejecución/performance del runner de lint en el entorno actual, no como fallo confirmado de la nueva capa.

## Estado final

La capa de agentes queda reforzada y utilizable como base agentic-native:

- identidad declarativa
- capabilities explícitas
- tools tipadas y gobernadas
- policy engine reutilizable
- risk scoring reusable
- runtime controlado
- approvals base
- auditoría estructurada
- integración con API y worker

## Siguientes extensiones recomendadas

Solo después de este cierre base:

1. persistir `AgentApproval` en Prisma;
2. añadir `policySnapshot` persistido en `AgentRun`;
3. conectar approvals a UI de Ops/Cortex;
4. introducir herramientas reales gobernadas por policy para `orchestrator`;
5. agregar memoria durable por agente con scopes formales;
6. exponer métricas Prometheus específicas de policy decisions y approvals.
