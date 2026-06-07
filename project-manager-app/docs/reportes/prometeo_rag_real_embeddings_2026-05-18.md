# Prometeo RAG Phase 4.5 — Real Embeddings + Hybrid Retrieval

**Fecha:** 2026-05-18  
**Estado:** ✅ Completado  
**Tests:** 435/435 (antes: 409 — +26 nuevos)  
**Build:** API OK · TypeScript 0 errores

---

## Problema corregido

**Bug crítico:** Los zero-vectors `[0, 0, ..., 0]` (1536 elementos) pasaban el check `vec.length > 0 === true`, por lo que se usaba cosine similarity en lugar de FTS. La cosine similarity de cualquier vector contra un zero-vector = 0, dejando TODOS los chunks con score=0 → ordenamiento aleatorio → retrieval inútil.

**Impacto:** Sin `OPENAI_API_KEY` configurada en Railway, Prometeo RAG no recuperaba contexto útil aunque los documentos estuvieran indexados.

---

## Solución implementada

### `isZeroVector(vec: EmbeddingVector): boolean`

Nueva función exportada desde `embedding.service.ts`:
```typescript
export function isZeroVector(vec: EmbeddingVector): boolean {
  if (!vec || vec.length === 0) return true;
  return vec.every((v) => v === 0);
}
```

Usada en `search()` para detectar placeholders antes de computar cosine similarity.

---

## Hybrid Retrieval

### Antes (buggy):
```
chunk.vec.length > 0
  → true  (zero-vectors tienen 1536 elementos)
  → cosine(query_zero, chunk_zero) = 0
  → TODOS los chunks score=0
  → orden aleatorio
```

### Ahora (correcto):
```
isZeroVector(queryVec) || isZeroVector(chunkVec)
  → fts_fallback: score = ftsScore(text, query)
  → retrieval útil con FTS

!isZeroVector(queryVec) && !isZeroVector(chunkVec)
  → hybrid: score = 0.70 × cosineScore + 0.30 × ftsScore
  → retrieval semántico real
```

### `RetrievalMode`
```typescript
type RetrievalMode = "hybrid" | "semantic" | "fts_fallback";
```

Incluido en cada `SearchResult`:
```typescript
type SearchResult = {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  text: string;
  score: number;          // hybrid score final
  semanticScore?: number; // cosine similarity (solo en hybrid)
  textScore?: number;     // FTS score
  retrievalMode: RetrievalMode;
};
```

---

## EmbeddingService mejorado

### Nuevas capacidades:
- `isAvailable` — verifica `OPENAI_API_KEY`
- `getStats(): EmbeddingStats` — métricas de uso (success, failure, fallback, latency)
- `healthCheck(): Promise<EmbeddingProviderHealth>` — ping real a OpenAI
- Stats tracking: `successCount`, `failureCount`, `fallbackCount`, `avgLatencyMs`
- Timeout configurable: `EMBEDDINGS_TIMEOUT_MS` (default 30s)
- Batch size configurable: `EMBEDDINGS_BATCH_SIZE` (default 32)

### Variables de entorno:
```env
OPENAI_API_KEY=sk-...          # Requerida para embeddings reales
EMBEDDINGS_MODEL=text-embedding-3-small  # Default
EMBEDDINGS_DIMENSIONS=1536     # Default
EMBEDDINGS_BATCH_SIZE=32       # Default
EMBEDDINGS_TIMEOUT_MS=30000    # Default
```

---

## Mission Control — RAG Health

### Nuevo endpoint:
```
GET /v1/ops/ai-mission-control/rag
```

Requiere permiso: `ops:dashboard:read`

### Respuesta:
```typescript
{
  embeddingsProvider:      "openai" | "none";
  embeddingsModel:         string;
  embeddingsAvailable:     boolean;
  embeddingsHealthy:       boolean;
  totalDocuments:          number;
  totalChunks:             number;
  chunksWithEmbeddings:    number;
  chunksMissingEmbeddings: number;
  avgEmbeddingLatencyMs:   number;
  fallbackCount:           number;
  successCount:            number;
  failureCount:            number;
  lastEmbeddingError?:     string;
  retrievalMode:           "hybrid" | "fts_fallback";
}
```

---

## Backfill Script

```bash
node scripts/prometeo-backfill-embeddings.mjs

# Opciones:
node scripts/prometeo-backfill-embeddings.mjs --dry-run
node scripts/prometeo-backfill-embeddings.mjs --tenant tenant_default
node scripts/prometeo-backfill-embeddings.mjs --batch-size 8
```

