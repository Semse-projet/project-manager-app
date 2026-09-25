---
type: plan
feature: "jev-decision-layer"
domain: "prometeo"
spec: "docs/specs/prometeo/jev-decision-layer.spec.md"
version: "2.0"
status: "APPROVED"
branch: "claude/google-docs-link-f39dr2"
date: "2026-09-24"
---

# Plan técnico: Jev Decision Layer (piloto)

## 1. Punto de integración

- **Agent Router:** `AiModelsController.prometeoChat` justo donde antes se llamaba
  `classifyIntent()` → ahora `routeAgentRequest()` (envuelve `classifyIntent`, que
  sigue siendo la fuente de verdad) + endpoint nuevo `POST /v1/ai-models/agent-route`.
  `POST /v1/ai-models/route` ya existía (selección de modelo) y no se toca.
- **Vision Gate:** `VisionLibraryService.recognize()` después de
  `decideRecognition()` (matching con la librería), antes de responder a la UI.

## 2. Estructura

```
apps/api/src/modules/ai-models/decision/
  decision.types.ts            contratos + registro cerrado de features
  decision-flags.ts            flags / canary / umbral / config del proveedor
  jev.provider.ts              adapter HTTP + parseo estricto
  decision-layer.service.ts    decide(): flags → canary → Jev → validación → fallback → telemetría
  decision-telemetry.repository.ts  JevDecisionEvent (Prisma)
  agent-router.ts              router determinista + invariante de dinero + shadow/assist
  vision-gate.ts               gate determinista + invariantes
  decision-layer.module.ts     módulo liviano importado por AiModels y Vision
```

Se ubica dentro de `ai-models/` (dueño del routing de Prometeo) en vez de un
módulo top-level paralelo; el módulo Nest es liviano para que Vision lo importe
sin arrastrar Finance/Intelligence/Prometeo.

## 3. Decisiones

| Decisión | Motivo |
|---|---|
| Fallback = router/política existentes | Jev nunca es punto único de fallo; flags off ⇒ comportamiento idéntico. |
| Shadow por defecto, assist solo rellena `unknown` | Medir antes de dejar que cambie rutas. |
| Invariantes de estado | Jev no puede aceptar objetos inexistentes ni rebajar un ESCALATE de dinero. |
| Tabla propia `JevDecisionEvent` | `AiInteractionLog`/`AgentDecision` no modelan decisión vs. acción final vs. resultado. |
| Timeout 800 ms | Acota la latencia añadida al chat y a la cámara. |

## 4. Riesgos

- API real de Jev desconocida → adapter asumido (§5 del spec).
- Latencia añadida (≤ timeout) en chat y en cada frame cuando los flags están on.
- Volumen de filas de telemetría en Vision (~1 por frame por usuario activo) → usar canary.
