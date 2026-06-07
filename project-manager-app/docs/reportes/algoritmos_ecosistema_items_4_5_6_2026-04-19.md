# Algoritmos Ecosistema — Items 4, 5, 6 completados

- Fecha: 2026-04-19
- Estado: completado
- Frente: `project-manager-app`
- Precondición: `algoritmos_ecosistema_items_1_2_3_2026-04-19.md`

## ITEM 4 — Autonomía genera código real

**Problema:** El LLM recibía instrucción explícita de poner `filePath` bajo `generated/` y generar solo markdown. El agente autónomo nunca podía crear código fuente real.

**Fix en `packages/autonomy/src/generator.ts`:**
- `SYSTEM_PROMPT` reescrito: "autonomous software engineer", pide código real, no markdown de `generated/`
- El LLM ahora debe elegir la extensión apropiada (`.ts`, `.py`, `.mjs`, `.md` para docs) y escribir código completo y funcional
- Nueva función `sanitizeFilePath()`: valida que el path sea relativo y sin traversal (`../`). Si el LLM sugiere un path inseguro, cae a `generated/`
- Timeout aumentado para Ollama: 180s (antes 120s) para permitir generación de código más largo
- Temperature subida a 0.1 (antes 0) para más creatividad en el código generado
- Fallback plan sigue siendo markdown en `generated/` — no se rompe si el LLM falla

**Por qué:** El valor diferencial de autonomía no es crear archivos markdown — es poder generar, commitear y proponer código real en PRs.

**Archivos modificados:**
- `packages/autonomy/src/generator.ts`

## ITEM 5 — Prioridad en worker + retry en event bus

### Prioridad en BullMQ

**Problema:** Worker procesaba runs en FIFO puro. Un run de `pricing` (baja urgencia) podía bloquear un run de `dispute` (alta urgencia, dinero en juego).

**Fix en `apps/api/src/infrastructure/queue/agent-queue.service.ts`:**
- Tabla `AGENT_PRIORITY` con prioridades por agentType (BullMQ: número más bajo = más alta prioridad):
  - dispute → 1
  - risk → 2
  - evidence-coach → 3
  - trust-match → 4
  - pricing → 5
  - job-planner → 6
  - resto → 10
- `enqueueRun()` ahora pasa `priority` al job de BullMQ

### Retry en event bus

**Problema:** Si `agentTriggerRouter.route()` lanzaba error, el evento quedaba sin triggers — silenciosamente perdido. Sin log, sin retry.

**Fix en `apps/api/src/modules/domain-events/domain-event-bus.service.ts`:**
- Nueva función `routeWithRetry()` con hasta 3 intentos
- Backoff exponencial: 200ms, 400ms, 800ms entre intentos
- Log `warn` en cada reintento fallido con eventType + correlationId
- Log `error` final si los 3 intentos fallan (no lanza excepción para no romper el flujo del caller)
- Logger NestJS inyectado en lugar de console.log

**Archivos modificados:**
- `apps/api/src/infrastructure/queue/agent-queue.service.ts`
- `apps/api/src/modules/domain-events/domain-event-bus.service.ts`

## ITEM 6 — Búsqueda semántica en knowledge

**Problema:** `WorkspaceMemoryRepository.query()` cargaba hasta 250 registros y los filtraba en memoria con `includes()`. Sin ranking de relevancia, sin stemming, sin búsqueda por texto libre.

**Fix: Postgres full-text search (tsvector + tsquery)**

En `apps/api/src/modules/knowledge/workspace-memory.repository.ts`:
- Nuevo método `search({ tenantId, workspaceId, term, limit, kinds })`:
  - Tokeniza el término: `"foo bar"` → `"foo & bar:*"` (prefix match)
  - `to_tsvector('spanish', title || summary || body)` — índice vectorial con diccionario español
  - `to_tsquery('spanish', ...)` — query con stemming
  - `ts_rank()` — score de relevancia para ordenar resultados
  - Resultado ordenado por `rank DESC`, limitado a `limit` (default 20)
  - Soporta filtro por `kinds` (dos variantes de SQL para evitar condicionales en raw query)
  - Si el término genera un tsquery inválido → retorna `[]` en lugar de lanzar

En `apps/api/src/modules/knowledge/knowledge.service.ts`:
- Nuevo método `searchWorkspaceMemory()` que llama al repositorio

En `apps/api/src/modules/knowledge/knowledge.controller.ts`:
- Nuevo endpoint `GET /v1/knowledge/workspace-memory/search?workspaceId=&term=&limit=&kinds=`
- Retorna `{ items: Array<WorkspaceMemoryRecord & { rank: number }> }`

**Por qué Postgres FTS y no embeddings:** No requiere vector DB, no requiere modelo de embeddings, funciona con el Postgres que ya existe. Para el volumen actual de workspace_memory es más que suficiente y fácil de operar.

**Archivos modificados:**
- `apps/api/src/modules/knowledge/workspace-memory.repository.ts`
- `apps/api/src/modules/knowledge/knowledge.service.ts`
- `apps/api/src/modules/knowledge/knowledge.controller.ts`

## Validación

```bash
npm run build --workspace @semse/autonomy   # OK
npm run build --workspace @semse/agents     # OK
npm run build --workspace @semse/api        # OK
npx tsc --noEmit --project apps/api/tsconfig.json  # OK (0 errores)
```

## Estado final de los 6 items

| Item | Estado |
|------|--------|
| 1a. handlers reales (trust-match, dispute, evidence-coach) | ✅ completado |
| 2. FSM de jobs | ✅ completado |
| 3a. idempotencia DB-backed | ✅ completado |
| 3b. fix dedup key router | ✅ completado |
| 4. autonomía genera código real | ✅ completado |
| 5a. prioridad en worker | ✅ completado |
| 5b. retry en event bus | ✅ completado |
| 6. búsqueda semántica en knowledge | ✅ completado |
