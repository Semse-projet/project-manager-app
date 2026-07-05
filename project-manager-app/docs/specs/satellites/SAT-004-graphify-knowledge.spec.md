---
id: "satellites.graphify-knowledge"
title: "SAT-004 — graphify como capa de conocimiento consultable por agentes SEMSE"
type: spec
domain: "rag"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
date: "2026-07-05"
author: "Claude — sesión planificación satélites"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - packages/knowledge
  - packages/agents
related_tests: []
related_endpoints: []
related_events: []
related_agents:
  - buildops
  - prometeo
  - curator
last_verified: ""
---

# Spec: graphify como capa de conocimiento (satélite `~/graphify`)

## Problem Statement

Los agentes SEMSE (BuildOps, Prometeo, Curator) tienen RAG sobre la Trade Library,
pero no tienen memoria estructural del propio ecosistema: código, docs, specs,
manuales y PDFs como **grafo navegable**. graphify ya hace exactamente eso
(knowledge graph multi-fuente con CLI/MCP) y está instalado localmente.

## Scope

- In scope: `KnowledgeProvider` adicional en `packages/knowledge` que consulta graphify; grafos de dominio SEMSE (docs+specs, Trade Library, manuales); fusión de resultados con el hybrid retrieval existente.
- Out of scope: modificar graphify, reimplementar grafos dentro del monorepo, exponer graphify a internet.

## Non-Goals

- No sustituye el RAG pgvector existente (scores 0.57–0.69 validados); lo complementa con relaciones que el vector search no captura.

## 1. Arquitectura

```
Agentes SEMSE ──► packages/knowledge
                    ├── HybridRetrieval (pgvector, existente)
                    └── GraphifyProvider (nuevo)
                           └─► graphify (proceso local / sidecar)
                                 ├─ grafo: semse-docs (specs, ADRs, visión)
                                 ├─ grafo: trade-library (12 manuales)
                                 └─ grafo: codebase (opcional, dev only)
```

- **Modo de conexión:** graphify corre como servicio local/sidecar (mismo host que worker o contenedor propio); SEMSE lo consulta vía su interfaz programática (CLI/MCP wrap). En Railway: contenedor `semse-graphify` interno, mismo patrón que `semse-vision` (VISION_SERVICE_URL → `GRAPHIFY_SERVICE_URL`).
- **Dirección:** SEMSE consulta; graphify nunca llama a SEMSE (excepto ingesta programada, ver §3).

## 2. Contrato interno `GraphifyProvider`

```ts
interface GraphKnowledgeProvider {
  query(question: string, graph: 'semse-docs' | 'trade-library', k?: number): Promise<GraphHit[]>
  related(nodeId: string, depth?: number): Promise<GraphHit[]>
  health(): Promise<{ ok: boolean; graphs: string[]; lastIngest: ISO8601 }>
}
```

- `GraphHit` incluye `citation` compatible con `ragCitations` de EvidenceReview (formato ya existente, fase RAG 4).
- Fusión: los hits de grafo entran al mismo reranking que el feedback loop de Fase 5 (los boosts humanos aplican igual).

## 3. Ingesta

- Job del worker (cron, patrón permanent-loops SPEC-AUT-001) que re-ingesta `docs/` + Trade Library a graphify tras cada merge a main.
- Flag `SATELLITE_GRAPHIFY_ENABLED`; en OFF, `packages/knowledge` funciona exactamente como hoy (degradación silenciosa, log en Observer).

## 4. Tasks

1. Contenedor/servicio graphify con los 2 grafos base + `GRAPHIFY_SERVICE_URL`.
2. `GraphifyProvider` en `packages/knowledge` + fusión con hybrid retrieval.
3. Job de ingesta en worker.
4. Exponer citas de grafo en las respuestas de Prometeo/TradeGuide (mismo formato de citas actual).

## 5. Acceptance Criteria (arnés SAT-000)

- [ ] Anillo 1: contrato del provider con graphify mockeado; flag OFF ⇒ retrieval idéntico al actual (test de regresión).
- [ ] Anillo 2: N/A SDK externo — el provider ES el adaptador; tests del provider cuentan como anillo 2.
- [ ] Anillo 3: e2e local con graphify real — pregunta de TradeGuide devuelve al menos 1 cita de grafo verificable.
- [ ] Anillo 4: smoke en Railway con `semse-graphify` interno; latencia añadida < 500ms p95; evidencia en `docs/reportes/`.
- [ ] Consciousness registra el nodo graphify con lastIngest (SAT-008).
