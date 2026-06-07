# Integracion LLM Local al Ecosistema SEMSE

Fecha: 2026-04-16

## Objetivo

Habilitar un LLM local en la maquina y conectarlo al ecosistema canonico de `project-manager-app` sin depender exclusivamente de OpenAI remoto.

## Decisiones aplicadas

- Se adopta `Ollama` como runtime local inicial.
- Se usa compatibilidad `OpenAI-like` por `baseUrl` en lugar de introducir un proveedor ad hoc.
- Se agregan aliases genericos `SEMSE_AUTONOMY_LLM_*`.
- Se mantiene compatibilidad hacia atras con `SEMSE_AUTONOMY_OPENAI_*` y `OPENAI_*`.

## Codigo agregado

- `packages/autonomy/src/generator.ts`
  - soporte `llmBaseUrl`, `llmModel`, `llmApiKey`
  - no requiere api key cuando el endpoint es local compatible
- `packages/autonomy/src/index.ts`
  - `resolveAutonomyLlmStatus`
  - logging del target LLM
- `apps/api/src/modules/autonomy/autonomy.service.ts`
  - exposicion y resolucion de estado del proveedor
- `apps/api/src/modules/autonomy/autonomy.controller.ts`
  - `GET /v1/autonomy/provider`
- `apps/web/app/(app)/admin/autonomy/page.tsx`
  - tarjeta visible con proveedor/modelo/endpoint
- `apps/web/app/api/semse/autonomy/provider/route.ts`
  - proxy web al estado del proveedor
- `scripts/start-local-llm.mjs`
- `scripts/pull-local-llm.mjs`
- `scripts/local-llm-smoke.mjs`

## Scripts agregados

- `npm run llm:local:start`
- `npm run llm:local:pull`
- `npm run smoke:llm:local`

## Estado

- Integracion de software: implementada
- Runtime local: instalado
- Runtime validado: `Ollama 0.13.5`
- Modelo local bootstrap inicial: `llama3.2:1b`
- Modelo operativo recomendado: `qwen2.5:3b`
- Conexion visible en UI/API: validada

## Validaciones ejecutadas

- `GET http://127.0.0.1:11434/api/tags`
  - confirma descarga local del modelo disponible
- `POST http://127.0.0.1:11434/v1/chat/completions`
  - respuesta correcta desde endpoint OpenAI-compatible
- `GET http://127.0.0.1:3000/api/semse/autonomy/provider`
  - resultado validado:
    - `provider: ollama`
    - `model: qwen2.5:3b` como objetivo operativo
    - `baseUrl: http://127.0.0.1:11434/v1`
    - `configured: true`

## Operacion repetible

- arranque runtime local:
  - `npm run llm:local:start`
- descarga de modelo:
  - `SEMSE_LOCAL_LLM_MODEL=qwen2.5:3b npm run llm:local:pull`
- API conectada al LLM local:
  - `npm run dev:api:local-llm`
  - `npm run start:api:local-llm`
- web apuntando a API local:
  - `SEMSE_API_BASE_URL=http://127.0.0.1:4132 NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED=true npm run dev:web`

## Estado de plataforma observable

- web: `http://localhost:3000`
- provider status en web proxy: `http://localhost:3000/api/semse/autonomy/provider`
- api llm-backed levantada para integracion local: `http://127.0.0.1:4132`
- runtime llm local: `http://127.0.0.1:11434`

## Siguiente corte tecnico

1. ejecutar un run de autonomia real usando `ollama`
2. persistir configuracion local en `.env.local` o perfil de servicio
3. definir politica de modelos locales por entorno: `1b`, `3b`, `8b`
