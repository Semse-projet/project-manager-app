# SEMSE Developer Runtime Spec

## Proposito

Esta especificacion traduce el blueprint de ecosistema del SEMSE Developer Runtime a contratos tecnicos, ubicacion dentro del monorepo y secuencia de implementacion.

Precedencia:

- el concepto y principios viven en `/home/yoni/labsemse/program/architecture/SEMSE_DEVELOPER_RUNTIME_BLUEPRINT.md`
- el marco de producto vive en [SEMSE_DEVELOPER_RUNTIME_PRD.md](/home/yoni/labsemse/project-manager-app/docs/foundation/SEMSE_DEVELOPER_RUNTIME_PRD.md)
- el prompt operativo vive en [PROMPT_MAESTRO_SEMSE_DEVELOPER_RUNTIME.md](/home/yoni/labsemse/project-manager-app/docs/foundation/PROMPT_MAESTRO_SEMSE_DEVELOPER_RUNTIME.md)
- esta spec traduce esos principios a implementacion

## Resultado esperado

El monorepo debe soportar una capa que:

- reciba intenciones tecnicas;
- las convierta en misiones ejecutables;
- coordine agentes y herramientas;
- ejecute dentro de politicas de autonomia;
- valide resultados;
- persista logs, artefactos y decisiones.

## Estado actual implementado

Al 2026-04-23 ya existe una base funcional dentro del monorepo:

- `packages/schemas/src/developer-runtime.schema.ts`
  contrato unificado zod + types para sesiones, misiones, steps, approvals, validations, provider routing y command I/O.
- `packages/shared/src/developer-runtime.ts`
  eventos, matriz de riesgo, orden de autonomia y helpers de aprobacion/autoejecucion.
- `packages/agents/src/developer-runtime.ts`
  taxonomia de agentes del runtime con tools permitidas y max autonomy.
- `apps/api/src/modules/developer-runtime/*`
  modulo Nest inicial con controller, service, repository, approval gateway, shell adapter, validation preview y storage dedicado.
- `apps/web/app/api/semse/developer-runtime/*`
  proxy routes Next hacia `/v1/developer-runtime/*`.
- `apps/web/app/(app)/admin/developer-runtime/page.tsx`
  superficie inicial para crear sesiones/misiones y visualizar plan/catalogo.
- `apps/api/src/infrastructure/queue/developer-runtime-queue.service.ts`
  dispatch asincrono de sesiones hacia BullMQ usando `SEMSE_DEVELOPER_RUNTIME_QUEUE`.
- `apps/api/src/modules/developer-runtime/developer-runtime.storage.service.ts`
  storage dedicado del runtime via SQL crudo con tablas propias y bootstrap automatico.
- `apps/worker/src/modules/developer-runtime/runtime.executor.mjs`
  ejecucion fase 1 en worker para tools seguras (`listFiles`, `inspectEnv`, `gitStatus`, `gitDiff`, `searchCode`, `readFile`) y validaciones shell (`runBuild`, `runLint`, `runTests`).
- `apps/worker/src/modules/developer-runtime/validation.executor.mjs`
  normalizacion de validaciones y artefactos derivados de comandos.
- approvals por step ya se materializan como records persistidos (`request + optional decision`), se resuelven por API y bloquean la ejecucion mientras haya pendientes o rechazos.
- `apps/api/test/developer-runtime.service.test.ts`
  prueba unitaria base del service.

Sessions, missions, logs, validations, artifacts y approvals ya no viven en memoria:

- fuente primaria: tablas dedicadas del runtime creadas por bootstrap SQL y ya canonizadas en Prisma migrations
- sombra de auditoria: `AuditLog`

Bloque ya cerrado:

- tablas del runtime presentes en `packages/db/prisma/schema.prisma`
- migracion canonica creada en `packages/db/prisma/migrations/20260423010000_developer_runtime_persistence/migration.sql`

## Ubicacion recomendada en el monorepo

### `packages/schemas`

Responsabilidad:

- contratos zod y types de dominio compartidos

Estado actual:

- `packages/schemas/src/developer-runtime.schema.ts`
- exportado desde `packages/schemas/src/index.ts`

### `packages/shared`

Responsabilidad:

