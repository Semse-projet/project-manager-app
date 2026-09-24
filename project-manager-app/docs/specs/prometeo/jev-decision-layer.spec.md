---
id: "prometeo.jev-decision-layer"
title: "Jev Decision Layer — piloto: Agent Router + Sense Vision Decision Gate"
domain: "prometeo"
sdd_version: "2.0"
version: "1.2"
status: "APPROVED"
owner: "semse-core"
risk: "medium"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags:
  - "SEMSE_JEV_ENABLED"
  - "SEMSE_JEV_AGENT_ROUTER_ENABLED"
  - "SEMSE_JEV_VISION_GATE_ENABLED"
  - "SEMSE_JEV_AGENT_ROUTER_MODE"
  - "SEMSE_JEV_VISION_GATE_MODE"
  - "SEMSE_JEV_CANARY_TENANT_IDS"
  - "SEMSE_JEV_CANARY_USER_IDS"
  - "SEMSE_JEV_CANARY_ROLES"
  - "SEMSE_JEV_CANARY_PERCENT"
production_evidence: []
related_files:
  - "apps/api/src/modules/ai-models/decision/decision.types.ts"
  - "apps/api/src/modules/ai-models/decision/decision-flags.ts"
  - "apps/api/src/modules/ai-models/decision/jev.provider.ts"
  - "apps/api/src/modules/ai-models/decision/decision-layer.service.ts"
  - "apps/api/src/modules/ai-models/decision/agent-router.ts"
  - "apps/api/src/modules/ai-models/decision/vision-gate.ts"
  - "apps/api/src/modules/ai-models/decision/decision-layer.module.ts"
  - "apps/api/src/modules/ai-models/decision/decision-invariants.ts"
  - "apps/api/src/modules/ai-models/decision/decision-circuit-breaker.ts"
  - "apps/api/src/modules/ai-models/decision/decision-eval.ts"
  - "apps/api/scripts/jev-eval.mjs"
  - "apps/api/src/modules/ai-models/ai-models.controller.ts"
  - "apps/api/src/modules/vision/vision-library.service.ts"
  - "packages/db/prisma/schema.prisma"
related_tests:
  - "apps/api/test/jev-decision-layer.test.ts"
  - "apps/api/test/jev-agent-router.test.ts"
  - "apps/api/test/jev-vision-gate.test.ts"
  - "apps/api/test/jev-invariants.test.ts"
  - "apps/api/test/jev-eval-harness.test.ts"
  - "apps/api/test/jev-decision-telemetry-integration.test.ts"
  - "tests/unit/sense-vision-client.test.ts"
related_endpoints:
  - "POST /v1/ai-models/agent-route"
  - "POST /v1/ai-models/prometeo/chat"
  - "POST /v1/vision/recognize"
related_events: []
related_agents: []
last_verified: "2026-09-24"
---

# Spec: Jev Decision Layer (piloto)

> Contrato ejecutable SDD 2.0.

**Aprobación:** instrucción explícita del dueño del producto en la sesión
("SEMSE PROJECT — JEV DECISION LAYER"), que fija alcance (dos pilotos),
restricciones de seguridad, flags y fallback. Este spec la traduce a las
convenciones del repo; no se infirió activación en producción.

## 0. ZOOM — estado real

| Capa | Estado | Evidencia |
|---|---|---|
| "Jev" en el repo / Drive | NO EXISTE | `grep -rniI "\bjev\b"` vacío; búsqueda en Drive vacía. **No hay API documentada de Jev.** |
| Router determinista de Prometeo | LIVE | `PrometeoOrchestratorService.classifyIntent()` (keywords) → `routeToAgent()` → `mapIntentToTaskType()`; consumido en `POST /v1/ai-models/prometeo/chat` y `project-copilot.harness.ts`. |
| Selección de modelo | LIVE | `POST /v1/ai-models/route` = `AiModelRouterService.selectRoute()` (por eso el router de capacidades usa `agent-route`) (tabla estática taskType→slug) + `AdaptiveRouter` (infra/llm). No se tocan. |
| Gate de pagos en chat | LIVE | `ai-models.controller.ts` marca `human_required` para liberar pagos. No se toca. |
| Telemetría de modelos | LIVE | `AiInteractionLog` (llamadas a modelo). No modela decisión vs. acción final. |
| `AgentDecision` | LIVE | Hallazgos/propuestas de loops autónomos — semántica distinta. |
| Sense Vision | PR #669 | `VisionLibraryService.recognize()` → `decideRecognition()` (política de confianza determinista). |

