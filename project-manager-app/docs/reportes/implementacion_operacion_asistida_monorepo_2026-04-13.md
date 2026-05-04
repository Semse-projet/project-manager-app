# Implementacion de Operacion Asistida en el Monorepo

- Fecha: 2026-04-13
- Estado: ejecutado
- Tipo: reporte de implementacion

## Objetivo

Mover la operacion asistida desde canon y mapping documental a contratos y comportamiento real dentro de `project-manager-app`.

## Cambios aplicados

### Contratos base

- `packages/shared/src/operator-context.ts`
  - contrato transversal `OperatorContext`
  - taxonomia de fuente y alcance
- `packages/auth/src/operator-context.ts`
  - adaptadores para construir contexto operativo desde sesion o identidad
- `packages/knowledge/src/workspace/model.ts`
  - modelo base de memoria contextual
- `packages/knowledge/src/workspace/store.ts`
  - interfaz `WorkspaceMemoryStore`

### Runtime agentic

- `packages/autonomy/src/types.ts`
  - `AutonomyRunOptions` acepta `operatorContext`
- `packages/autonomy/src/index.ts`
  - el runtime registra `operator_context_resolved` cuando el run trae contexto operativo

### API

- `packages/schemas/src/autonomy.schema.ts`
  - el contrato de creacion de runs acepta `workspaceId`, `repoId` y `taskId`
- `packages/schemas/src/knowledge-domain.schema.ts`
  - define query y shape de `workspace_memory`
- `apps/api/src/modules/autonomy/autonomy.controller.ts`
  - propaga los campos de contexto al servicio
- `apps/api/src/modules/autonomy/autonomy.service.ts`
  - construye `OperatorContext` desde identidad real del request
  - entrega el contexto al runtime
  - emite `run_summary` a memoria contextual cuando existe `workspaceId`
- `apps/api/src/modules/knowledge/workspace-memory.repository.ts`
  - resuelve lectura con deduplicacion por record id
- `packages/db/prisma/schema.prisma`
  - agrega `WorkspaceMemoryEntry` como persistencia dedicada para memoria contextual
- `packages/db/prisma/migrations/20260416021500_workspace_memory_entries/migration.sql`
  - crea tabla e indices dedicados para `workspace_memory`
- `apps/api/src/modules/knowledge/workspace-memory.repository.ts`
  - ahora escribe en `WorkspaceMemoryEntry`
  - mantiene lectura dual temporal desde `WorkspaceMemoryEntry` y `KnowledgeFact`
- `apps/api/src/modules/knowledge/knowledge.service.ts`
  - agrega lectura de memoria contextual por `workspaceId`
- `apps/api/src/modules/knowledge/knowledge.controller.ts`
  - expone `GET /v1/knowledge/workspace-memory`
- `apps/api/src/modules/agents/agents.service.ts`
  - adjunta `operatorContext` a `AgentRun.inputJson`
  - emite `run_summary` a memoria contextual cuando el run trae `workspaceId`
- `apps/api/src/modules/agents/agents.controller.ts`
  - permite crear `AgentRun` manual con `workspaceId`, `repoId` y `taskId`
- `apps/api/src/modules/ops/ops.service.ts`
  - expone resumen de `operatorContext` en la lista de runtime agentic
  - adjunta `workspaceMemory` a la traza por `correlationId`
  - filtra runtime por `workspaceId`, `operatorId` y `memoryTag`
- `apps/web/app/(app)/admin/ops/page.tsx`
  - muestra `workspaceId`, contexto operativo y memoria contextual dentro del trace auditable
  - permite filtrar por `workspaceId`, `operatorId` y `memoryTag`
- `apps/web/app/cortex/semse-cortex-console.tsx`
  - muestra resumen de `operatorContext` y `workspaceMemory` en Cortex
- `packages/auth/src/rbac.ts`
  - separa RBAC en subpath seguro para web sin arrastrar utilidades de sesion con `node:crypto`
- `packages/agents/src/governance.ts`
  - reconoce `operatorContext` como parte del `RuntimeAgentInput`
- `packages/agents/src/runtime.ts`
  - incorpora el contexto operativo al `auditTrail` del runtime gobernado
- `docs/bcp/BCP_OVERVIEW.md`
  - amplia el BCP para cubrir operacion asistida, RTO/RPO, auditoria y regla de respaldo
- `docs/bcp/OPERACION_ASISTIDA_BACKUP_RECOVERY_RUNBOOK.md`
  - formaliza recuperacion de `operatorContext`, `workspace_memory`, `AgentRun`, Ops trace y auditoria
- `docs/bcp/OPERACION_ASISTIDA_RECOVERY_CHECKLIST.md`
  - define checklist auditable de restore, validacion y cierre
- `scripts/verify-operacion-asistida-bcp.mjs`
  - valida que el BCP minimo de operacion asistida existe y contiene marcadores operativos
- `scripts/operacion-asistida-bcp-drill.mjs`
  - ejecuta simulacion local de recuperacion de `operatorContext`, `workspace_memory`, `AgentRun`, trace y auditoria
  - permite cambiar a API viva con `SEMSE_BCP_DRILL_MODE=api`
  - guarda evidencia `latest` y evidencia historica por timestamp
- `docs/bcp/evidence/manifest.json`
  - conserva ultimo resultado y un historial resumido de las ultimas 50 corridas de drill
