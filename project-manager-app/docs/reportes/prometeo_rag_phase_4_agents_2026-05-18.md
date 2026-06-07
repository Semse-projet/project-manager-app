# Prometeo RAG Fase 4 — Agentes usando RAG

**Fecha:** 2026-05-18  
**Estado:** ✅ Completado  
**Tests:** 409/409 (antes: 389 baseline — +20 nuevos)  
**Build:** API OK · TypeScript 0 errores

---

## Resumen

Prometeo RAG Fase 4 conecta los agentes de SEMSE con la memoria documental (biblioteca de trade) antes de actuar.
Los agentes consultan `PrometeoService.retrieveContext()` para enriquecer sus prompts con fuentes reales,
registran trazabilidad completa y respetan la política `privacyCritical / localOnly`.

Frase rectora:
> Prometeo RAG ya puede explicar. Ahora los agentes consultan esa memoria antes de actuar.

---

## Arquitectura

```
Agente recibe input
    │
    ├─ PrometeoService.retrieveContext(query, trade, tenantId)
    │       → { available, contextBlock, citations }
    │
    ├─ Si available=true:
    │       contextBlock inyectado en el prompt
    │       citations → ragCitations en resultado
    │       ragSources → lista de docs usados
    │
    └─ LLM decide dentro de sus límites
            (no libera pagos, no aprueba evidencia, no inventa)
```

### Método central: `PrometeoService.retrieveContext()`

```typescript
retrieveContext(input: {
  query:      string;   // consulta del agente
  tenantId:   string;
  projectId?: string;
  trade?:     string;   // filtra por trade
  topK?:      number;   // chunks relevantes
}): Promise<{
  available:    boolean;
  contextBlock: string;  // bloque listo para prompt
  citations:    Array<{ documentId, documentTitle, excerpt, score }>;
}>
```

- Si no hay docs indexados → `available: false`, retorna silenciosamente
- Filtro por trade (electrical, plumbing, etc.)
- Score mínimo: 0.10 para considerar chunk relevante

---

## Agentes mejorados

### 1. Evidence Review Agent (`EvidenceReviewService`)

**Qué hace ahora:**
- Consulta RAG con query `${label} ${kind} evidence review`
- Inyecta `contextBlock` en el prompt del LLM
- Devuelve `ragUsed`, `ragSources`, `ragCitations` en el resultado
- Persiste `ragUsed` y `ragSources` en `reviewNote.__agentReview`

**Trazabilidad en resultado:**
```typescript
{
  // ... campos existentes ...
  ragUsed:     boolean;
  ragSources:  string[];    // títulos de docs usados
  ragCitations: Citation[]; // citas con score
}
```

**Política:** `privacyCritical` — Ollama local o template (nunca cloud).

---

### 2. Change Order Detector (`LLMNarrativeService.detectChangeOrderCandidate()`)

**Qué hace ahora:**
- Consulta RAG con `scope ${scopeOriginal.slice(0, 200)}`
- Si `available=true`, inyecta el contextBlock antes del scope original en el prompt
- El LLM detecta fuera de scope con soporte de documentos reales (contratos, manuales)

**Política:** `localOnly` (change-order-detector profile).

---

### 3. BuildOps Intelligence Agent (`BuildOpsIntelligenceAgent`)

**Qué hace ahora:**
- `evaluateMilestone`: fire-and-forget RAG query con query contextual:
  - `"evidencia faltante milestone ${status}"` si hay items faltantes
  - `"evidencia rechazada disputa construcción"` si hay rechazados
  - `"${trade} construcción procedimiento"` si conoce el trade
- `evaluateBuildOpsProject`: fire-and-forget RAG query sobre risk
- Registra `ragSources` y `privacyMode: "localOnly"` en `decisionJson` del run record

**Nota:** Fire-and-forget — no bloquea la evaluación. Los signals se crean primero (reglas deterministas), RAG enriquece el contexto de trazabilidad.

---

### 4. Training/Guide Agent (`TradeGuideService`)

**Qué hace:**
- `guide({ question, trade, tenantId, locale })` → respuesta con citas de manuales
- Filtra docs por trade, prioriza `visibility: "public_training"`
- Respuesta JSON con: `answer`, `steps`, `warnings`, `evidenceNeeded`, `nextAction`, `confidence`
- `insufficientContext=true` si no hay docs de ese trade indexados
- Siempre incluye disclaimer de licencias/códigos locales
- Endpoint: `POST /v1/prometeo/trade-guide`
- Piloto: `trade=electrical`

**Perfil:** `training-guide` (localOnly, Tier 1) — añadido a `agent-profiles.ts`.