- enums, helpers, event names, risk matrix y tipos no-zod compartidos

Estado actual:

- `packages/shared/src/developer-runtime.ts`
- exportado desde `packages/shared/src/index.ts`

### `packages/agents`

Responsabilidad:

- definicion de agentes;
- matriz de capacidades;
- politicas por agente;
- prompts base e instrucciones del runtime

Estado actual:

- `packages/agents/src/developer-runtime.ts`
- exportado desde `packages/agents/src/index.ts`

### `apps/api`

Responsabilidad:

- orquestador;
- sessions API;
- planner API;
- approval gateway;
- auditoria;
- routing de proveedores

Ubicacion sugerida:

- `apps/api/src/modules/developer-runtime/`

Submodulos:

- `developer-runtime.controller.ts`
- `developer-runtime.service.ts`
- `developer-runtime.module.ts`
- `developer-runtime.repository.ts`
- `developer-runtime.storage.service.ts`
- `developer-runtime.approval.service.ts`
- `developer-runtime.validation.service.ts`
- `developer-runtime.shell.service.ts`

Pendiente:

- `planner.service.ts`
- `provider-router.service.ts`
- lectura incremental y paginada de snapshots desde storage propio; hoy el repository recompone detalle completo por sesion

### `apps/worker`

Responsabilidad:

- ejecucion asincrona de steps;
- shell runtime;
- builds/tests/lint;
- persistencia de logs y artefactos;
- retries controlados

Estado actual:

- `apps/worker/src/modules/developer-runtime/runtime.executor.mjs`
- `apps/worker/src/modules/developer-runtime/validation.executor.mjs`

Estado streaming fase 1 real:

- el worker usa `spawn` (no `exec`) para capturar chunks de stdout/stderr durante la ejecucion
- cada 1.5s el worker envia un log `step.progress` al API via `POST /worker/progress`
- el API persiste el log en storage y el SSE lo recoge en el siguiente poll (2s)
- la UI admin muestra los progress logs en el feed de terminal agrupados por paso
- apps/api/tsconfig.json: EXIT:0
- apps/web/tsconfig.json: EXIT:0
- worker node --check: sin errores

Estado cerrado en esta iteracion:

- diff viewer ya usa `git diff -- <path>` real despues de cada mutacion; fallback a pseudo-diff si git no rastrea el archivo
- `diffTone()` en la UI ya maneja el formato unificado real de git: `@@` hunk (azul), `+` added (verde), `-` removed (rojo), contexto (gris)
- `terminalLineTone()` en la UI colorea la salida de build/lint/tests segun keywords de error/warning/success
- feed de terminal ahora renderiza logs directos con estilo por accion: progress (gris/italica), error (rojo), ok (verde)
- `selectedStepFilter` se resetea al cambiar de sesion
- `apps/api EXIT:0`, `apps/web EXIT:0`, `worker node --check OK`, Prisma valid

Pendiente residual (no urgente):

- endurecer bootstrap SQL como red de seguridad secundaria (ya existe, migracion es el path principal)
- commandArgs gobernados por politica por-template mas fina

Estado fase 1 adicional:

- `installDependencies` ya se ejecuta en worker cuando el approval del step esta resuelto en positivo
- el worker revalida approvals por `stepId` antes de correr tools sensibles
- `writeFile` y `patchFile` ya aceptan payload estructurado en `mission.intent.metadata`
  - `writeFiles[]`: `{ stepId?, path, content }`
  - `patches[]`: `{ stepId?, path, find, replace }`
  - cada mutacion deja artefacto `file` o `patch`
- la UI admin ya renderiza un `Diff Viewer` sobre artifacts `file` y `patch`
- `runCommand` ya no acepta `metadata.command` libre
  - ahora exige `metadata.commandTemplate`
  - templates actuales expuestos en catalogo:
    - `npm.build.api`
    - `npm.build.web`
    - `npm.test.unit`
    - `npm.typecheck`
    - `npm.smoke.agents`
  - cada template ahora expone policy visible en catalogo
  - fase actual: todos los templates tienen `allowArgs=false` y `maxArgs=0`
- la UI admin ya incluye builder base para payload operativo:
  - seleccionar `commandTemplate`
  - preparar multiples entradas en `writeFiles[]`
  - preparar multiples entradas en `patches[]`
