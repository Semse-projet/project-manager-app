---
id: "satellites.observer-nodes"
title: "SAT-008 — Satélites como nodos externos en Observer/Consciousness"
type: spec
domain: "ops"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
date: "2026-07-05"
author: "Claude — sesión planificación satélites"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/ops
related_tests: []
related_endpoints:
  - v1/ops/consciousness
related_events: []
related_agents: []
last_verified: "2026-07-12"
---

# Spec: Satélites en Observer/Consciousness

## Problem Statement

Con SAT-001..007 SEMSE queda conectado a órganos externos que pueden fallar en
silencio (Lambda caída, graphify sin ingesta, webhook suspendido). El espejo interno
(Consciousness, LIVE desde 2026-05-18) no los ve: el organismo no percibe sus
extremidades.

## Scope

- In scope: modelo `SatelliteNode` en Observer, heartbeat pasivo y activo, dimensión "conectividad satelital" en el índice de madurez, panel en `/admin`.
- Out of scope: auto-remediación (queda para autonomyLevel ≥ 2), alertas externas (usa Communications Gateway existente cuando se decida).

## 1. Modelo

```ts
interface SatelliteNode {
  name: string                     // alexa | mobile | graphify | storage | protools-embed
  spec: string                     // SAT-00X
  state: 'LIVE' | 'CONNECTED-STAGING' | 'SUSPENDED' | 'ARCHIVED'  // FSM de SAT-000 §3
  tokenId: string
  lastSeenAt: ISO8601 | null       // heartbeat
  sdkVersion: string | null
  webhooks: { active: number; suspended: number }
  latencyP95Ms: number | null
}
```

## 2. Heartbeat (dos vías, sin trabajo extra para los satélites)

1. **Pasivo (principal):** `lastUsedAt` del satellite token (SAT-001) + header `x-semse-sdk-version` que el SDK envía siempre ⇒ Observer deriva `lastSeenAt` y `sdkVersion` sin que el satélite haga nada.
2. **Activo (opcional):** satélites con salud propia (graphify `health()`, storage `health()`) son sondeados por un permanent-loop del worker (SPEC-AUT-001; respeta `AUTONOMY_LOOPS_ENABLED`).

Umbral: sin señal en 72h ⇒ nodo `STALE` (warning en Observer, no cambia la FSM).

## 3. Consciousness

- Nueva dimensión del SemseConsciousnessIndex: **conectividad satelital** = f(nodos LIVE con heartbeat fresco / nodos LIVE totales, webhooks suspendidos, divergencia `SATELLITES.md` vs estado observado).
- La divergencia documento↔realidad es señal de primera clase: si `SATELLITES.md` dice LIVE y Observer ve STALE, baja el índice (el organismo detecta autoengaño).
- Restricciones absolutas v1 intactas: observar y reportar; nunca actuar sobre satélites.

## 4. UI

- Sección "Satélites" en el ObserverPanel de `/admin`: tabla de nodos con estado, lastSeen, sdkVersion, webhooks; badge de divergencia.

## 5. Tasks

1. Derivación pasiva de heartbeat desde `lastUsedAt` + header de versión en el SDK.
2. Probe activo en worker para graphify/storage.
3. Dimensión de conectividad en Consciousness + tests de cálculo.
4. Panel en ObserverPanel.
5. Job de reconciliación `SATELLITES.md` ↔ estado observado (reporta divergencias, no las corrige).

## 6. Acceptance Criteria (arnés SAT-000)

- [ ] Anillo 1: cálculo de la dimensión testeado con fixtures (todo fresco, uno STALE, webhook suspendido, divergencia doc).
- [ ] Anillo 2: header `x-semse-sdk-version` presente en toda llamada del SDK (test en el SDK).
- [ ] Anillo 3: e2e — llamada vía SDK actualiza lastSeenAt; apagar graphify ⇒ probe marca STALE.
- [ ] Anillo 4: panel visible en Railway con al menos 2 nodos reales reportando; evidencia en `docs/reportes/`.
- [ ] El índice de madurez cambia de forma explicable (delta documentado) al activar la dimensión.
