---
id: "satellites.graphify-knowledge"
title: "SAT-004 — graphify como capa de conocimiento consultable por agentes SEMSE"
type: spec
domain: "rag"
version: "2.0"
status: "APPROVED"
owner: "semse-core"
risk: "medium"
date: "2026-07-05"
author: "Claude — sesión planificación satélites"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/graphify
  - apps/api/src/modules/repo-knowledge
  - apps/api/src/modules/prometeo/prometeo.service.ts
  - Dockerfile.api
related_tests:
  - apps/api/test/graphify.service.test.ts
related_endpoints:
  - v1/repo-knowledge/graphify/status
  - v1/repo-knowledge/graphify/query
  - v1/repo-knowledge/graphify/path
  - v1/repo-knowledge/graphify/explain
  - v1/repo-knowledge/graphify/affected
related_events: []
related_agents:
  - buildops
  - prometeo
  - curator
last_verified: "2026-07-07"
---

# Spec: graphify como capa de conocimiento (satélite `~/graphify`)

## ⚠️ Nota de revisión (2026-07-07)

La v1.0 de este spec (2026-07-05) asumía que la integración con graphify no
existía y proponía construirla desde cero como sidecar Railway. **Al auditar
el código antes de implementar, se descubrió que ya existe, está mergeada en
`main` desde el PR #93, y corre en producción ahora mismo** — con una
arquitectura más simple que la propuesta. Esta v2.0 documenta la realidad
verificada, no un plan.

## Problem Statement

Los agentes SEMSE (BuildOps, Prometeo, Curator) tienen RAG sobre la Trade Library,
pero no tienen memoria estructural del propio ecosistema: código, docs, specs,
manuales y PDFs como **grafo navegable**. graphify hace exactamente eso
(knowledge graph multi-fuente con CLI/MCP) y ya está integrado al API.

## Scope

- In scope (ya implementado): `GraphifyService` en `apps/api` que consulta graphify vía CLI; exposición REST bajo `/v1/repo-knowledge/graphify/*`; fusión del contexto estructural con el RAG documental de Prometeo.
- Out of scope: modificar graphify, reimplementar grafos dentro del monorepo, exponer graphify a internet.

## Non-Goals

- No sustituye el RAG pgvector existente (Trade Library, scores 0.57–0.69 validados); lo complementa con relaciones estructurales del código que el vector search no captura.

## 1. Arquitectura real (verificada, no la propuesta original)

```
apps/api Docker image (build stage)
  ├─ pip install graphifyy
  ├─ graphify update /app --no-cluster   → genera graphify-out/graph.json
  └─ COPY graphify-out/ al runtime stage
        │
        ▼
GraphifyService (apps/api/src/modules/graphify/graphify.service.ts)
  ├─ execFile("graphify", ["query"|"path"|"explain"|"affected", ...])
  ├─ isAvailable = existsSync(GRAPHIFY_GRAPH_PATH)   ← kill switch natural
  └─ buildStructuralContext(question) → texto plano para prompt injection
        │
        ├─► PrometeoService.buildRagContext()  (Promise.all con search() pgvector)
        │     └─► usado por: prometeo.controller.ts (chat), project-copilot.harness.ts
        └─► RepoKnowledgeController  (REST directo: status/query/path/explain/affected)
```

**Diferencia clave vs. el plan original:** no hay contenedor `semse-graphify`
separado ni `GRAPHIFY_SERVICE_URL`. El grafo se construye **una vez, en build
time del Docker image**, y se empaqueta dentro del mismo contenedor de
`semse-API`. Es más simple que un sidecar (sin red interna, sin servicio
adicional en Railway) a costa de que el grafo solo se actualiza en cada
deploy, no en tiempo real.

## 2. Contrato real (`GraphifyService`, no `GraphKnowledgeProvider` genérico)

```ts
class GraphifyService {
  get isAvailable(): boolean;                                    // existsSync(graphPath)
  async query(question: string, budget?: number): Promise<GraphifyResult>;
  async path(from: string, to: string): Promise<GraphifyResult>;
  async explain(concept: string): Promise<GraphifyResult>;
  async affected(node: string, relation?: string): Promise<GraphifyResult>;
  async buildStructuralContext(question: string): Promise<string>; // "" si no disponible
}
// GraphifyResult = { available: boolean; result: string }
```

