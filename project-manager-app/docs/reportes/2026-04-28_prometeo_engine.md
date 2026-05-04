# Prometeo Engine — Implementación

Fecha: 2026-04-28
Estado: **build:api EXIT:0 | tests: 133/133 | WEB TS: 0 errores**

---

## Qué es Prometeo en SEMSE

No es una app separada. Es la capa de inteligencia documental y operativa del backend existente.
Vive en `apps/api/src/modules/prometeo/` y se integra directamente al copiloto, memoria de agentes
y flujos de aprobación.

---

## Arquitectura implementada

```
Usuario/Agente
     ↓
POST /v1/prometeo/ingest (título + texto + tipo)
     ↓
ChunkerService → divide en chunks de ~400 tokens con overlap
     ↓
EmbeddingService → OpenAI text-embedding-3-small (o FTS fallback si no hay key)
     ↓
PrometeoRepository → guarda PrometeoDocument + DocumentChunk[]
     ↓ (async, 2s background)
status: indexed | chunkCount: N

Consulta del copiloto:
     ↓
PrometeoService.buildRagContext(query, projectId)
     ↓
Cosine similarity sobre todos los chunks del proyecto
     ↓
Top-K chunks → contextBlock inyectado en system prompt del LLM
     ↓
Respuesta del agente contextualizada con documentos reales
```

---

## Modelos Prisma nuevos

- `PrometeoDocument` — metadata del documento (title, sourceType, status, chunkCount)
- `DocumentChunk` — chunk de texto + embedding JSON + tokenCount
- `PrometeoAsset` — activos físicos (equipment, material, vehicle, tool, space)
- `WorkOrder` — órdenes de trabajo con prioridad, asignación y fechas

Migración: `packages/db/prisma/migrations/20260427000000_prometeo_engine/`

---

## Módulo backend: `apps/api/src/modules/prometeo/`

| Archivo | Función |
|---------|---------|
| `chunker.service.ts` | Split por párrafos, target 400 tokens, overlap 60 tokens |
| `embedding.service.ts` | OpenAI embeddings + cosine similarity util + FTS fallback |
| `prometeo.repository.ts` | CRUD documentos, chunks, assets, work orders |
| `prometeo.service.ts` | Ingest pipeline, search, RAG context builder |
| `prometeo.controller.ts` | 12 endpoints REST |
| `prometeo.module.ts` | NestJS module, exporta PrometeoService |

---

## Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /v1/prometeo/ingest | Ingestar texto → chunk → embed → index |
| GET | /v1/prometeo/documents | Listar documentos indexados |
| DELETE | /v1/prometeo/documents/:id | Eliminar documento y sus chunks |
| POST | /v1/prometeo/search | Búsqueda semántica (top-K) |
| POST | /v1/prometeo/rag-context | RAG context block para LLM |
| POST | /v1/prometeo/assets | Crear activo |
| GET | /v1/prometeo/assets | Listar activos |
| PATCH | /v1/prometeo/assets/:id/status | Actualizar estado activo |
| POST | /v1/prometeo/work-orders | Crear OT |
| GET | /v1/prometeo/work-orders | Listar OTs |
| PATCH | /v1/prometeo/work-orders/:id/status | Actualizar estado OT |

---

## Integración con el copiloto

`ProjectCopilotHarness.handleChat()` ahora llama en paralelo:
1. `agentMemory.injectRelevantContext()` — memoria de sesiones anteriores
2. `coordinatorService.collectProjectSnapshot()` — estado de delegaciones
3. `usersRepository.findProfile()` — preferencias del asistente
4. **`prometeoService.buildRagContext()`** ← nuevo: top-4 chunks del proyecto

El RAG context se inyecta como `prometeoRagContext` en el system prompt del LLM.
Claude ve los fragmentos más relevantes del contrato/scope/evidencia transcrita antes de responder.

---

## UI admin: `/admin/prometeo`

4 tabs:
- **Base RAG**: ingestar documentos, ver lista indexada con estado y chunk count
- **Búsqueda**: búsqueda semántica libre con score visible
- **Activos**: registro e inventario de activos físicos
- **Órdenes de Trabajo**: crear y gestionar OTs con prioridad

Enlace en nav admin: "Prometeo RAG" con ícono BookOpen.

---

## BFF routes

- `POST /api/semse/prometeo/ingest`
- `GET /api/semse/prometeo/documents`
- `POST /api/semse/prometeo/search`
- `GET/POST /api/semse/prometeo/assets`
- `GET/POST /api/semse/prometeo/work-orders`

---

## Estado del embedding

- **Con OPENAI_API_KEY** (ya configurada en .env): embeddings reales `text-embedding-3-small` 1536d
- **Sin key**: fallback a FTS keyword overlap (funcional, menos preciso)
- El processing es async (fire & forget) — status va de `processing` → `indexed` en ~2s

---

## Smoke verificado

```
POST /v1/prometeo/ingest  → id=cmoisch5p... status=indexed chunks=1 ✅
POST /v1/prometeo/search query="tablero Siemens hitos de pago" → score=0.523 ✅
GET  /v1/prometeo/documents → 1 documento ✅
```

---

## Siguiente frente

- Subida de archivos reales (PDF → text extraction con `pdfjs-dist`)
- Ingest automático de contratos y evidencias al aprobarse
- Panel de administración con búsqueda semántica en el copiloto de proyecto
- Dashboard de agentes especializados Prometeo (técnico, legal, financiero)
