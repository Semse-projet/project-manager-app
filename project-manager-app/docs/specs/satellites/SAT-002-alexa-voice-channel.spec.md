---
id: "satellites.alexa-voice"
title: "SAT-002 — Alexa como canal de voz de Prometeo/Smart-Intake"
type: spec
domain: "communications"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
date: "2026-07-05"
author: "Claude — sesión planificación satélites"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/communications
related_tests: []
related_endpoints:
  - v1/intake
related_events: []
related_agents:
  - prometeo
last_verified: ""
---

# Spec: Alexa como canal de voz (satélite `~/alexa-openai-skill`)

## Problem Statement

La skill de Alexa hoy llama directo a OpenAI: responde genérico, sin conocer SEMSE,
sin crear leads ni intakes. Es un canal de voz desconectado del negocio.

## Scope

- In scope: redirigir la Lambda hacia SEMSE vía `@semse/sdk`, mapear sesión de voz → sesión de smart-intake, respuestas cortas aptas para voz.
- Out of scope: cuentas de usuario vinculadas a Alexa, pagos por voz, multi-idioma más allá de ES.

## Non-Goals

- No se migra la Lambda al monorepo; sigue viviendo en `~/alexa-openai-skill` / AWS.

## 1. Arquitectura

```
Usuario habla → Alexa Skill → AWS Lambda ──@semse/sdk──► POST /v1/intake (SEMSE)
                                   ▲                          │
                                   └── respuesta ≤ 90 palabras ┘
```

- La Lambda guarda `sessionId` de Alexa ↔ `intakeSessionId` de SEMSE (DynamoDB o session attributes de Alexa).
- Token satélite `alexa` con scopes `intake:write`, `intake:read` (SAT-001).
- Kill switch `SATELLITE_ALEXA_ENABLED`; en OFF la skill responde el fallback actual (OpenAI directo) para no morir en vivo.

## 2. Lado SEMSE (lo único que toca el monorepo)

- Aceptar en smart-intake el header `x-semse-channel: alexa` para: (a) marcar el origen del lead, (b) activar perfil de respuesta `voice` (respuestas cortas, sin markdown, sin links).
- El pipeline de intake existente (anónimo, SSE, 7 categorías, scoring) no cambia: Alexa es solo otro cliente.

## 3. Lado satélite (documentado, fuera del repo)

- Reemplazar la llamada OpenAI por `sdk.intake.send()` en `lambda/`.
- Manejo de intents: `LaunchRequest` → saludo SEMSE; `AMAZON.StopIntent` → cierre + resumen del intake si hay uno abierto.
- Truncado/resumen de respuesta a formato de voz (la API ya devuelve texto de perfil `voice`).

## 4. Flujo objetivo (happy path)

1. "Alexa, abre SEMSE" → saludo y pregunta qué proyecto tiene.
2. Usuario describe: "quiero remodelar mi baño" → intake categoría bathroom, preguntas de scoring por voz.
3. Al completar: intake creado en SEMSE, visible en admin, con canal `alexa`.
4. Usuario recibe cierre: "listo, un profesional te contactará".

## 5. Acceptance Criteria (arnés SAT-000)

- [ ] Anillo 1: contrato de intake con `x-semse-channel: alexa` + perfil voice; token alexa sin scope `jobs:*` → 403.
- [ ] Anillo 2: `sdk.intake` cubierto.
- [ ] Anillo 3: e2e con simulador de request Alexa (JSON de intent real) contra API local — intake completo por "voz".
- [ ] Anillo 4: smoke con la skill real en dispositivo/console contra Railway; lead visible en `/admin`; evidencia en `docs/reportes/`.
- [ ] Fallback verificado: flag OFF ⇒ la skill sigue respondiendo (modo OpenAI legacy).