- la UI admin ya incluye panel `Terminal` sobre logs y `command_output`
- la UI admin ya se suscribe por SSE al detalle de sesion mientras el estado sea `executing`
- logs, validations y artifacts ya incluyen `stepId` opcional para agrupar evidencia por paso real
- la UI admin ya agrupa `command_output`, logs, validaciones y diffs por `stepId` cuando existe

### `apps/web`

Responsabilidad:

- experiencia del developer runtime;
- panel de intencion;
- timeline de pasos;
- terminal viva;
- diffs;
- aprobaciones;
- validaciones;
- bitacora

Estado actual:

- `apps/web/app/(app)/admin/developer-runtime/page.tsx`
- `apps/web/app/api/semse/developer-runtime/*`
- `apps/web/app/semse-api.ts`

Pendiente:

- descomponer la UI en `apps/web/components/developer-runtime/`
- timeline viva de ejecucion, logs, approvals y artefactos

## Dominio minimo

### `IntentTask`

```ts
export type TaskCategory =
  | "bootstrap"
  | "diagnostic"
  | "bugfix"
  | "refactor"
  | "generate"
  | "validate"
  | "deploy"
  | "document";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface IntentTask {
  id: string;
  goal: string;
  category: TaskCategory;
  confidence: number;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  repoId: string;
  branch?: string;
  metadata?: Record<string, unknown>;
}
```

### `ExecutionStep`

```ts
export interface ExecutionStep {
  id: string;
  missionId: string;
  title: string;
  description: string;
  tool: string;
  agent: string;
  order: number;
  riskLevel: RiskLevel;
  approvalRequired: boolean;
  expectedOutput?: string;
  verificationRule?: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
}
```

### `AgentSession`

```ts
export type ExecutionState =
  | "idle"
  | "interpreting"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "validating"
  | "summarizing"
  | "completed"
  | "failed"
  | "blocked";

export interface AgentSession {
  id: string;
  userId: string;
  repoId: string;
  branch?: string;
  startedAt: string;
  endedAt?: string;
  goal: string;
  state: ExecutionState;
  selectedAgents: string[];
  missionId: string;
  summary?: string;
}
```

### `Mission`

```ts
export interface Mission {
  id: string;
  sessionId: string;
  intent: IntentTask;
  plan: ExecutionStep[];
  riskLevel: RiskLevel;
  status: "draft" | "approved" | "running" | "completed" | "failed" | "blocked";
}
```

### `SessionLog`

```ts
export interface SessionLog {
  id: string;
  sessionId: string;
  timestamp: string;
  agent: string;
  tool: string;
  action: string;
  inputSummary: string;
  outputSummary?: string;
  status: "ok" | "warning" | "error";
  durationMs?: number;
}
```

### `SessionArtifact`

```ts
export interface SessionArtifact {
  id: string;
  sessionId: string;
  type:
    | "command_output"
    | "diff"
    | "file"
    | "report"
    | "validation"
    | "preview"
    | "patch";
  label: string;
  uri?: string;
  contentSnippet?: string;
  createdAt: string;
}
```

### `ValidationResult`

```ts
export interface ValidationResult {
  id: string;
  sessionId: string;
  name: string;
  status: "passed" | "failed" | "skipped";
  details?: string;
  evidenceRef?: string;
}
```

### `ApprovalRequest` y `ApprovalDecision`

```ts
export interface ApprovalRequest {
  id: string;
  sessionId: string;
  stepId: string;
  title: string;
  reason: string;
  riskLevel: RiskLevel;
  actionPreview: string;
  createdAt: string;
}

export interface ApprovalDecision {
  requestId: string;
  approved: boolean;
  decidedAt: string;
  decidedBy: string;
  comment?: string;
}
```

## Tool registry minimo

