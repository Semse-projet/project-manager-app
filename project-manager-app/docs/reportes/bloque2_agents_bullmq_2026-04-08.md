# Bloque 2: Agents Especializados + Worker BullMQ

Fecha: 2026-04-08
Ruta: `/home/yoni/labsemse/project-manager-app`

## Objetivo

Cerrar el segundo bloque del backlog:

1. dar lógica especializada real a los agentes prioritarios;
2. migrar el worker de HTTP polling a BullMQ real;
3. dejar el flujo compilando, corriendo y validado end-to-end.

## Implementación

### 1. Runtime especializado de agentes

Se implementó ejecución especializada real en:

- `packages/agents/src/runtime.ts`
- `packages/agents/src/index.ts`

Agentes con lógica diferenciada:

- `pricing`
- `job-planner`
- `evidence-coach`
- `risk`
- `dispute`

Cambios relevantes:

- se añadió `RuntimeAgentResult` con `actionType`, `summary`, `confidence`, `requiresHumanReview` y `payload`;
- se corrigió el runtime para aceptar tanto `eventPayload` como input manual en raíz;
- `pricing` ahora usa `budgetMin`, `budgetMax` o `budgetCents`;
- `dispute` ya toma `reason` desde input manual y produce salida consistente con la evidencia recibida.

### 2. Producer BullMQ en API

Se añadió cola real en:

- `apps/api/src/infrastructure/queue/agent-queue.service.ts`
- `apps/api/src/infrastructure/queue/agent-queue.module.ts`

Cableado:

- `apps/api/src/modules/agents/agents.module.ts`
- `apps/api/src/modules/ops/ops.module.ts`
- `apps/api/src/modules/agents/agents.service.ts`
- `apps/api/src/modules/ops/ops.service.ts`

Comportamiento:

- crear o reintentar un `AgentRun` ahora encola un job BullMQ real;
- se corrigió el `jobId` para BullMQ, reemplazando el formato inválido con `:` por uno seguro.

### 3. Worker migrado de polling a BullMQ

Se reemplazó el worker en:

- `apps/worker/src/main.mjs`

Cambios:

- ya no hace polling HTTP para reclamar runs;
- consume la cola `semse-agent-runs` desde Redis;
- obtiene sesión real vía `/v1/auth/token`;
- reintenta autenticación con refresh cuando aplica;
- procesa `start -> heartbeat -> specialized execution -> complete`;
- conserva `reclaim-stale` como red de seguridad;
- ignora heartbeats tardíos no fatales después de un estado terminal.

### 4. Endurecimiento adicional encontrado durante el smoke

Se corrigieron problemas reales descubiertos durante validación:

- `apps/api/src/modules/agents/agents.controller.ts`
  - `createRun` ahora acepta `input` e `inputSummary`;
  - endpoints internos del worker quedaron con `@SkipThrottle()` para no chocar contra el rate limit global;
- `apps/api/src/infrastructure/audit/audit.service.ts`
  - el `AuditLog.id` ya no depende de `aud_${Date.now()}`; ahora usa `crypto.randomUUID()` para evitar colisiones bajo concurrencia;
- `apps/api/src/common/http-exception.filter.ts`
  - el logger de errores no manejados ahora registra nombre, mensaje y stack reales.

## Validación runtime

Infra levantada:

- API local en `http://127.0.0.1:4112`
- Redis local en `redis://127.0.0.1:6379`
- worker BullMQ local contra esa API

Smokes confirmados:

### Caso 1: pricing

Run:

- `cmnqrrcc10005d4csxeg9emhp`

Resultado:

- `status = completed`
- `attempts = 1`
- `workerId = worker-local-512681`
- salida especializada:
  - `actionType = recommend`
  - `summary = Pricing baseline for job`
  - `estimatedMin = 150`
  - `estimatedMax = 270`
  - `confidence = 0.64`
  - `requiresHumanReview = true`

### Caso 2: dispute

Run:

- `cmnqrth57000ad4csepj8fxk4`

Resultado:

- `status = completed`
- `attempts = 1`
- `workerId = worker-local-513038`
- salida especializada:
  - `actionType = recommend`
  - `summary = Dispute triage recommendation generated`
  - `favoredParty = client`
  - `recommendation = Hold release and request stronger completion evidence.`
  - `reasoning = client reports incomplete evidence and missed deadline`
  - `confidence = 0.73`
  - `requiresHumanReview = true`

Logs del worker observados:

- `queue job completed` para `pricing`
- `queue job completed` para `dispute`

## Validación técnica final

Comandos validados:

- `npm run build --workspace @semse/agents`
- `node --check apps/worker/src/main.mjs`
- `npm run lint --workspace @semse/api`
- `npm run test:unit --workspace @semse/api`
- `npm run build:api`

Estado final:

- BullMQ productor: OK
- worker consumidor: OK
- auth del worker: OK
- runtime especializado: OK
- smoke end-to-end: OK
- build API: OK
- lint API: OK
- tests unitarios API: OK

## Cierre

El bloque 2 queda terminado, cableado y validado.

Resultado práctico:

- SEMSE ya no depende de HTTP polling para ejecutar agentes;
- los `AgentRun` se encolan en Redis y el worker los consume por BullMQ;
- los agentes prioritarios ya no son nombres vacíos: responden con lógica diferenciada y salida estructurada;
- el runtime sobrevivió a varios defectos reales detectados en el smoke y quedó estabilizado.
