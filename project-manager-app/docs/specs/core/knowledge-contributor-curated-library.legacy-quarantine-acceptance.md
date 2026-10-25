---
type: security-acceptance
feature: "knowledge-contributor-curated-library"
scope: "LEGACY_FIELD_OBSERVATION_RAG_QUARANTINE"
status: "OPEN_BLOCKER"
date: "2026-10-25"
related_issues: ["#974", "#992"]
related_prs: ["#987", "#1008", "#1010"]
---

# P1 — Cuarentena verificable de RAG histórico de observaciones

> **CONTRATO DE PRUEBAS Y EJECUCIÓN PROPUESTO, NO MITIGACIÓN EJECUTADA.** La existencia de SDD F0 o flag curado OFF no protege por sí sola los fragmentos ya indexados. No ejecutar cambios de SQL, retirar datos, copiar fotografías ni consultar contenido de producción durante esta documentación. Requiere propietario de seguridad, instancia aislada, revisión del plan, pruebas, rollback y evidencia de SHA exacto.

## 1. Riesgo comprobado en código de `main`

Snapshot de referencia de auditoría: `main 06dfd7bd34edf09e860f807015d004d341e503a5` (2026-10-25); este documento no acredita el estado real de Railway.

1. `ContributorProgramService.setObservationPromotion` llama `PrometeoService.ingestText({ sourceType:"field_observation", sourceRef:observation.id, tenantId, orgId, userId })` al promover. `PROMOTED` editorial no es autorización de publicación, ni los términos generales son consentimiento de audiencia.
2. `PrometeoController` usa `public_training` como valor por defecto histórico en ingest/ingest-file. Ese metadato **no** equivale a consentimiento ni es un predicado de ACL.
3. `PrometeoRepository.loadChunksForSearch({tenantId,projectId?})` en este `main` elige documentos por tenant/status/proyecto opcional, seguido de fragmentos por IDs; no exige lector-org/participación/consentimiento. `getDocumentTitles(docIds)` no verifica tenant/lector en su consulta. Deben considerarse posibles fugas de contenido y metadatos **sin afirmar explotación ni exposición productiva**.
4. `search`, `rag-context`, `rag-query`, `trade-guide`, `documents`, `trade-library`, `chunks/:chunkId/feedback`, `feedback/stats`, `embeddings/backfill` y consumidores internos requieren inventario de autorización y retorno. Incluye agentes y background consumers, cache, SSE, notifications y búsquedas por ID de chunk.
5. PR #987 agrega hardening de acceso y consulta scoped; sigue DRAFT y #974 OPEN. PR #1010 contiene F1A privado parcial, **no** arregla esta ruta histórica. CI verde de un PR no demuestra que la versión esté desplegada.

La observación P1 sin resolver de Codex en #1008 es esta cuarentena histórica; **no cerrar el hilo por documentación**.

## 2. Inventario solo lectura (para operador autorizado)

**Precondición:** registro de responsable, SHA desplegado API/Worker, checksum migraciones, restore point consistente e inventario de objetivos. Usar conexión solo lectura y ambiente aprobado; no mostrar títulos, cuerpos, queries de usuario ni sourceRef en logs/PR. No ejecutar el inventario sobre producción sin plan aprobado de privacidad, accesos mínimos y custodia.

Inventariar *conteos agregados*, con límites por tenant/org/tipo/status y sin imprimir identificadores:
- `PrometeoDocument`: `tenantId`, `orgId`, `projectId` nulo, `sourceType=field_observation`, `status=indexed`, `metadataJson.visibility` legado y `chunkCount`.
- `Observation`: `tenantId`, `promotionStatus`, `ragDocumentId` no nulo, referencias huérfanas, documentos duplicados y observaciones cuya promoción se revocó/rechazó.
- `DocumentChunk`: conteos agregados por documento y por tenant, `PrometeoChunkFeedback` agregados y fragmentos/embeddings de fuente histórica; no exportar `text`, `embeddingJson`, `metadataJson` ni títulos.
- Lugares de lectura y copia: listados, paginación, RAG hybrid/FTS, proveedor de embeddings, títulos, estadísticas, citas, feedback, event bus, tool handlers y cachés. Examinar sistemas existentes antes de inventar nuevas rutas.
- Atribución: `sourceRef` y `ragDocumentId` se comparan sólo dentro del entorno autorizado; los reportes públicos exponen recuentos/redacted IDs. La existencia de `ragDocumentId` no acredita consentimiento.

**Muestra sintética requerida:** Tenant A con Org A propietaria y Org B ajena; Tenant C independiente; usuario OWN/PRO/WORKER/OPS verificados, membresía revocada, job eliminado y un bus event con `scope:null` falsificado. Fuentes con PII canaria (nunca PII real) sirven para detectar fuga en respuesta, citation, stats y audit.

## 3. Alternativas de mitigación que debe decidir seguridad

| Alternativa | Comportamiento | Criterio |
|---|---|---|
| A — ACL fail-closed en lectura (preferida) | SQL único valida tenant + org propietaria o grant verificado antes de devolver IDs, chunks, títulos, counts y feedback; original sin proyecto permanece `ORG_PRIVATE` o acceso OPS autorizado bajo policy | Mantiene custodia y lineage; requiere cubrir TODOS los consumidores legacy y carreras de revocación |
| B — Cuarentena por estado gobernado | Bloqueo temporal de recuperación de `sourceType=field_observation` sin prueba actual de autorización; originales preservados, sin RAG compartido | Útil como defensa adicional mientras migraciones/ACL de A se prueban; estado auditado y reversible sin acceso abierto |
| C — Desindexación selectiva auditada | Desactivar legibilidad y reindexación de fuentes que no puedan defenderse por ACL; preservar originales/retención | Sólo con inventario consistente, derechos, transacción/audit/outbox, confirmación backup y plan de recuperación |
| Nunca | `public_training` como consentimiento, `scope:null` del bus, ocultar solo UI, `projectId` provisto sin verificar, vaciar DB productiva sin ensayo | Prohibido |