- `docs/bcp/evidence/operacion-asistida-bcp-drill-local-latest.json`
  - evidencia JSON del primer drill local ejecutado
- `scripts/operacion-asistida-risk-review.mjs`
  - deriva riesgo operativo desde el manifiesto BCP
- `scripts/operacion-asistida-governance-sync.mjs`
  - promueve la revision de riesgo a artifacts de governance y backlog
- `scripts/operacion-asistida-restore-simulation.mjs`
  - valida reconstruccion aislada de la evidencia mas reciente
- `scripts/operacion-asistida-workspace-memory-legacy-sync.mjs`
  - audita el legado de `workspace_memory` en `KnowledgeFact`
  - puede absorber registros faltantes hacia `WorkspaceMemoryEntry` en modo controlado
- `scripts/operacion-asistida-api-drill-runner.mjs`
  - aplica migraciones, levanta API compilada, espera `/v1/health` con Prisma y ejecuta el drill API
  - usa Postgres/Redis locales del compose como infraestructura de prueba
- `.github/workflows/operacion-asistida-api.yml`
  - integra el gate BCP + API en GitHub Actions con `postgres` y `redis` como servicios
  - publica `docs/bcp/evidence/` como artefacto del job

## Validacion

Compilacion validada de:

- `@semse/shared`
- `@semse/auth`
- `@semse/knowledge`
- `@semse/schemas`
- `@semse/autonomy`
- `@semse/api`

## Resultado

La operacion asistida deja de existir solo como:

- interpretacion documental
- capa canonica
- mapping arquitectonico

Y pasa a existir tambien como:

- contrato tipado
- input operativo de runtime
- emision de memoria contextual por run
- lectura inicial de memoria contextual desde API
- persistencia de memoria contextual en Prisma usando `WorkspaceMemoryEntry`
- lectura dual temporal desde `KnowledgeFact` solo como compatibilidad de transicion
- propagacion de `operatorContext` hacia `AgentRun` y worker runtime
- escritura contextual abierta desde `autonomy` y desde `agents`
- observabilidad operativa de `operatorContext` y `workspace_memory` desde `ops`
- visibilidad frontend en Admin Ops y Cortex
- navegacion operativa por workspace, operador y tags de memoria
- pruebas unitarias y smoke dedicado para filtros de operacion asistida

### Validacion adicional

- `tests/unit/operacion-asistida.test.ts`
  - valida schema de filtros `workspaceId`, `operatorId`, `memoryTag`
  - valida que el runtime gobernado emite audit trail de `operatorContext`
- `scripts/api-operacion-asistida-smoke.mjs`
  - crea un `AgentRun` con contexto de workspace
  - completa el run
  - valida filtros de Ops por `workspaceId`, `operatorId` y `memoryTag`
  - valida lectura de `workspace_memory`
- `npm run verify:operacion-asistida:bcp`
  - valida runbook, checklist, overview BCP y mapping
- `npm run drill:operacion-asistida:bcp`
  - valida simulacion local de restore narrativo y genera evidencia en `docs/bcp/evidence/`
- `npm run verify:operacion-asistida:local`
  - ejecuta verificacion documental y drill local como gate compuesto
  - actualiza `docs/bcp/evidence/manifest.json`
- `npm run drill:operacion-asistida:api-local`
  - ejecutado contra Postgres/Redis locales
  - valida autenticacion por `/v1/auth/token`, `AgentRun`, Ops filters, trace y `workspace_memory`
  - genera evidencia API `latest`, historica y manifest
- `npm run verify:operacion-asistida:api-local`
  - gate compuesto disponible para verificacion documental + drill API local
  - base del workflow CI `operacion-asistida-api.yml`
- `npm run verify:operacion-asistida:module`
  - ejecuta el cierre operativo completo del modulo
  - encadena verificacion API local, revision de riesgo y restore aislado
- `npm run review:operacion-asistida:risk`
  - ejecutado y con severidad `none` sobre el manifiesto actual
- `npm run review:operacion-asistida:governance`
  - genera estado de governance y backlog derivado en `program/`
- `npm run drill:operacion-asistida:restore`
  - ejecutado con fuente API historica y validacion positiva de reconstruccion
- `npm run audit:operacion-asistida:workspace-memory-legacy`
  - audita deuda legacy pendiente antes de retirar la lectura dual
  - ejecutado en `apply` y luego en `dry-run`, dejando `pendingBackfillRecords: 0`
- `npm run verify:operacion-asistida:dedicated-store`
  - valida el modulo con lectura solo desde `WorkspaceMemoryEntry`
  - ejecutado con resultado satisfactorio sobre API local
- la lectura legacy ya fue retirada del reader de `workspace_memory`

## Limites actuales

- `workspace_memory` ya tiene modelo dedicado y ya no depende del reader legacy sobre `KnowledgeFact`
- `agent_runtime` ya integra contexto operativo en autonomia, `AgentRun`, worker runtime, vistas basicas de `ops` y frontend Ops/Cortex
- `backup_recovery` ya tiene runbooks verificables, drill local, drill API local ejecutado e integracion CI dedicada

## Siguiente paso recomendado

1. ampliar escritura/lectura contextual a mas modulos de negocio
2. extender el drill hacia restore aislado multi-entorno
3. ampliar escritura/lectura contextual a mas modulos de negocio
4. vigilar comportamiento post-retiro para confirmar ausencia de dependencias ocultas a `KnowledgeFact`