## 1. Problema y resultado

Queremos medir si un modelo de decisión rápido ("Jev") mejora decisiones
estructuradas sin debilitar la gobernanza. Resultado: una **capa de decisión
enchufable** que (a) propone, (b) SEMSE valida, (c) si falla o no está
activa, el comportamiento determinista actual continúa idéntico, y (d) cada
decisión queda registrada junto a la acción final y su resultado.

## 2. Alcance

### Incluido
1. Contratos: `AgentRouteDecision`, `VisionGateDecision`, `WorkflowDecision` y
   (solo tipos, sin cableado) `EvidenceDecision`, `ChangeOrderDecision`,
   `ModelTierDecision`.
2. `JevProvider` (adapter HTTP, timeout, validación estricta de formato).
3. `DecisionLayerService.decide(feature, input, fallback)` con flags,
   canary por tenant, umbral de confianza, fallback y telemetría.
4. Piloto 1 — **Agent Router**: `POST /v1/ai-models/agent-route` y anotación
   `routing` en `prometeo/chat`. Fallback = mapeo determinista desde
   `classifyIntent()`.
5. Piloto 2 — **Vision Decision Gate**: tras el matching con la librería,
   `recognize` devuelve `gate` (`ACCEPT_RESULT | SHOW_ALTERNATIVES |
   RETRY_SCAN | ASK_USER | ESCALATE_MODEL | UNKNOWN`). Fallback =
   gate determinista derivado de la política de confianza existente.
6. Tabla `JevDecisionEvent` + registro de resultado (`outcome`) cuando el
   usuario corrige o guarda.

### Fuera de alcance
Cableado de Evidence, Change Orders, selección de tier de modelo y flujos
autónomos (solo contratos); cualquier activación en producción; reemplazar
Prometeo, GPT/Claude, la librería, `AiModelRouterService` o `AdaptiveRouter`.

## 3. Límites de seguridad (no negociables)

- La capa **solo devuelve datos**. `DecisionLayerService` no depende de
  ningún servicio de pagos, escrow, evidence, contratos, auth ni RBAC; un
  test lo verifica.
- Las features aceptadas son una lista cerrada (`agent_router`,
  `vision_gate`); cualquier otra (p. ej. `escrow_release`) lanza error antes
  de llamar al proveedor. Nunca se agregan features para: autorización,
  identidad, permisos, dinero, escrow, mutación irreversible, borrado de
  Evidence, aprobación contractual, cumplimiento legal, secretos o acceso
  administrativo.
- Toda acción devuelta se valida contra la allowlist de su feature y contra
  invariantes del estado (p. ej. `ACCEPT_RESULT` exige objeto; `SHOW_ALTERNATIVES`
  exige alternativas). Si no cumple → fallback.
- `ESCALATE`/`ASK_USER` del router **no ejecutan nada**: son etiquetas que
  la UI o el workflow autorizado interpretan. El gate `human_required` de
  pagos en `prometeo/chat` queda intacto.
- `JEV_API_KEY` vive solo en el servidor (semse-API).

## 4. Escenarios y criterios de aceptación

- **J1 flags apagados (default):** comportamiento idéntico al actual; sin
  llamada a Jev; sin fila de telemetría. `source: "deterministic"`.
- **J2 decisión válida ≥ umbral:** se usa la decisión de Jev (`source: "jev"`).
- **J3 formato inválido / acción fuera de allowlist:** fallback,
  `fallbackReason: "invalid_response"`.
- **J4 timeout (`JEV_TIMEOUT_MS`, default 800):** fallback, `"timeout"`.
- **J5 confianza < `SEMSE_JEV_MIN_CONFIDENCE` (default 0.7):** fallback, `"low_confidence"`.
- **J6 proveedor no configurado / caído:** fallback, `"unavailable"`/`"provider_error"`.
- **J7 tenant fuera de canary:** fallback, `"not_in_canary"`, sin llamada.
- **J8 router en modo `shadow` (default):** la decisión de Jev se registra
  pero el intent de chat no cambia y el cliente recibe la capacidad
  determinista (la propuesta de Jev solo vive en `JevDecisionEvent`). En `assist`, solo reemplaza intents
  `unknown` por el intent equivalente (ESTIMATE/EVIDENCE/BUILDOPS).
