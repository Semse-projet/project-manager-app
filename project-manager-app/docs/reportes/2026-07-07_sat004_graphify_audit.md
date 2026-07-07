# Auditoría SAT-004 — graphify ya estaba en producción

**Fecha:** 2026-07-07
**Ejecutor:** Claude — sesión satélites
**Referencia:** `docs/specs/satellites/SAT-004-graphify-knowledge.spec.md` v2.0

## Qué se esperaba hacer

Implementar SAT-004 desde cero según el spec v1.0: `GraphKnowledgeProvider` en
`packages/knowledge`, contenedor sidecar `semse-graphify` en Railway, job de
ingesta en el worker.

## Qué se encontró al auditar el código antes de empezar

Nada de eso hacía falta. Existe desde el **PR #93** (`feat(graphify): integrate
knowledge graph into repo-knowledge and Prometeo RAG`), mucho antes de que
existiera el Satellites Integration Plan:

- `apps/api/src/modules/graphify/graphify.service.ts` — wrapper `execFile`
  sobre el binario `graphify` (query/path/explain/affected), gateado por
  `existsSync(GRAPHIFY_GRAPH_PATH)`.
- `apps/api/Dockerfile`: instala `graphifyy` vía pip y corre
  `graphify update /app --no-cluster` en el **build stage**, copiando
  `graphify-out/` al runtime stage. El grafo vive dentro de la misma imagen
  de `semse-API` — no hay servicio ni contenedor separado.
- `apps/api/src/modules/repo-knowledge/repo-knowledge.controller.ts` expone
  `GET /v1/repo-knowledge/graphify/{status,query,path,explain,affected}`.
- `PrometeoService.buildRagContext()` fusiona el contexto estructural de
  graphify con la búsqueda pgvector vía `Promise.all`, con `@Optional()` —
  degradación silenciosa si el grafo no está disponible.
- `apps/api/test/graphify.service.test.ts` cubre el path de indisponibilidad
  (4 métodos devuelven `available:false` sin lanzar excepción).
- **Consumido en producción real**, no código muerto: `prometeo.controller.ts`
  (endpoints de chat) y `project-copilot.harness.ts` (agente).

## Verificación contra producción (2026-07-07, solo lectura)

Con el mismo método de token admin sintético del anillo 4 de SAT-001/002:

```
GET /v1/repo-knowledge/graphify/status
→ { "available": true, "graphPath": "/app/graphify-out/graph.json" }

GET /v1/repo-knowledge/graphify/query?q=como funciona el smart-intake&budget=400
→ { "available": true, "result": "Traversal: BFS depth=2 | ... | 510 nodes found\n\nNODE ok() [src=apps/api/src/common/api-response.ts loc=L6...] ..." }
```

## Qué se hizo en esta sesión

Nada de código — solo documentación honesta:

1. Reescribir `docs/specs/satellites/SAT-004-graphify-knowledge.spec.md` a v2.0
   reflejando la arquitectura real (no sidecar), el contrato real
   (`GraphifyService`, no `GraphKnowledgeProvider` genérico), y una tabla de
   gaps reales verificados (no especulativos): re-ingesta solo en build-time,
   sin citas estructuradas tipo `ragCitations`, sin kill switch runtime
   explícito, sin nodo en Observer (depende de SAT-008).
2. `SATELLITES.md`: SAT-004 pasa de `DRAFT` a **`LIVE`** directamente (no
   `CONNECTED-STAGING` — no es un satélite recién conectado, es
   infraestructura productiva desde hace tiempo).

## Por qué no se escribió código nuevo

Reimplementar algo que ya funciona en producción habría sido trabajo
duplicado y riesgo de regresión sobre un flujo de RAG usado activamente por
Prometeo. La contribución de valor en esta sesión fue **la auditoría misma**:
corregir el registro (`SATELLITES.md`, spec) para que refleje la realidad, no
un plan obsoleto.