El script:
- Busca chunks con zero/null embeddings
- Re-genera embeddings por batch (idempotente)
- Maneja rate limits (429 → espera 60s)
- Reporta progreso y resultados

**Cuándo ejecutarlo:** Después de configurar `OPENAI_API_KEY` en Railway, correr backfill para todos los documentos ya indexados con zero-vectors.

---

## Smoke Test Script

```bash
node scripts/prometeo-rag-embeddings-smoke.mjs

# Contra Railway:
API_URL=https://api.semse.railway.app node scripts/prometeo-rag-embeddings-smoke.mjs
```

Verifica: health, ingestión, indexación, query semántica, FTS fallback, zero-vectors.

---

## Política de privacidad para embeddings

| Tipo de documento | Provider de embeddings |
|-------------------|----------------------|
| `public_training` | OpenAI (cloud OK) |
| `project_document` | OpenAI (cloud OK) |
| `privacyCritical: true` | FTS fallback (no cloud) |

**Regla:** Documentos marcados `privacyCritical: true` en metadataJson no deben enviarse a cloud embeddings. La política actual usa FTS para ellos. Cuando Ollama tenga un modelo de embeddings disponible, se puede enrutar ahí.

---

## Archivos modificados

```
apps/api/src/modules/prometeo/embedding.service.ts
  + isZeroVector() exportada
  + EmbeddingProviderHealth, EmbeddingStats types
  + getStats() — métricas de uso
  + healthCheck() — ping real
  + timeout configurable con AbortController
  + stats tracking en embedBatch()

apps/api/src/modules/prometeo/prometeo.service.ts
  + RetrievalMode type
  + SearchResult: semanticScore, textScore, retrievalMode
  + ScoredChunk: con retrievalMode
  + EmbeddingRagHealth type
  + search(): hybrid retrieval con isZeroVector fix
  + search(): filtro por trade
  + ftsScore(): threshold cambiado de >3 a >2 chars
  + getEmbeddingRagHealth(): stats para Mission Control

apps/api/src/modules/ops/ops.controller.ts
  + @Optional() PrometeoService
  + GET ai-mission-control/rag endpoint

apps/api/src/modules/ops/ops.module.ts
  + forwardRef(() => PrometeoModule)

scripts/prometeo-backfill-embeddings.mjs  [NUEVO]
scripts/prometeo-rag-embeddings-smoke.mjs  [NUEVO]
apps/api/test/prometeo-embeddings-hybrid.test.ts  [NUEVO]
```

---

## Tests nuevos (26)

```
E.Z1-Z5: isZeroVector detection
E.H1-H5: hybrid scoring logic
E.F1-F3: FTS quality
E.R1-R2: chunk ranking
E.S1-S2: EmbeddingStats contract
E.HE1-HE3: EmbeddingRagHealth contract
E.PR1-PR2: privacy policy
E.BF1-BF2: backfill idempotency
E.SR1-SR2: SearchResult type contract
```

---

## Variables Railway a configurar

```env
OPENAI_API_KEY=sk-...          # Para activar embeddings reales
EMBEDDINGS_MODEL=text-embedding-3-small
EMBEDDINGS_TIMEOUT_MS=30000
EMBEDDINGS_BATCH_SIZE=32
```

Después de configurar:
```bash
node scripts/prometeo-backfill-embeddings.mjs --tenant <tenant_id>
```

---

## Estado SEMSE OS después de esta fase

```
Prometeo RAG Fase 0   ✅  Bugs corregidos
Prometeo RAG Fase 1   ✅  RAG + Ollama + citas
Prometeo RAG Fase 2   ✅  PDF/DOCX/TXT + biblioteca trade
Prometeo RAG Fase 3   ✅  RAG operacional (governance, evidence, CO, signals)
Prometeo RAG Fase 4   ✅  Agentes consultan RAG antes de actuar
Prometeo RAG Fase 4.5 ✅  Embeddings reales + hybrid retrieval + health endpoint
```

---

## Próximos frentes

1. **Trade Knowledge Library** — subir manuales eléctricos, plomería, HVAC, drywall, pintura a la biblioteca de Prometeo
2. **TradeGuideService real** — responde con fuentes de manuales reales por trade
3. **Prometeo RAG Phase 5** — Human Feedback Memory Loop: aprender de aprobaciones humanas
4. **Evidence Intelligence Phase 3** — razonamiento histórico/visual sobre evidencia
