# Reporte: Ollama como inteligencia nativa de SEMSE OS — Nivel 3

**Fecha:** 2026-05-17  
**Estado:** ✅ Cerrado — Nivel 3 validado  
**Próximo paso:** Nivel 4 — Producción / VPS / GPU

---

## Objetivo

Validar que Ollama puede operar como inteligencia nativa y local de SEMSE OS, reemplazando a Anthropic/OpenAI como provider default, respetando las políticas de privacidad, y produciendo JSON estructurado confiable para flujos operacionales reales.

---

## Modelos usados

| Modelo | Tamaño | Uso |
|--------|--------|-----|
| `qwen2.5:3b` | 1.9 GB | Flujos reales, JSON estructurado, ChangeOrderDetector |
| `qwen2.5:0.5b` | 397 MB | Iteración rápida, desarrollo |

**Instalación:** Ollama v0.13.5 como servicio systemd en `localhost:11434`

---

## Variables de entorno relevantes

```env
LLM_NATIVE_PROVIDER=ollama
LLM_DEFAULT_PROVIDER=ollama
LLM_FALLBACK_PROVIDERS=anthropic,openai,template
LLM_EXTERNAL_FALLBACK_PROVIDER=anthropic

ENABLE_OPEN_SOURCE_MODELS=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_TIMEOUT_MS=120000   # necesario para primera carga 3b en CPU sin GPU
```

Ver `.env.example` en `apps/api/` para documentación completa.

---

## Flujos probados

### Nivel 1 — Provider registrado
- OllamaProvider registrado como primer provider en el stack
- Logs: `[LLMOrchestrator] Provider registered: ollama (native/local)` aparece **antes** que anthropic/openai
- Validado con `scripts/test-ollama-semse.mjs`

### Nivel 2 — Flujos reales del ecosistema
| Flow | Módulo | routingReason | fallbackUsed |
|------|--------|--------------|-------------|
| `generateMissionControlNarrative` | OperationalIntelligence | local-only | false |
| `detectChangeOrderCandidate` | OperationalIntelligence | local-only | false |
| `explainEvidenceReadiness` | OperationalIntelligence | privacy-critical | false |

Validado con `scripts/smoke-ollama-real-flow.mjs`

### Nivel 3 — JSON estructurado confiable + fallback inteligente

#### ChangeOrderDetector — 10 casos

| Caso | Input | JSON válido | detected | risk correcto |
|------|-------|-------------|----------|---------------|
| C1 | Confirmación simple (no CO) | ✅ | ✅ false | — |
| C2 | Área adicional pequeña | ✅ | ✅ true | ✅ medium |
| C3 | Trabajo completamente diferente | ✅ | ✅ true | ✅ high |
| C4 | Closets + drywall fuera de scope | ✅ | ✅ true | ✅ high |
| C5 | Garantía + material premium | ✅ | ✅ true | ✅ high |
| C6 | Texto ambiguo | ✅ | ✅ true | ✅ high |
| C7 | Mezcla español/inglés | ✅ | ✅ true | ✅ high |
| C8 | Input largo (múltiples áreas) | ✅ | ✅ true | ✅ high |
| C9 | Ruido — emojis y typos | ✅ | ✅ true | ✅ high |
| C10 | Prompt injection attempt | ✅ | ✅ true | ✅ high |

**Resultado:** JSON válido 10/10 · detected correcto 10/10 · risk correcto 9/10

Validado con `scripts/smoke-ollama-level3.mjs`

---

## Routing policy — tabla completa

| Contexto | Provider(s) en chain | Puede usar cloud |
|----------|---------------------|-----------------|
| `localOnly=true` | `ollama → template` | **NO** — nunca |
| `privacyCritical=true` | `ollama → template` | **NO** — nunca |
| `lowCost=true` | `ollama → anthropic → openai → template` | Sí, como fallback |
| `requiresTools=true` | `anthropic → openai → template` | Sí (Ollama no soporta tools nativos) |
| `riskLevel=high` | `anthropic → openai → template` | Sí (premium para alto riesgo) |
| `default` (sin contexto) | `ollama → anthropic → openai → template` | Sí, como fallback |
| `preferredProvider=X` | `X → resto` | Según X |

**Regla de oro:** `localOnly` y `privacyCritical` **nunca** escapan al cloud. Validado en `buildFallbackChain` y `LLMOrchestrator`.

---

## Agent Profiles (Tiers operacionales)

| Agente | Tier | Routing | Nunca cloud |
|--------|------|---------|------------|
| `mission-control` | 1 | localOnly | ✅ |
| `intake-interpreter` | 1 | localOnly | ✅ |
| `buildops-intelligence` | 1 | localOnly | ✅ |
| `change-order-detector` | 1 | localOnly | ✅ |
| `risk-narrator` | 1 | localOnly | ✅ |
| `evidence-analyzer` | 2 | privacyCritical | ✅ |
| `prometeo-chat` | 2 | lowCost | No (puede escalar) |
| `contract-reviewer` | 3 | riskHigh | No (requiere premium) |
| `dispute-analyzer` | 3 | riskHigh+tools | No (requiere tools) |

