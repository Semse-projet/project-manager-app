# Integración autonomy-server — 2026-04-19

## Situación previa
- `semse/node` era un servidor HTTP standalone en puerto 4310 con su propia implementación autónoma
- El monorepo ya tenía `packages/autonomy` (versión más evolucionada: stages, resume, operator context)
- El monorepo ya tenía `apps/api/modules/autonomy` + BFF routes + `admin/autonomy` page — todo funcionando

## Qué se hizo

### `apps/autonomy-server` (nuevo app en monorepo)
Servidor HTTP standalone que usa `@semse/autonomy` como dependencia canónica.

**Archivo:** `apps/autonomy-server/src/server.mjs`

**Endpoints:**
- `GET /` — UI web para disparar tareas
- `GET /api/runs` — historial de runs (persiste en `.semse-autonomy/runs.json`)
- `GET /api/runs/:runId` — detalle de un run
- `GET /api/provider` — estado del LLM configurado
- `POST /api/run` — ejecutar tarea autónoma (`{ task, targetStage?, repoPath?, baseBranch? }`)

**Variables de entorno:**
```
LLM_API_KEY / OPENAI_API_KEY
LLM_MODEL / OPENAI_MODEL
LLM_BASE_URL / OPENAI_BASE_URL
GITHUB_TOKEN (opcional, sin él usa localPrMode)
AUTONOMY_PORT (default 4310)
```

### Scripts en package.json raíz
```bash
npm run start:autonomy              # LLM configurado por env
npm run start:autonomy:local-llm    # Usa Ollama qwen2.5:3b en :11434
```

## Por qué `semse/node` queda superseded
- `packages/autonomy` tiene todo lo que `semse/node/src/core` tiene + más
- `apps/autonomy-server` expone el mismo HTTP UI que `semse/node/src/server.ts` pero usando el paquete canónico
- No hay que correr dos servidores — la ruta canónica es la API NestJS (`POST /v1/autonomy/runs`)
- El servidor standalone es para dev/CLI sin NestJS

## Estado final del ecosistema autonomy
```
packages/autonomy         ← core logic (canónico)
apps/api/modules/autonomy ← NestJS integration
apps/web/api/semse/autonomy ← BFF routes
apps/web/(app)/admin/autonomy ← UI de admin
apps/autonomy-server      ← standalone HTTP server (dev/CLI)
```

TS: 0 errores. semse/node puede archivarse.