- **J9 Vision:** `recognized`→ACCEPT_RESULT; `uncertain` con alternativas →
  SHOW_ALTERNATIVES; `uncertain` sin alternativas → ASK_USER; `unknown` por
  baja confianza/sin candidatos → RETRY_SCAN; `not_in_library`/`unavailable` →
  UNKNOWN; `malformed_result` → ESCALATE_MODEL; `error` → RETRY_SCAN.
- **J10 invariantes:** Jev no puede aceptar un resultado sin objeto ni
  mostrar alternativas inexistentes.
- **J11 feature sensible:** `decide("escrow_release", …)` lanza error.

## 5. Contratos

```ts
type DecisionFeature = "agent_router" | "vision_gate";
type AgentRouteAction = "PROMETEO"|"ESTIMATE"|"BUILDOPS"|"EVIDENCE"|"CHANGE_ORDER"|"VISION"|"ASK_USER"|"ESCALATE";
type VisionGateAction = "ACCEPT_RESULT"|"SHOW_ALTERNATIVES"|"RETRY_SCAN"|"ASK_USER"|"ESCALATE_MODEL"|"UNKNOWN";
type WorkflowDecision = "CONTINUE"|"RETRY"|"ASK_USER"|"ESCALATE"|"STOP";
// Futuro (solo tipos):
type EvidenceDecision = "CONTINUE"|"REQUEST_MORE_EVIDENCE"|"HUMAN_REVIEW"|"BLOCK";
type ChangeOrderDecision = "NO_CHANGE"|"POTENTIAL_CHANGE_ORDER"|"REQUEST_DETAILS"|"ESCALATE";
type ModelTierDecision = "FAST_MODEL"|"STANDARD_MODEL"|"ADVANCED_MODEL"|"HUMAN_REVIEW";

type StructuredDecision<A> = { action: A; confidence: number; reasonCode: string };
type DecisionOutcome<A> = StructuredDecision<A> & {
  source: "jev" | "deterministic";
  fallbackReason?: "disabled"|"not_in_canary"|"unavailable"|"timeout"|"invalid_response"|"low_confidence"|"provider_error"|"invariant_violation";
  eventId?: string; latencyMs: number; model?: string;
};
```

**Adapter Jev:** ~~contrato supuesto `POST /v1/decide`~~ reemplazado en v1.2
por la API real de TypeSafe AI — ver §9.8.

## 6. Datos

`JevDecisionEvent` (tabla nueva; por qué no reutilizar: §0):
`id, tenantId, userId?, feature, decision, confidence, reasonCode, source,
fallbackUsed, fallbackReason?, latencyMs, model?, finalSystemAction,
outcome?, createdAt`. Sin input crudo (ni mensajes ni imágenes). Solo se
escribe cuando `SEMSE_JEV_ENABLED` y la feature están activos.
`outcome` se completa con `user_corrected` (corrección de Vision) o
`user_saved` (guardar palabra) cuando el cliente envía `decisionEventId`.

## 7. Configuración

| Variable | Default | Uso |
|---|---|---|
| `SEMSE_JEV_ENABLED` | `false` | interruptor maestro |
| `SEMSE_JEV_AGENT_ROUTER_ENABLED` | `false` | piloto 1 |
| `SEMSE_JEV_VISION_GATE_ENABLED` | `false` | piloto 2 |
| `SEMSE_JEV_AGENT_ROUTER_MODE` | `shadow` | `shadow` \| `assist` |
| `SEMSE_JEV_CANARY_TENANT_IDS` | vacío = todos | lista separada por comas |
| `SEMSE_JEV_MIN_CONFIDENCE` | `0.7` | umbral |
| `JEV_BASE_URL`, `JEV_API_KEY`, `JEV_MODEL`, `JEV_TIMEOUT_MS` | —, —, —, `800` | proveedor |

## 8. Tests requeridos

- [x] `jev-decision-layer.test.ts`: válida, inválida, timeout, baja confianza,
      unavailable, fallback, flags apagados, canary, feature sensible, sin
      dependencias sensibles, telemetría (y fallo de telemetría no rompe).
- [x] `jev-agent-router.test.ts`: mapeo determinista, shadow vs assist.
- [x] `jev-vision-gate.test.ts`: ACCEPT_RESULT, SHOW_ALTERNATIVES, RETRY_SCAN,
      ASK_USER, UNKNOWN, ESCALATE_MODEL, invariantes, cierre de outcome.