Debe explicitarse en SDD aprobado de ingesta histórica que `PROMOTED` habilita revisión editorial privada, **no** publicación `TENANT_CURATED`. No reinterpretar ni borrar silenciosamente la versión antigua APPROVED.

## 4. Matriz de prueba P0 antes de liberar (todas con sesiones firmadas y PostgreSQL real)

| ID | Intento / precondición | Aceptación |
|---|---|---|
| L01 | Owner Org A consulta su observación sin proyecto | Sólo propia si policy vigente y scope resuelto |
| L02 | Org B mismo tenant sin grant | 0 chunk, title, count, citation, feedback, preview y metadatos |
| L03 | Tenant C intenta ID conocido de A | 404 neutro / 0 contenido |
| L04 | `public_training` heredado pero sin consentimiento nuevo | Nada publicado ni accesible cross-org |
| L05 | `PROMOTED` con `ragDocumentId` y texto de cliente sintético | Sólo ACL privada; nunca llega al índice curado |
| L06 | `sourceRef` observado sin proyecto `projectId=null` | No se concede tenant-wide |
| L07 | Query sin proyecto + rol WORKER o sin membresía | Denegación, sin títulos ni conteos |
| L08 | Paginar listados con privados delante | Los privados no cuentan en total ni desplazan páginas |
| L09 | `rag-context` y `rag-query`, trade-guide, híbrida y FTS | Misma ACL que búsqueda directa; sin extras |
| L10 | `getDocumentTitles`, chunk ID directo, feedback/stats | ACL mismo statement que devuelve dato |
| L11 | Grant revocado entre consultas de autorización y chunk | Nueva consulta rechaza; no stale-ID prefetch |
| L12 | Proyecto/job eliminado / membresía revocada | Nueva consulta deniega; no caché que reabra |
| L13 | Bus event `tenantId/orgId/userId/scope:null` falsificado | `RAG_SCOPE_UNAVAILABLE` y 0 citas |
| L14 | Backfill, reindex, worker retry y replay fuera de orden | No resucita texto quarantined/revocado |
| L15 | `OPENAI_API_KEY` presente, procesamiento de observación privada | Captura de red confirma 0 egreso de texto/embeddings privado |
| L16 | Fallo auditoría, DB rollback o timeout | Fail-closed y auditoría consistente |
| L17 | Volver a código previo / canary OFF | Rollback **no restaura lectura insegura** |
| L18 | Búsqueda ES/EN y caché con canario confidencial | No filtra en idioma, logs, citations ni telemetría |

**El bloqueo es global:** si L02/L03/L04/L05/L09/L10/L11 falla, no habilitar rutas curadas ni declarar originales privados. El mismo lector no debe poder ir por una ruta antigua para saltarse `Knowledge Gateway`.

## 5. Evidencia, responsables y procedimiento de cierre

1. **Security owner** documenta árbol de llamadas y esquema actual, policy única, arreglo SQL + pruebas, y distingue cambios F1A que siguen en #1010. PR técnico separado o integración explícita controlada en #987/#974; no editar bases ya migradas ni PR DRAFT de otro dueño sin conciliación.
2. **Privacidad** aprueba límites de inventario y tratamiento de contenido histórico; no crear permisos de publicación por consentimiento heredado.
3. **Dev/QA** ejecuta fixtures 2 organizaciones del tenant A + tenant C; captura respuestas/error/SQL autorizadas, sin contenido real, migration checksums, testrun URLs, SHA y event replay.
4. **Sec reviewer independiente** reejecuta o audita pruebas de no-egress y deny path, herramientas internas, IAM y rollback. Registra dictamen **sobre SHA exacto**, conflictos y acciones antes de resolver Codex P1.
5. **Release operator** solo con aprobación formal prepara staging independiente con costo autorizado; valida antes/después y rollback sin volver a modo inseguro. No tocar Railway ni productivo por este documento.

**Definition of Done L0–L18:** pruebas positivas y negativas PASS, no texto privado en logs, autorización SQL uniforme, cuarentena/revocación efectiva, rollback fail-closed, seguridad independiente APPROVED, trazabilidad CI/deploy/canary y issue #974 actualizado. Hasta ese punto: `P1 OPEN / NOT VERIFIED`.

## 6. Dependencias

- [#974](https://github.com/Semse-projet/project-manager-app/issues/974) / [PR #987](https://github.com/Semse-projet/project-manager-app/pull/987): seguridad base documental.
- [#992](https://github.com/Semse-projet/project-manager-app/issues/992) / [PR #1008](https://github.com/Semse-projet/project-manager-app/pull/1008): publicación sólo de derivados.
- [#1007](https://github.com/Semse-projet/project-manager-app/issues/1007) / [PR #1009](https://github.com/Semse-projet/project-manager-app/pull/1009): principal de servicio y diagnóstico fail-closed.
- `core.knowledge-contributor-rag-ingestion`: contrato histórico APPROVED cuya enmienda requiere trámite propio.
