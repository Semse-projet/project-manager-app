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
  - apps/api/src/modules/prometeo/prometeo-tool-registry.ts
  - packages/schemas/src/prometeo-runtime.schema.ts
  - apps/web/app/api/semse/cortex/chat/route.ts
  - packages/schemas/src/knowledge-domain.schema.ts
related_tests:
  - apps/api/test/prometeo-orchestrator.service.test.ts
  - apps/api/test/prometeo-rag-phase4-agents.test.ts
  - tests/unit/prometeo-retrieval.test.ts
related_endpoints:
  - v1/prometeo
  - v1/prometeo/tools
  - v1/prometeo/tools/invoke
  - v1/ai-models/prometeo/chat
related_events: []
related_agents:
  - prometeo-chat
  - training-guide
last_verified: 2026-07-12
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

### Extensión P0 — Prometeo Runtime multimodal

El contrato RAG se mantiene, pero Prometeo también debe aceptar un envelope
operativo que permita evolucionar de `message -> response` hacia conversación
multimodal, acciones propuestas y estado de misión. El contrato canónico vive en
`packages/schemas/src/prometeo-runtime.schema.ts`.

```typescript
type PrometeoRequest = {
  message?: string;
  attachments?: Array<{
    type: "image" | "video" | "audio" | "document" | "file";
    source: "upload" | "camera" | "gallery" | "existing_evidence" | "external_url" | "clipboard";
    fileId?: string;
    evidenceId?: string;
    name?: string;
    mimeType?: string;
    sizeBytes?: number;
    url?: string;
  }>;
  selectedEntities?: Array<{ type: string; id: string; label?: string }>;
  requestedAction?: string;
  requestedActionInput?: Record<string, unknown>;
  threadId?: string;
  missionId?: string;
  agentId?: string;
  projectId?: string;
  pageContext?: { route?: string; module?: string; title?: string };
};

type PrometeoResponse = {
  message: string;
  blocks: ResponseBlock[];
  proposedActions: ProposedAction[];
  executionResults: ToolExecutionResult[];
  mission?: MissionState;
  citations: Citation[];
  refreshTargets: string[];
};
```

Reglas P0:

- El campo legacy `response` debe seguir devolviéndose para no romper clientes existentes.
- `blocks`, `mission`, `proposedActions`, `executionResults`, `citations` y `refreshTargets`
  deben existir en cada respuesta del chat operativo.
- Adjuntos y videos pueden recibirse como metadata/envelope, pero el análisis binario
  requiere el pipeline específico de Vision/Video Intelligence.
- Mutaciones reales no se ejecutan todavía desde el chat; se devuelven como
  `proposedActions` con `approvalPolicy`, `riskLevel` y `requiresApproval`.
- El chat puede ejecutar tools de lectura registradas cuando `requestedAction`
  apunta a una tool read-only y sus parámetros llegan en `requestedActionInput`
  o `context.toolInput`.
- Acciones financieras críticas siempre requieren aprobación humana.

### `GET /v1/prometeo/tools` — Catálogo de herramientas de Prometeo

```yaml
output:
  generatedAt: string
  tools:
    - namespace: string
      name: string
      mode: read | write | critical
      riskLevel: low | medium | high | critical
      approvalPolicy: none | confirm | human_required | dual_approval
      permissions: string[]
      endpoint?: { method, path }
      inputSchema?: object
```

El catálogo inicial registra capacidades de Time Tracker, Vision/Evidence, Agro
y Payments. Este endpoint descubre herramientas; no ejecuta acciones por sí solo.

### Extensión P1 — Ejecución de tools de lectura

`POST /v1/prometeo/tools/invoke` ejecuta únicamente tools registradas como
`mode: "read"`. La invocación canónica vive en
`packages/schemas/src/prometeo-runtime.schema.ts`.
En web se expone por el BFF como `POST /api/semse/prometeo/tools/invoke`;
el catálogo se consume desde `GET /api/semse/prometeo/tools`.

```typescript
type PrometeoToolInvokeInput = {
  namespace: string;
  name: string;
  input?: Record<string, unknown>;
  threadId?: string;
  missionId?: string;
};
```

```yaml
output:
  id: string
  namespace: string
  tool: string
  status: queued | running | succeeded | failed | skipped | blocked
  output?: { outputKind?: string, data: unknown }
  errorMessage?: string
  auditRef?: string
  startedAt?: string
  completedAt?: string
```

Reglas P1:

- El endpoint requiere `agents:run:create`.
- El body se valida con `prometeoToolInvokeSchema`.
- Si la tool no existe o no es de lectura, se rechaza con `BadRequest`.
- Las tools de escritura y críticas no se ejecutan desde este endpoint.
- `vision.analyze_video` y otras tools declaradas pero sin adapter de lectura real
  devuelven `status: "blocked"`.
- Agro usa servicios que verifican propiedad por `ownerId`; para `agro.get_animal`,
  el adapter valida la finca del animal antes de devolverlo.
- Vision P1 se limita a análisis ya persistidos: `vision.get_analysis`,
  `vision.get_job_analyses` y `vision.get_milestone_analyses`.
- `POST /v1/ai-models/prometeo/chat` usa el mismo servicio de ejecución para
  requested actions read-only explícitas y devuelve el resultado en
  `executionResults` más un bloque `tool_execution_results`.

Lecturas conectadas en P1:

- `time_tracker.get_status`
- `time_tracker.list_jobs`
- `time_tracker.get_summary`
- `time_tracker.list_sessions`
- `agro.list_farms`
- `agro.get_farm`
- `agro.get_dashboard`
- `agro.list_animals`
- `agro.get_animal`
- `agro.list_groups`
- `agro.list_tasks`
- `agro.list_inventory`
- `agro.list_costs`
- `agro.get_cost_summary`
- `vision.get_analysis`
- `vision.get_job_analyses`
- `vision.get_milestone_analyses`

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