- El resultado es **texto plano** (líneas `NODE <label> [src=<path> loc=<line> community=<c>]`),
  no un `GraphHit[]` estructurado con `citation` — a diferencia de lo que
  proponía la v1.0. Sirve como contexto de prompt para el LLM, no como cita
  clickeable en UI todavía. Convertirlo a citas estructuradas (como
  `ragCitations` de EvidenceReview) es un gap real, ver §4.
- `@Optional()` en `PrometeoService`: si `GraphifyService` no está disponible
  (grafo ausente), la búsqueda documental sigue funcionando normal — la
  fusión es aditiva, nunca bloqueante.

## 3. Verificación en producción (2026-07-07)

Contra `https://project-manager-app-production-977f.up.railway.app` (solo
lectura, con token admin sintético — mismo método del anillo 4 de SAT-001/002):

| Endpoint | Resultado |
|---|---|
| `GET /v1/repo-knowledge/graphify/status` | `{ available: true, graphPath: "/app/graphify-out/graph.json" }` |
| `GET /v1/repo-knowledge/graphify/query?q=...` | `available: true`, 510 nodos encontrados, resultado real y relevante |

Confirmado: `buildRagContext()` (que fusiona graphify + pgvector) se invoca
desde código real, no muerto — `prometeo.controller.ts` (endpoints de chat) y
`project-copilot.harness.ts` (agente).

## 4. Gaps reales (verificados, no especulativos)

| Gap | Impacto | Prioridad |
|---|---|---|
| Grafo se actualiza solo en build time (deploy), no hay re-ingesta periódica ni tras cada merge sin deploy | El grafo puede quedar desactualizado entre deploys si hay pushes directos a main sin rebuild de imagen — en la práctica bajo, porque Railway autodeploya en cada push a main | Baja |
| Resultado es texto plano, no `GraphHit[]` con citas estructuradas | Prometeo usa el contexto para razonar, pero no puede mostrar "cita de grafo" clickeable en UI como sí hace con `ragCitations` de documentos | Media (si se quiere UI de citas de código) |
| Sin kill switch explícito tipo `SATELLITE_GRAPHIFY_ENABLED` | `isAvailable` ya actúa como kill switch natural (borrar/no copiar el grafo lo desactiva), pero no es togglable en runtime sin rebuild | Baja |
| No registrado como nodo en Observer/Consciousness (SAT-008) | Sin visibilidad del estado de graphify en el panel de salud del sistema | Pendiente de SAT-008 |
| Un solo grafo (todo el monorepo), no separado por dominio (`semse-docs` / `trade-library`) como proponía la v1.0 | Menos preciso para preguntas de un dominio específico, pero funciona hoy | Baja |

Ninguno de estos gaps es bloqueante — el mecanismo funciona en producción. Se
dejan documentados para quien retome esta spec, sin comprometerse a
resolverlos ahora (evitar reinventar o duplicar lo que ya funciona).

## 5. Acceptance Criteria (arnés SAT-000) — actualizado a estado real

- [x] Anillo 1: `apps/api/test/graphify.service.test.ts` — cubre el path de degradación (grafo ausente ⇒ `available:false` en los 4 métodos, sin excepciones). No cubre el happy path con grafo real (razonable: CI no tiene el grafo compilado).
- [x] Anillo 2: N/A — no hay SDK externo, `GraphifyService` es un adaptador interno directo.
- [~] Anillo 3: e2e local no formalizado como test automatizado, pero verificado manualmente contra el `graphify-out/graph.json` real del workspace (`graphify query ... --graph ...` funciona, output parseable).
- [x] Anillo 4: smoke contra Railway real (§3) — `available:true`, query real con 510 nodos, latencia aceptable (respuesta ~2s incluyendo cold exec del binario).
- [ ] Consciousness registra el nodo graphify (SAT-008) — pendiente, no bloqueante.

**Estado operativo: LIVE.** No CONNECTED-STAGING — esto no es un satélite
recién conectado, es infraestructura ya en uso productivo desde el PR #93.