- [x] `jev-decision-telemetry-integration.test.ts` (Postgres real): registro y
      `outcome` aislado por tenant.
- [x] `sense-vision-client.test.ts`: `presentGate` (gate → UI) y compatibilidad
      con respuestas sin `gate`.

---

## 9. Wave 0 — cierre de la plataforma central (v1.1)

**Aprobación:** handoff actualizado por el dueño del producto (mismo Google
Doc, §33–60 "Jev Decision Layer — expansión a todo el ecosistema"). El §57 del
propio handoff prohíbe empezar una wave nueva antes de cerrar la anterior con
tests, **métricas de shadow** y fallback verificado; por eso esta versión
cierra Wave 0 y **no** implementa Waves 1–5 (requieren datos de shadow de
producción que solo existen tras una activación humana).

### 9.1 Contrato central (§34)

`DecisionRequest { feature, actor{tenantId,userId,roles}, context, candidates?,
deterministicDecision, riskSignals?, correlationId?, inputClass? }` →
`DecisionResult { action, confidence, reasonCode, source, provider, mode,
shadowMode, fallbackReason?, deterministic, jev?, agreement?,
invariantsViolated?, canary?, eventId?, latencyMs, model?, costUsd? }`.
Un único `DecisionLayerService.decide()`; ningún módulo tiene adapter propio.
La línea base determinista **no** se envía a Jev (el acuerdo en shadow solo
significa algo si Jev decide de forma independiente).

### 9.2 Modo, canary y circuit breaker (§52–53)

- **Modo por feature** (`SEMSE_JEV_<FEATURE>_MODE`): `shadow` (default) o
  `live` (`assist` es sinónimo para el router). En shadow el núcleo devuelve
  siempre la decisión determinista y registra la de Jev. **Cambio respecto a
  v1.0:** el Vision Gate ahora también arranca en shadow.
- **Canary:** coincide por tenant, usuario, rol interno (p. ej. `OPS_ADMIN`)
  o porcentaje estable (hash de feature+tenant+usuario). Sin configuración de
  canary, todos (una vez encendidos los flags).
- **Circuit breaker** por feature: tras `SEMSE_JEV_BREAKER_THRESHOLD` (5)
  fallos de disponibilidad consecutivos, no se llama a Jev durante
  `SEMSE_JEV_BREAKER_COOLDOWN_MS` (30 s) → `fallbackReason: "circuit_open"`;
  luego una llamada de prueba (half-open). Respuestas inválidas no abren el
  breaker.

### 9.3 Registro de invariantes (§33, §54)

`decision-invariants.ts`, aplicado por el núcleo a **toda** decisión de Jev
(también en shadow, para medir intentos). El caller declara `riskSignals`;
cada feature define un rango de `caution` por acción.

| Invariante | Regla |
|---|---|
| `MONEY_NO_DOWNGRADE` | con `money`, Jev no puede bajar la cautela de la decisión determinista |
| `PERMISSION_DENIAL_NO_DOWNGRADE` | ídem con `permissionDenied` |
| `IDENTITY_FAILURE_NO_DOWNGRADE` | ídem con `identityFailure` |
| `LEGAL_COMPLIANCE_NO_DOWNGRADE` | ídem con `legalCompliance` |
| `SAFETY_CRITICAL_NO_DOWNGRADE` | ídem con `safetyCritical` |
| `IRREVERSIBLE_REQUIRES_DETERMINISTIC_AUTH` | con `irreversible`, solo la decisión determinista puede quedar |
| `LOW_CONFIDENCE_NOT_CERTAINTY` | con `lowConfidence`, Jev no puede elegir una acción de certeza (`ACCEPT_RESULT`) |
| `PROVIDER_FAILURE_FALLS_BACK` | estructural: todo fallo del proveedor devuelve la decisión determinista |

Un test por invariante en `jev-invariants.test.ts`. Pilotos: el router marca
`money` en pedidos de liberar pagos (reemplaza la invariante ad-hoc de v1.0);
el gate marca `lowConfidence` para todo estado que no sea `recognized`
(**cambio:** Jev ya no puede aceptar un match `uncertain`).

### 9.4 Telemetría (§55)

