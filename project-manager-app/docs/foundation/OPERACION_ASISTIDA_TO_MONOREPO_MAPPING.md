# Operacion Asistida — Mapeo al Monorepo Canonico

- Fecha: 2026-04-12
- Estado: activo
- Tipo: foundation mapping

## Proposito

Traducir la taxonomia de operacion asistida de `SEMSE` a zonas concretas del monorepo canonico para que esta capacidad deje de ser solo una abstraccion documental.

## Taxonomia funcional

1. `operator_identity`
2. `workspace_memory`
3. `agent_runtime`
4. `ephemeral_runtime_state`
5. `backup_recovery`

## Mapeo a componentes concretos

| Subcapa | Objetivo funcional | Zonas actuales o destino natural en el monorepo |
|---|---|---|
| `operator_identity` | identidad operativa del operador y del contexto de ejecucion | `packages/auth/`, `apps/api/src/modules/auth/`, `apps/api/src/common/` |
| `workspace_memory` | memoria contextual por repo, hilo, agente y entorno | `packages/knowledge/`, `apps/api/src/modules/knowledge/`, `apps/api/src/modules/repo-knowledge/`, `apps/api/src/modules/runtime-knowledge/` |
| `agent_runtime` | ejecucion agentic, runtimes versionados, harnesses y coordinacion | `packages/agents/`, `packages/autonomy/`, `apps/api/src/modules/agents/`, `apps/api/src/modules/autonomy/`, `apps/worker/` |
| `ephemeral_runtime_state` | logs, caches y estado descartable de ejecucion | `apps/worker/`, runbooks operativos, observabilidad futura |
| `backup_recovery` | resiliencia, recuperacion, continuidad y BCP | `docs/bcp/`, `scripts/verify-operacion-asistida-bcp.mjs`, `scripts/operacion-asistida-bcp-drill.mjs`, `apps/api/src/modules/ops/`, `AuditService` como soporte de reconstruccion narrativa |

## Lectura por dominio

### `operator_identity`

Aunque la identidad operativa del operador no equivalga a auth de usuario final, el ancla tecnica del monorepo esta aqui:

- `packages/auth/`
- `apps/api/src/modules/auth/`

Destino futuro:

- separar identidad de usuario final, identidad de operador y actor context tecnico.

### `workspace_memory`

El monorepo ya tiene señales claras para absorber esta capa:

- `packages/knowledge/`
- `modules/knowledge/`
- `modules/repo-knowledge/`
- `modules/runtime-knowledge/`

Destino futuro:

- modelar memoria contextual persistente de agentes y workspaces como dominio explicito.

### `agent_runtime`

La capacidad ya tiene anclas vivas:

- `packages/agents/`
- `packages/autonomy/`
- `modules/agents/`
- `modules/autonomy/`
- `apps/worker/`

Destino futuro:

- endurecer separacion entre catalogo, harnesses, runtime execution y orquestacion.

### `ephemeral_runtime_state`

Todavia no existe como dominio fuerte del monorepo.  
Hoy debe leerse como soporte operativo y observabilidad temporal.

Destino futuro:

- politica explicita de limpieza;
- observabilidad centralizada;
- runbooks y health de ejecucion.

### `backup_recovery`

Hoy esta subcapa cae parcialmente en:

- `docs/bcp/`
- `scripts/verify-operacion-asistida-bcp.mjs`
- `OpsModule`
- `AuditService`

Estado operativo:

