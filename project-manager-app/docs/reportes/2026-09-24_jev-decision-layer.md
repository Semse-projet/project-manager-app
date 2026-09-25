# Reporte — Jev Decision Layer (piloto: Agent Router + Sense Vision Decision Gate)

- **Fecha:** 2026-09-24
- **Rama:** `claude/google-docs-link-f39dr2` (sobre el trabajo de Sense Vision, PR #669)
- **Spec:** `docs/specs/prometeo/jev-decision-layer.spec.md` (+ plan, tasks, checklist)

## Arquitectura encontrada

- "Jev" no existe en el repo ni en Drive → **API de Jev no documentada**; se definió un adapter con contrato propio.
- Router determinista: `PrometeoOrchestratorService.classifyIntent()` (keywords) → `routeToAgent()` → `mapIntentToTaskType()`.
- Selección de modelo: `POST /v1/ai-models/route` → `AiModelRouterService` (+ `AdaptiveRouter` en infra/llm). No se toca.
- Gate de pagos `human_required` en `prometeo/chat`. No se toca.
- Telemetría existente: `AiInteractionLog` (llamadas a modelo) y `AgentDecision` (loops autónomos) — ninguna modela decisión vs. acción final vs. resultado.

## Integración

| Piloto | Punto exacto | Fallback |
|---|---|---|
| Agent Router | `AiModelsController.routeAgentRequest()` (usado por `prometeo/chat`) + `POST /v1/ai-models/agent-route` | `deterministicAgentRoute(classifyIntent(message))` |
| Vision Gate | `VisionLibraryService.recognize()` → `decideGate()` tras el matching con la librería | `deterministicVisionGate()` derivado de la política de confianza |

## Verificación

- Tests nuevos: `jev-decision-layer` (14), `jev-agent-router` (8), `jev-vision-gate` (8), `jev-decision-telemetry-integration` (1, Postgres real) + 2 en `sense-vision-client`.
- Migración `20260924180000_jev_decision_event` aplicada en Postgres local, sin drift.
- Smoke con Jev simulado (API + vision-service + Ollama simulado):
  - Jev válido → usado.
  - Pago → ESCALATE aunque Jev propuso otra cosa (`invariant_violation`).
  - Timeout → fallback a los 800 ms.
  - Gate `SHOW_ALTERNATIVES` de Jev → la corrección del usuario cierra el `outcome` (`user_corrected`).
  - `/route` de modelos intacto.
- El boot real detectó un choque con `POST /v1/ai-models/route` existente → endpoint renombrado a `agent-route`.
- El smoke detectó que en `shadow` el cliente recibía la acción de Jev → corregido: en `shadow` el cliente recibe la determinista.

## Deuda técnica / pendientes

1. Conectar la API real de Jev (solo cambia `jev.provider.ts`).
2. El router determinista de capacidades es por keywords (igual que `classifyIntent`); `CHANGE_ORDER`/`VISION` no tienen intent de chat equivalente.
3. En Vision, con flags on, se escribe ~1 fila por frame analizado → activar con `SEMSE_JEV_CANARY_TENANT_IDS` y agregar muestreo/retención antes de escalar.
4. No hay dashboard aún para comparar tasas de acuerdo Jev vs. determinista vs. outcome (consultas SQL sobre `JevDecisionEvent`).
5. Web: la UI no consume todavía `routing` del chat (el hint queda disponible para un paso posterior).

## Recomendación para extender

Evidence → `EvidenceDecision` como **pre-clasificador de revisión** (CONTINUE / REQUEST_MORE_EVIDENCE / HUMAN_REVIEW), con `BLOCK` solo como sugerencia a un humano y sin tocar el FSM de milestones ni escrow. Solo después de ≥ 2 semanas en `shadow` con acuerdo medido contra decisiones humanas. Mismo patrón para Change Orders (sugerir `POTENTIAL_CHANGE_ORDER` al PM) y ModelTier (pre-selección antes de `AiModelRouterService`, respetando `privacyLevel`/SPEC-GTW-001). Cada feature nueva = entrada en `DECISION_FEATURE_ACTIONS` + spec.