Migración aditiva `20260924210000_jev_decision_event_wave0`: `provider`,
`mode`, `canary`, `deterministicDecision`, `jevDecision`, `jevConfidence`,
`jevReasonCode`, `agreement`, `invariantsViolated[]`, `inputClass`,
`correlationId` (= requestId), `costUsd`, más índices `(feature, mode,
agreement)` y `(correlationId)`. `decision/confidence/reasonCode` son ahora la
decisión **final** devuelta; la de Jev va en `jev*`. Sigue sin guardarse el
contexto crudo.

### 9.5 Harness de evaluación (§56)

`decision-eval.ts` + fixtures etiquetadas en `apps/api/test/fixtures/jev-eval/`
(router: 22 casos; vision gate: 14) usando la línea base determinista real.
Métricas: accuracy determinista / Jev / final, acuerdo, abstención, validez de
schema, downgrades inseguros bloqueados, fallbacks por motivo, latencia
p50/p95 y costo. `pnpm --filter @semse/api jev:eval` corre contra el Jev real
(`JEV_BASE_URL`/`JEV_API_KEY`); `--mock baseline` hace un dry run. Línea base
actual en las fixtures: router 0.864, vision gate 0.929.

### 9.6 Criterios de activación (§58) — estado

| Criterio (antes de canary) | Estado |
|---|---|
| fallback determinista / timeout / schema inválido / proveedor caído / baja confianza probados | ✅ tests |
| invariantes con tests verdes | ✅ `jev-invariants.test.ts` |
| telemetría persistente | ✅ Postgres real |
| sin secretos filtrados | ✅ `JEV_API_KEY` solo server-side; sin contexto crudo |
| flag independiente por feature + rollback simple | ✅ `SEMSE_JEV_ENABLED=false` apaga todo |
| API real de Jev conectada | ✅ adapter `/v1/systemone` (v1.2) — ❌ sin probar en vivo: falta API key válida y el host está bloqueado por la política de red del entorno de desarrollo |
| datos de shadow revisados | ❌ requiere activación en shadow (decisión humana) |

### 9.7 Tests Wave 0

- [x] `jev-decision-layer.test.ts` (modos, canary, breaker, telemetría completa)
- [x] `jev-invariants.test.ts` (un test por invariante + integración con el núcleo)
- [x] `jev-eval-harness.test.ts` (oráculo, adversario, fallos)
- [x] `jev-agent-router.test.ts`, `jev-vision-gate.test.ts` actualizados
- [x] `jev-decision-telemetry-integration.test.ts` (columnas nuevas en Postgres real)

### 9.8 Adapter real: TypeSafe AI `/v1/systemone` (v1.2)

Jev es el "System One model" de TypeSafe AI. Contrato (docs públicas de
TypeSafe/terceros; el dominio no es accesible desde el entorno de desarrollo):

```
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <JEV_API_KEY>
{ "state": <object>, "model": "jev-latest",
  "questions": { "decision": { "type": "choice", "instructions": "...",
                               "criteria": { "<ACTION>": "<descripción>", ... } } } }
→ { "model": "jev-1.13.0",
    "answers": { "decision": { "type": "choice", "choice": "<ACTION>",
                               "probabilities": { "<ACTION>": p, ... }, "confidence": 0.82 } },
    "usage": { "input_tokens": 312, "output_tokens": 48 } }
```

- Cada decisión = **una** pregunta `choice` cuyas opciones son exactamente las
  acciones permitidas de la feature (`DECISION_FEATURES[f].question`), así el
  espacio de respuesta de Jev es la allowlist por construcción.
- `state` = `{ feature, context, candidates?, riskSignals? }` (sin baseline).
- `confidence` de Jev → confianza; si falta, la probabilidad de la opción
  elegida. `reasonCode` = `JEV_CHOICE` (Jev devuelve respuestas tipadas, no
  razones).
- `model` de la respuesta (versión resuelta) → telemetría; costo =
  `usage.input_tokens × $0.042/M` (output gratis).
- Errores `{"detail":{"error_type",...}}` (p. ej. 401 `authentication_error`)
  → `provider_error` (cuenta para el circuit breaker); se registra solo el
  `error_type`, nunca la key.
- `JEV_BASE_URL` default `https://api.typesafe.ai`; `JEV_MODEL` default
  `jev-latest` (se recomienda fijar versión, p. ej. `jev-1.13.0`, antes de live).