- `docs/bcp/BCP_OVERVIEW.md` define RTO, RPO, cobertura y regla de respaldo;
- `docs/bcp/OPERACION_ASISTIDA_BACKUP_RECOVERY_RUNBOOK.md` formaliza recuperacion de `operatorContext`, `workspace_memory`, `AgentRun`, Ops trace y auditoria;
- `docs/bcp/OPERACION_ASISTIDA_RECOVERY_CHECKLIST.md` da checklist de drill o incidente;
- `npm run verify:operacion-asistida:bcp` valida que la capa BCP minima existe y contiene marcadores operativos.
- `npm run drill:operacion-asistida:bcp` ejecuta simulacion local sin API/DB viva y genera evidencia JSON.
- `docs/bcp/evidence/manifest.json` mantiene ultimo resultado y un historial resumido de las ultimas corridas.
- `SEMSE_BCP_DRILL_MODE=api` cambia el mismo drill hacia API viva cuando exista entorno disponible.
- `npm run drill:operacion-asistida:api-local` levanta API compilada, espera health Prisma y ejecuta el drill contra endpoints reales.
- `npm run verify:operacion-asistida:api-local` combina verificacion documental y drill API local.
- `npm run review:operacion-asistida:risk` convierte el manifiesto BCP en revision de riesgo operativa.
- `npm run review:operacion-asistida:governance` promueve esa revision a artifacts de governance y backlog.
- `npm run drill:operacion-asistida:restore` valida reconstruccion aislada desde la evidencia mas reciente.
- `npm run audit:operacion-asistida:workspace-memory-legacy` mide y puede absorber deuda legacy de `workspace_memory`.
- `.github/workflows/operacion-asistida-api.yml` ejecuta este gate en CI con `postgres` y `redis` como servicios.

Destino futuro:

- automatizar drills de restore con entorno aislado;
- conectar resultados de drill a backlog de riesgos operativos.

## Decisiones de arquitectura

### 1. La operacion asistida no se implementa como una sola carpeta

Se implementa como una capacidad transversal repartida entre auth, knowledge, agents, autonomy, ops y BCP.

### 2. La memoria de workspace debe converger a conocimiento estructurado

El destino natural de `workspace_memory` no es una carpeta ad hoc indefinida.  
Es un dominio explicito de conocimiento operativo.

### 3. El runtime debe converger a componentes del monorepo

Todo runtime agentic util debe tender a expresarse en:

- `packages/agents`
- `packages/autonomy`
- `apps/worker`
- `modules/agents`
- `modules/autonomy`

### 4. El respaldo no es runtime

La arquitectura del monorepo debe preservar la distincion entre:

- ejecucion viva;
- memoria persistente;
- respaldo externo.

## Relacion con el canon

Este documento no redefine la constitucion.  
Funciona como aterrizaje tecnico del canon hacia el monorepo.

## Implementacion inicial ya ejecutada

Al 2026-04-13 ya existe una primera traduccion viva de esta capa dentro del monorepo:

- `packages/shared/src/operator-context.ts`
- `packages/auth/src/operator-context.ts`
- `packages/knowledge/src/workspace/model.ts`
- `packages/knowledge/src/workspace/store.ts`
- `packages/autonomy/src/index.ts`
- `apps/api/src/modules/autonomy/autonomy.service.ts`
- `apps/api/src/modules/autonomy/autonomy.workspace-memory-store.ts`

Esto significa que el mapping ya no es solo aspiracional:

- `operator_identity` ya tiene contrato tecnico reusable;
- `workspace_memory` ya tiene modelo, store base y exposicion operativa en API;
- `agent_runtime` ya consume contexto operativo en autonomia y en `AgentRun`;
- `run_summary` ya puede emitirse a memoria contextual desde API;
- `workspace_memory` ya tiene un reader inicial en `GET /v1/knowledge/workspace-memory`;
- `workspace_memory` ya persiste sobre `WorkspaceMemoryEntry` como modelo Prisma dedicado, con lectura dual temporal desde `KnowledgeFact`;
- existe auditoria explicita para medir y absorber el legado antes de apagar la lectura dual;
- `ops` ya expone `operatorContext` y `workspaceMemory` en runtime trace;
- Admin Ops y Cortex ya visualizan esa capa para operadores;
- Admin Ops ya permite filtrar por `workspaceId`, `operatorId` y `memoryTag`;
- existen unit tests y smoke API para validar estos filtros.
- `backup_recovery` ya tiene runbook, checklist, verificacion local y drill conmutable local/API.

Referencias superiores:

- `constitution/01_KERNEL.md`
- `constitution/04_AGENTIC_LAYER.md`
- `program/ARCHITECTURE_TARGET.md`
- `program/governance/OPERACION_ASISTIDA_TRACEABILITY_MAP.md`