---

## Guardrails de negocio — ChangeOrderDetector

El LLM genera el `risk` inicial, pero el negocio lo sobrescribe cuando hay condiciones objetivas:

| Condición | Acción del guardrail |
|-----------|---------------------|
| Keywords: humedad, estructura, electricidad, permisos, demolición, moho, gas, cimientos | `risk = "high"` (escalado) |
| Keywords: fuera de scope, adicional, extra, cambio de plan | `risk mínimo = "medium"` |
| Texto con incertidumbre (quizás, no sé, podría) | `evidenceGap = true` |

Campo `guardrailApplied: true` en la respuesta indica que el negocio sobrescribió al LLM.

---

## Performance CPU sin GPU

| Métrica | Valor |
|---------|-------|
| Cold start qwen2.5:3b | ~85s |
| Warm avg | ~60s |
| Warm p50 | ~58s |
| Warm p95 | ~87s |
| Warm min | ~43s |

**qwen2.5:0.5b (para comparación):**
- Warm avg: ~4-8s
- JSON menos confiable, útil para iteración rápida en desarrollo

---

## Limitaciones actuales

1. **Latencia CPU**: 60s avg warm no es viable para producción interactiva. Requiere GPU.
2. **Tool calling**: `qwen2.5:3b` no soporta tool calling nativo. El router desvía `requiresTools=true` a Anthropic/OpenAI. Modelos con tool calling local (Llama 3.1, Mistral Nemo) podrían cubrir esto en el futuro.
3. **Consistencia de risk**: 9/10 en el test. El guardrail de negocio compensa la variabilidad del LLM.
4. **Primera carga**: 85s en CPU requiere `OLLAMA_TIMEOUT_MS=120000`. Con GPU este problema desaparece.
5. **No está en Railway**: Ollama no corre en Railway todavía (ver recomendación de producción).

---

## Recomendación para producción

### Por qué Railway no es el siguiente paso directo para Ollama pesado

Railway está optimizado para containers web/worker/API. Correr un modelo LLM de 1.9 GB en CPU dentro de Railway implicaría:
- Timeouts frecuentes en primeras cargas
- Alto consumo de RAM en containers compartidos
- Sin soporte de GPU nativo en planes estándar
- Costos desproporcionales por RAM vs. un VPS con GPU

### Arquitectura recomendada para producción

```
Railway:
  ├── API (NestJS)         → SEMSE_API_BASE_URL
  ├── Web (Next.js)        → app.semseproject.com
  ├── Worker               → queue processing
  ├── PostgreSQL           → datos
  └── Redis                → cache/queue

VPS/GPU separado:
  └── Ollama               → OLLAMA_BASE_URL=http://vps-ip:11434
      ├── qwen2.5:3b       → operaciones estándar
      └── modelo-tools     → si se requiere tool calling local

Providers externos (siempre disponibles como fallback):
  ├── Anthropic            → riskHigh, requiresTools, fallback
  └── OpenAI               → fallback externo
```

SEMSE se conecta a Ollama por `OLLAMA_BASE_URL` — el resto de la arquitectura no cambia.

---

## Scripts disponibles

| Script | Qué prueba |
|--------|-----------|
| `scripts/test-ollama-semse.mjs` | Provider registration + routing 6/6 |
| `scripts/smoke-ollama-real-flow.mjs` | 3 flujos reales: MissionControl, ChangeOrder, Evidence |
| `scripts/smoke-ollama-level3.mjs` | 10 casos JSON + fallback policy + performance |

Todos corren con: `node scripts/<nombre>.mjs` desde `apps/api/`

---

## Commits de la integración

| Hash | Descripción |
|------|-------------|
| `1655272` | feat(llm): Ollama como proveedor nativo/default de SEMSE OS |
| `638b185` | feat(llm): Operational Intelligence Layer — LLMNarrativeService |
| `1956dde` | test(llm): script validación Ollama nativo |
| `1211e8f` | docs(llm): documentar Ollama local-first, timeouts CPU, agent tiers |
| `fd8074e` | test(llm): smoke real flows — MissionControl, ChangeOrder, Evidence |
| `0e99a4b` | feat(llm): Nivel 3 — JSON confiable + política no-cloud + Zod schema |

---

## Conclusión

```
Ollama quedó validado como inteligencia nativa local de SEMSE OS hasta Nivel 3.

Nivel 1: Provider registrado y responde              ✅
Nivel 2: Flujos reales SEMSE usan Ollama             ✅
Nivel 3: JSON estructurado + fallback policy         ✅
Nivel 4: Producción / VPS / GPU                      ⏳ siguiente
```

SEMSE ya tiene cerebro local funcional. El siguiente paso es decidir dónde vivirá ese cerebro en producción.
