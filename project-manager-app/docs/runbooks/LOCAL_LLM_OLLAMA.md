# Local LLM con Ollama para SEMSE

## Objetivo

Conectar un runtime LLM local al ecosistema canónico de SEMSE sin depender de OpenAI remoto.

## Componentes

- Runtime local: `Ollama`
- Modelo sugerido base CPU: `qwen2.5:3b`
- Integración SEMSE: `packages/autonomy` + `apps/api/src/modules/autonomy`

## Arranque

```bash
npm run llm:local:start
```

Por defecto:

- host: `127.0.0.1:11434`
- store de modelos: `~/.local/share/ollama/models`

## Descarga de modelo

```bash
SEMSE_LOCAL_LLM_MODEL=qwen2.5:3b npm run llm:local:pull
```

## Smoke

```bash
SEMSE_LOCAL_LLM_MODEL=qwen2.5:3b npm run smoke:llm:local
```

Este smoke valida:

- `GET /api/tags`
- disponibilidad del modelo configurado
- `POST /v1/chat/completions`

## Smoke de autonomía útil

```bash
SEMSE_API_URL=http://127.0.0.1:4132 npm run smoke:autonomy:local-llm
```

Este smoke no solo valida conectividad: falla si la autonomía cae a `fallback`.

## Variables para conectar SEMSE

```bash
SEMSE_AUTONOMY_LLM_PROVIDER=ollama
SEMSE_AUTONOMY_LLM_BASE_URL=http://127.0.0.1:11434/v1
SEMSE_AUTONOMY_LLM_MODEL=qwen2.5:3b
SEMSE_AUTONOMY_LLM_API_KEY=ollama
```

Notas:

- `SEMSE_AUTONOMY_LLM_API_KEY` es opcional para endpoints locales compatibles.
- El código aún acepta `SEMSE_AUTONOMY_OPENAI_*` y `OPENAI_*` como compatibilidad hacia atrás.

## Arranque de la API ya conectada al LLM local

Desarrollo:

```bash
npm run dev:api:local-llm
```

Binario compilado:

```bash
npm run start:api:local-llm
```

Ese comando ya levanta la API local sobre `127.0.0.1:4132` usando `qwen2.5:3b` por defecto.

Si quieres que la web en desarrollo use una API concreta, arráncala con:

```bash
SEMSE_API_BASE_URL=http://127.0.0.1:4132 NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED=true npm run dev:web
```

## Verificación dentro de la plataforma

- UI: `/admin/autonomy`
- API: `GET /v1/autonomy/provider`

La pantalla de autonomía mostrará:

- proveedor activo
- modelo activo
- endpoint configurado
- estado de configuración

## Estado validado en esta máquina

Fecha de validación: `2026-04-16`

- `Ollama` activo en `http://127.0.0.1:11434`
- modelo recomendado operativo: `qwen2.5:3b`
- endpoint compatible validado: `POST /v1/chat/completions`
- web validada vía `http://127.0.0.1:3000/api/semse/autonomy/provider`
