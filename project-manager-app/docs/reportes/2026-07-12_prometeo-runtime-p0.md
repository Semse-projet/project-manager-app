# Reporte — Prometeo Runtime P0

Fecha: 2026-07-12

## Objetivo

Convertir el diagnóstico de Prometeo en una primera base implementable para pasar
de chat texto-respuesta a contrato operativo multimodal con tools, acciones
propuestas y estado de misión.

## Cambios implementados

- Se creó `packages/schemas/src/prometeo-runtime.schema.ts` con:
  - `PrometeoRequest`
  - `PrometeoResponse`
  - adjuntos multimodales
  - referencias de entidades
  - bloques de respuesta
  - acciones propuestas
  - resultados de tools
  - estado de misión
  - citas y refresh targets
  - descriptores de herramientas
- `POST /v1/ai-models/prometeo/chat` ahora acepta el envelope P0 y conserva
  compatibilidad legacy con `response`.
- Cada respuesta del chat operativo devuelve:
  - `message`
  - `blocks`
  - `proposedActions`
  - `executionResults`
  - `mission`
  - `citations`
  - `refreshTargets`
- Se agregó `GET /v1/prometeo/tools` con un registry inicial para:
  - Time Tracker
  - Vision / Evidence
  - SEMSE Agro
  - Payments
- El BFF `/api/semse/cortex/chat` transporta adjuntos, entidades, acción
  solicitada, misión y contexto de página.
- El chat global muestra tarjetas compactas de misión, adjuntos y acciones
  propuestas bajo la respuesta de Prometeo.
- Se actualizó el spec Prometeo y la superficie REST documentada.

## Límites explícitos

- El análisis binario de imagen/video no se ejecuta todavía desde el chat.
- Las mutaciones reales no se ejecutan desde Prometeo P0; se devuelven como
  `proposedActions`.
- `vision.analyze_video` queda declarado y bloqueado hasta tener pipeline de video
  intelligence.
- Acciones financieras críticas quedan con `approvalPolicy: human_required`.

## Verificación

Pasó:

```bash
pnpm --filter @semse/schemas build
node --experimental-strip-types --test apps/api/test/ai-models.controller.test.ts apps/api/test/prometeo.controller.test.ts
pnpm --filter @semse/api build
pnpm --filter @semse/web build
```