```ts
export interface RunCommandInput {
  command: string;
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
}

export interface RunCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface ToolRegistry {
  runCommand(input: RunCommandInput): Promise<RunCommandResult>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  patchFile(path: string, patch: string): Promise<{ applied: boolean; summary: string }>;
  listFiles(path: string): Promise<Array<{ path: string; type: "file" | "dir" }>>;
  searchCode(query: string): Promise<Array<{ path: string; snippet: string }>>;
  runBuild(): Promise<RunCommandResult>;
  runLint(): Promise<RunCommandResult>;
  runTests(): Promise<RunCommandResult>;
  gitStatus(): Promise<string>;
  gitDiff(): Promise<string>;
  installDependencies(manager: "npm" | "pnpm" | "yarn"): Promise<RunCommandResult>;
  inspectEnv(): Promise<{ missing: string[]; present: string[] }>;
  requestApproval(input: ApprovalRequest): Promise<ApprovalDecision>;
}
```

## Flujos iniciales obligatorios

### Bootstrap de proyecto

- inspeccionar repo
- detectar stack
- verificar herramientas
- instalar dependencias
- revisar env
- correr build/dev
- validar

### Fix de build

- reproducir error
- capturar output
- localizar fuente
- proponer fix
- aplicar parche
- recompilar
- validar

### Generacion de modulo

- interpretar requerimiento
- ubicar ownership correcto
- scaffold
- integrar exports/rutas
- validar tipado

### Auditoria tecnica

- revisar estructura
- revisar scripts
- revisar dependencias
- build/lint/test
- emitir backlog

## Politica de autonomia inicial

Se recomienda habilitar primero:

- `observation`
- `suggestion`
- `safe-execution`

Acciones sensibles que deben pasar por approval gateway:

- instalar paquetes en ramas compartidas
- modificar archivos criticos de config
- migraciones
- borrados
- push
- cambios de infraestructura
- acceso a secretos o envs sensibles

## Validation engine

Validaciones minimas:

- build
- lint
- tests
- typecheck

Regla:

- no cerrar `completed` sin una validacion pasada o razon documentada para `skipped`

## Eventos recomendados

```ts
export type RuntimeEvent =
  | "session.created"
  | "intent.interpreted"
  | "plan.created"
  | "approval.requested"
  | "approval.resolved"
  | "tool.started"
  | "tool.finished"
  | "tool.failed"
  | "validation.started"
  | "validation.finished"
  | "artifact.created"
  | "mission.completed"
  | "mission.failed";
```

## Provider abstraction

SEMSE no debe acoplar el runtime a un solo proveedor.

```ts
export type ModelCapability =
  | "reasoning"
  | "code_generation"
  | "code_editing"
  | "retrieval"
  | "embedding"
  | "vision"
  | "classification";

export interface ProviderRoute {
  provider: string;
  model: string;
  capability: ModelCapability;
}

export interface ProviderRouter {
  route(input: {
    capability: ModelCapability;
    latencyPreference: "fast" | "balanced" | "deep";
    contextSizeNeeded: number;
  }): Promise<ProviderRoute>;
}
```

## Secuencia recomendada de implementacion

### Tramo 1

- schemas zod/types
- tablas o repositorios de `sessions`, `missions`, `steps`, `logs`, `validations`, `approvals`, `artifacts`

### Tramo 2

- intent interpreter
- planner inicial
- shell adapter
- logger

### Tramo 3

- validation engine
- approval gateway
- API endpoints

### Tramo 4

- UI inicial en `apps/web`
- panel de intencion
- timeline
- terminal
- diff
- artefactos

### Tramo 5

- memoria por repo
- agent capabilities
- provider router

## Riesgos tecnicos reales

- duplicar logica de agentes fuera de `packages/agents`
- mezclar contratos zod con implementacion runtime
- permitir ejecucion sin politicas claras
- declarar exito sin validacion real
- acoplar el runtime a un proveedor concreto
- dejar la sesion como chat efimero sin persistencia

## Documentos relacionados

- blueprint: `/home/yoni/labsemse/program/architecture/SEMSE_DEVELOPER_RUNTIME_BLUEPRINT.md`
- PRD: [SEMSE_DEVELOPER_RUNTIME_PRD.md](/home/yoni/labsemse/project-manager-app/docs/foundation/SEMSE_DEVELOPER_RUNTIME_PRD.md)
- prompt maestro: [PROMPT_MAESTRO_SEMSE_DEVELOPER_RUNTIME.md](/home/yoni/labsemse/project-manager-app/docs/foundation/PROMPT_MAESTRO_SEMSE_DEVELOPER_RUNTIME.md)
