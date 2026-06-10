---
id: api-prometeo-rag-trade-knowledge
title: "Prometeo RAG and Trade Knowledge API"
type: spec
feature: "Prometeo Engine — RAG & Trade Knowledge"
domain: "prometeo"
version: "1.0"
status: "VERIFIED"
owner: semse-core
risk: high
date: "2026-05-20"
author: "Claude Sonnet — sesión SDD governance"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/prometeo
  - apps/api/src/modules/ai-models/orchestrator/prometeo-orchestrator.service.ts
  - packages/schemas/src/knowledge-domain.schema.ts
related_tests:
  - apps/api/test/prometeo-orchestrator.service.test.ts
  - apps/api/test/prometeo-rag-phase4-agents.test.ts
  - tests/unit/prometeo-retrieval.test.ts
related_endpoints:
  - v1/prometeo
related_events: []
related_agents:
  - prometeo-chat
  - training-guide
last_verified: 2026-06-09
---

# Spec: Prometeo Engine

> Motor de RAG (Retrieval-Augmented Generation) de SEMSE.
> Indexa manuales de oficios, responde consultas con citas verificables
> y proporciona contexto técnico a agentes y usuarios.
> Basado en `apps/api/src/modules/prometeo/prometeo.controller.ts`.
> **privacyCritical:** `true` para queries sobre datos de proyectos específicos → Ollama local.

---

## 1. Qué resuelve

Los profesionales necesitan guía técnica verificada: códigos de construcción,
mejores prácticas por trade, estimados de materiales. Prometeo indexa fuentes
reales (PDFs, DOCX) y responde con citas trazables, sin alucinar.

---

## 2. Actores y Permisos

Todos los endpoints requieren `agents:run:create` (usuario autenticado).

---

## 3. Contratos de API

### `POST /v1/prometeo/ingest` — Indexar documento
```yaml
input: { content: string | buffer, title, trade, language? }
output: { documentId, chunks: number, status: "indexed" }
privacyCritical: false (documentos públicos de trade)
efectos: auditLog: true · RAG index actualizado
```

### `POST /v1/prometeo/ingest-file` — Indexar archivo (PDF/DOCX/TXT)
```yaml
input: archivo multipart
output: { documentId, chunks, title, trade }
efectos: parsea → chunksea → embeddings → persiste
```

### `GET /v1/prometeo/trade-library` — Catálogo de documentos
```yaml
output: array de { documentId, title, trade, chunkCount, language, uploadedAt }
```

### `GET /v1/prometeo/documents` — Listar documentos indexados
```yaml
output: array de documentos con metadatos
```

### `POST /v1/prometeo/search` — Búsqueda semántica
```yaml
input: { query: string, trade?, topK?: number }
output: array de { chunk, score, documentTitle, documentId, excerpt }
privacyCritical: false
```

### `POST /v1/prometeo/rag-context` — Contexto RAG para agentes
```yaml
input: { query: string, milestoneId?, jobId?, trade? }
output:
  - context: string — texto ensamblado para prompt
  - citations: [{ documentId, excerpt, score }]
  - ragUsed: boolean
privacyCritical: true (si incluye jobId/milestoneId) → Ollama
```

### `POST /v1/prometeo/rag-query` — Query RAG con respuesta LLM
```yaml
input: { question: string, trade?, language?: "es"|"en" }
output:
  - answer: string — respuesta en lenguaje natural
  - citations: [{ documentTitle, excerpt, score }]
  - confidence: number
  - provider: string (ollama | anthropic | openai)
privacyCritical: true → Ollama por defecto
efectos: auditLog: true · ragUsed registrado
```

### `POST /v1/prometeo/trade-guide` — Guía técnica por trade
```yaml
input: { trade: SmartIntakeCategory, question: string }
output:
  - guide: string — guía estructurada
  - steps: string[]
  - materials: string[]
  - citations: RagCitation[]
privacyCritical: true → Ollama
```

### `POST /v1/prometeo/assets` — Subir asset (imagen de referencia)
```yaml
input: imagen multipart
output: { assetId, url }
```

---

## 4. Tests Requeridos

```typescript
describe("POST /v1/prometeo/rag-query") {
  it("retorna answer con citations cuando hay documentos relevantes")
  it("usa Ollama cuando privacyCritical=true")
  it("retorna ragUsed=false cuando no hay documentos relevantes")
  it("rechaza con 403 sin agents:run:create")
}
describe("POST /v1/prometeo/search") {
  it("retorna chunks ordenados por score descendente")
  it("filtra por trade cuando se especifica")
}
```

---

## 5. Invariantes

- `ragCitations` siempre incluye `documentId` verificable — no se alucina la fuente
- Queries con `jobId` o `milestoneId` son `privacyCritical` → routing a Ollama
- Documentos públicos de trade (PDFs de códigos) → pueden usar cloud LLM
- Score de relevancia mínimo recomendado: 0.45 (hybrid retrieval semántico + keyword)