---

## Política de privacidad

| Agente | Perfil | Cadena de providers |
|--------|--------|---------------------|
| Evidence Review | `evidence-analyzer` (privacyCritical) | ollama → template |
| Change Order Detector | `change-order-detector` (localOnly) | ollama → template |
| BuildOps Intelligence | `buildops-intelligence` (localOnly) | ollama → template |
| Training Guide | `training-guide` (localOnly) | ollama → template |

**Nunca cloud para datos privados de proyecto.**

---

## Separación de responsabilidades

| Componente | Responsabilidad |
|------------|----------------|
| `PrometeoService.retrieveContext()` | Entrega contexto documental con citas |
| `OperationalRagContextService` | Entrega contexto operacional (governance, signals, evidence) |
| `PaymentGovernanceService` | **Única fuente de verdad** para `canRelease` |
| `EvidenceReviewService` | **Única fuente de verdad** para `reviewStatus` |
| `ChangeOrdersService` | **Única fuente de verdad** para lifecycle de change orders |
| Agentes con RAG | Usan contexto para enriquecer prompts — **no deciden por encima de fuentes de verdad** |

---

## Tests nuevos (20)

```
P4.E1: EvidenceReview usa RAG cuando hay documentos indexados
P4.E2: EvidenceReview sin servicio RAG funciona correctamente (graceful)
P4.E3: EvidenceReview sin documentos (available=false) no marca ragUsed
P4.E4: EvidenceReview no libera pagos

P4.C1: ChangeOrderDetector enriquece prompt con docs RAG cuando disponibles
P4.C2: ChangeOrderDetector sin RAG sigue funcionando
P4.C3: ChangeOrderDetector con available=false no usa ragBlock

P4.T1: TrainingAgent responde con citas cuando hay manuales indexados
P4.T2: TrainingAgent sin docs devuelve insufficientContext=true
P4.T3: TrainingAgent sin servicio RAG devuelve insufficientContext=true
P4.T4: TrainingAgent incluye disclaimer en todas las respuestas
P4.T5: TrainingAgent fallback usa template cuando LLM falla

P4.P1: evidence-analyzer profile siempre es privacyCritical — no cloud
P4.P2: training-guide profile es localOnly — no cloud
P4.P3: RAG context no libera pagos — separación de responsabilidades

P4.I1: insufficientContext=true → respuesta explica que faltan docs (no inventa)
P4.I2: RAG context score threshold — chunks con score < 0.10 ignorados

P4.TR1: EvidenceReview result contiene campos de trazabilidad RAG
P4.TR2: TrainingAgent result contiene trazabilidad completa
P4.TR3: CODetection con RAG registra ragSources
```

---

## Archivos modificados

```
apps/api/src/infrastructure/llm/agent-profiles.ts
  + perfil "training-guide" (localOnly, Tier 1)

apps/api/src/modules/operational-intelligence/evidence-review.service.ts
  + ragSources, ragCitations, ragUsed en EvidenceReviewResult
  + captura de citations desde ragCtx
  + persiste ragUsed/ragSources en reviewNote

apps/api/src/modules/operational-intelligence/buildops-intelligence.agent.ts
  + import PrometeoService (type)
  + @Optional() rag?: PrometeoService en constructor
  + evaluateMilestone: RAG fire-and-forget con ragSources en decisionJson
  + evaluateBuildOpsProject: RAG fire-and-forget con ragSources en decisionJson

apps/api/test/prometeo-rag-phase4-agents.test.ts  [NUEVO]
  + 20 tests P4.E*, P4.C*, P4.T*, P4.P*, P4.I*, P4.TR*
```

---

## Estado de capacidades SEMSE OS

```
1. Opera            ✅  BuildOps, milestones, evidencia, escrow, pagos
2. Gobierna         ✅  Payment Governance, change orders, audit trail
3. Reacciona        ✅  SSE real-time, Mission Control, signals
4. Explica          ✅  RAG Fases 0-3: fuentes reales del ciclo
5. Los agentes      ✅  RAG Fase 4: agentes consultan memoria antes de actuar
   consultan
```

---

## Próximos frentes sugeridos

1. **RAG Fase 5 — Embeddings reales**: activar modelo de embeddings (en lugar de zero-vectors) para mejorar precisión de búsqueda semántica
2. **Ingesta de documentos por trade**: subir manuales eléctricos, OSHA, códigos locales de construcción
3. **TradeGuide con más trades**: plomería, HVAC, drywall como pilotos
4. **Feedback loop**: cuando el agente usa RAG y el resultado es aprobado por un humano, reforzar ese chunk
