---
type: security-acceptance
feature: "knowledge-contributor-curated-library"
scope: "LEGACY_FIELD_OBSERVATION_RAG_QUARANTINE"
status: "OPEN_BLOCKER"
date: "2026-11-02"
related_issues: ["#974", "#992"]
related_prs: ["#987", "#1078", "#1079", "#1008", "#1010"]
---

# P1 — Cuarentena verificable de RAG histórico de observaciones

> **CONTRATO DE CUARENTENA CON EVIDENCIA PARCIAL VERIFICADA.** La matriz L01–L18 continúa `OPEN_BLOCKER / NOT VERIFIED` como conjunto. Tras los PR #987 y #1079 se acreditó una defensa SQL y varias pruebas negativas con PostgreSQL sintético; ello no acredita todas las rutas históricas, cachés, respuestas, consentimiento, ni activación. Un SDD F0 o flag curado OFF tampoco certifica por sí solo los consumidores del legado. No consultar ni alterar contenido real de producción durante esta actualización documental.

## 1. Hallazgo histórico (snapshot 2026-10-25) y estado actual

Snapshot de referencia **histórica** de auditoría: `main 06dfd7bd34edf09e860f807015d004d341e503a5` (2026-10-25). Los cinco puntos siguientes describen aquel corte; **no deben presentarse como defectos que sigan existiendo sin contrastarlos con `main` actual**. Véase la evidencia posterior a #1079 en la sección 7.

1. `ContributorProgramService.setObservationPromotion` llama `PrometeoService.ingestText({ sourceType:"field_observation", sourceRef:observation.id, tenantId, orgId, userId })` al promover. `PROMOTED` editorial no es autorización de publicación, ni los términos generales son consentimiento de audiencia.
2. `PrometeoController` usa `public_training` como valor por defecto histórico en ingest/ingest-file. Ese metadato **no** equivale a consentimiento ni es un predicado de ACL.
3. `PrometeoRepository.loadChunksForSearch({tenantId,projectId?})` en este `main` elige documentos por tenant/status/proyecto opcional, seguido de fragmentos por IDs; no exige lector-org/participación/consentimiento. `getDocumentTitles(docIds)` no verifica tenant/lector en su consulta. Deben considerarse posibles fugas de contenido y metadatos **sin afirmar explotación ni exposición productiva**.
4. `search`, `rag-context`, `rag-query`, `trade-guide`, `documents`, `trade-library`, `chunks/:chunkId/feedback`, `feedback/stats`, `embeddings/backfill` y consumidores internos requieren inventario de autorización y retorno. Incluye agentes y background consumers, cache, SSE, notifications y búsquedas por ID de chunk.
5. **Estado superado:** #987 ya fue fusionado y desplegado con sharing OFF; #1079 incorporó pruebas PostgreSQL específicas para etiquetas históricas y está fusionado/desplegado. #974 permanece OPEN por aceptación incompleta. PR #1010 sigue DRAFT y contiene F1A privado, **no** implementa F1B/F2/F3 ni autoriza publicar observaciones.

La observación P1 sin resolver de Codex en #1008 es esta cuarentena histórica; **no cerrar el hilo por documentación**.

## 2. Inventario solo lectura (para operador autorizado)

**Estado a 2026-11-02:** el inventario agregado real autorizado ya se ejecutó mediante el auditor de #1078 sobre PostgreSQL privado, con `HOLD_CLASSIFICATION`; constancia en [#974](https://github.com/Semse-projet/project-manager-app/issues/974#issuecomment-6568809077). La función temporal fue eliminada. **No volver a ejecutarlo por rutina ni interpretar etiquetas como consentimientos.** El procedimiento siguiente se conserva para una repetición expresamente autorizada: registro de responsable, SHA desplegado API/Worker, checksum migraciones, restore point consistente, conexión solo lectura y custodia privada, sin exponer títulos, cuerpos, consultas ni `sourceRef` en GitHub.

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

1. **Security owner** completa y documenta el árbol actual de lectores/cachés, la policy única y las pruebas aún ausentes sobre la base ya fusionada de #987/#1079. Reutilizar el trabajo existente y los PR abiertos pertinentes, sin abrir otro PR para duplicar el alcance ya cerrado; no editar bases ya migradas ni ramas ajenas sin conciliación.
2. **Privacidad** aprueba límites de inventario y tratamiento de contenido histórico; no crear permisos de publicación por consentimiento heredado.
3. **Dev/QA** ejecuta fixtures 2 organizaciones del tenant A + tenant C; captura respuestas/error/SQL autorizadas, sin contenido real, migration checksums, testrun URLs, SHA y event replay.
4. **Sec reviewer independiente** reejecuta o audita pruebas de no-egress y deny path, herramientas internas, IAM y rollback. Registra dictamen **sobre SHA exacto**, conflictos y acciones antes de resolver Codex P1.
5. **Release operator** solo con aprobación formal prepara staging independiente con costo autorizado; valida antes/después y rollback sin volver a modo inseguro. No tocar Railway ni productivo por este documento.

**Definition of Done L0–L18:** pruebas positivas y negativas PASS, no texto privado en logs, autorización SQL uniforme, cuarentena/revocación efectiva, rollback fail-closed, seguridad independiente APPROVED, trazabilidad CI/deploy/canary y issue #974 actualizado. Hasta ese punto: `P1 OPEN / NOT VERIFIED`.

## 6. Dependencias

- [#974](https://github.com/Semse-projet/project-manager-app/issues/974) / [PR #987](https://github.com/Semse-projet/project-manager-app/pull/987) y [PR #1079](https://github.com/Semse-projet/project-manager-app/pull/1079): controles SQL de seguridad fusionados y pruebas parciales de cuarentena legacy.
- [#992](https://github.com/Semse-projet/project-manager-app/issues/992) / [PR #1008](https://github.com/Semse-projet/project-manager-app/pull/1008): publicación sólo de derivados.
- [#1007](https://github.com/Semse-projet/project-manager-app/issues/1007) / [PR #1009](https://github.com/Semse-projet/project-manager-app/pull/1009): principal de servicio y diagnóstico fail-closed.
- `core.knowledge-contributor-rag-ingestion`: contrato histórico APPROVED cuya enmienda requiere trámite propio.

## 7. Reconciliación de evidencia después del PR #1079 — 2026-11-02

**Base observada:** #1079 se fusionó a `main` por squash `f987266327b5ff2304b352b6b340b7adc8996065`. En el HEAD del PR `793e11a9c9b9096adbbbce09abacb747feee0c30` pasaron [API Integration PostgreSQL 16 #41431904977](https://github.com/Semse-projet/project-manager-app/actions/runs/41431904977) y [CI #41431905021](https://github.com/Semse-projet/project-manager-app/actions/runs/41431905021); Codex y Copilot no encontraron P0/P1/P2 bloqueantes en los cinco archivos del PR. Railway registró cuatro servicios SUCCESS en ese squash; salud pública API/web y `/v1/ready` se comprobaron. Esto acredita la **entrega de la regresión**, no una campaña completa L01–L18. El inventario agregado privado de #1078 quedó en `HOLD_CLASSIFICATION`.

**Prueba examinada:** [`apps/api/test/prometeo-documents-scope-integration.test.ts`](https://github.com/Semse-projet/project-manager-app/blob/f987266327b5ff2304b352b6b340b7adc8996065/project-manager-app/apps/api/test/prometeo-documents-scope-integration.test.ts). Fixtures sintéticos en PostgreSQL efímero: owner/otra org/mismo tenant, tenant extranjero, documentos sin proyecto, `field_observation` con `PROMOTED` y `public_training`, límites de SQL, grants explícitos, revocación y apagado del flag. Los tests comprueban específicamente:

| Matriz | Evidencia real en el test actual | Lo que **no** queda acreditado por esta prueba |
|---|---|---|
| L01, L02, L04, L05, L06 | Lectura de chunks por owner; no listado/chunks del legado promovido para otra org; sin grants inferidos por etiquetas | Todos los lectores, contadores, citas, embeddings y respuestas HTTP con sesión firmada |
| L03 | Denegación de policy a actor cross-tenant (404) y borrado cross-tenant denegado (404) | Rutas HTTP/RAG completas y fuga indirecta mediante IDs o estadísticas de tenant extranjero |
| L08 | Paginación SQL de documentos propios con privados de otra org intercalados | Conteo global, ordenamientos y filtros de todas las pantallas/consultas |
| L10, L11 | `getFeedbackStats` scoped y revocado; SQL de chunks niega grant tras `revokedAt` | `getDocumentTitles`, búsqueda por chunk ID directa, cachés, carreras de autorización/lectura en HTTP |
| L16 (parcial) | Fallo de escritura de auditoría revierte borrado; concurrencia de dos borrados deja un único resultado y AuditLog | Fallos de auditoría/outbox de todos los flujos de consentimiento, publicación y revocación |
| L17 (parcial) | Flag OFF oculta grants aún persistidos y reactivación no resucita grants revocados | Rollback operacional con binarios antiguos, checkpoint restaurado y staging de terceros |

**Sin evidencia integral en este test:** L07, L09, L12–L15, L18, así como las partes no cubiertas de L01–L06/L08/L10/L11/L16/L17. Existen otras pruebas del #987 que deben correlacionarse por SHA y cobertura, no sumarse automáticamente como `PASS` universal. El workflow de red P0 dedicado estaba `SKIPPED` en #1079 por su condición de ejecución restringida a #987; el resultado de aquel workflow no equivale a una captura nueva de egress del SHA actual.

**Decisión de aceptación:** `OPEN_BLOCKER / NOT VERIFIED` se mantiene hasta completar la matriz global L01–L18 con sesiones autenticadas A/B/C, todas las rutas/consumidores, replay/cachés, no-cloud, rollback y revisión independiente. `public_training` y `PROMOTED` siguen siendo **descripciones sin consentimiento**; el acceso al original sigue privado. El SDD F0 de #1008 continúa DRAFT; #1010 F1A continúa DRAFT; no crear permisos de publicación ni encender los flags por este cambio documental.

## 8. Evidencia incremental L12–L15 y límite de aceptación — 2026-11-02

Las observaciones de la sección 7 corresponden **al test particular de #1079**, no al estado total del PR #1008. Esta sección registra el avance posterior sin modificar retroactivamente ese resultado.

| ID | Evidencia ejecutada | Alcance **no** probado |
|---|---|---|
| L01–L11, L17 (parcial) | [API Integration #41444477475](https://github.com/Semse-projet/project-manager-app/actions/runs/41444477475): 143 pruebas, 136 PASS, 0 FAIL y 7 SKIPPED sobre PostgreSQL 16; `prometeo-legacy-rag-leak-integration.test.ts` comprueba A/B/C, RAG, títulos, citas, contadores, grants, revocación y OFF. Smoke firmado `api-authenticated-f01-f02-smoke.mjs` prueba `trade-library` y `rag-query/trade-guide` ES/EN sin contexto autorizado | Cobertura completa de consumidores indirectos, búsquedas por ID directo, replay de caché y derechos del titular |
| L12 (parcial) | En ese mismo run, `[PROMETEO P0 L12] signed membership suspension and project reassignment fail closed PASS`; nuevo request con JWT firmado deniega usuario suspendido, y reasignación revoca acceso efectivo aun con grant persistido | Eliminación/cambio de job en todas sus variantes y cualquier cache ajena al HTTP probado |
| L13 (parcial) | En [CI #41446425684](https://github.com/Semse-projet/project-manager-app/actions/runs/41446425684), job `unit-coverage` SUCCESS sobre SHA `1a5b900641`; tres tests `ok 2560–2562` en `prometeo-agent-event-scope.test.ts`: `scope:null` falso, identidades falsas/replay, sin lecturas ni citas | Autorización de todos los tipos de eventos, bus distribuido y principal de servicio comprobado; el fallback actual retorna 0 citas, **no** el código `RAG_SCOPE_UNAVAILABLE` definido en esta matriz |
| L14 (parcial) | El mismo job `unit-coverage` registra `ok 2654–2657` para CLI histórica de backfill: invocación normal, `--dry-run`, `--tenant` y verificación sin ruta de DB/red. El script `prometeo-backfill-embeddings.mjs` de la rama #1008 siempre sale con error antes de leer chunks/enviar texto. [API Integration #41446425532](https://github.com/Semse-projet/project-manager-app/actions/runs/41446425532) SUCCESS en esa rama | La protección **no está fusionada/desplegada** y no cubre otros workers, filas DLQ, retries ni índices ya históricos. La CLI manual antigua queda deliberadamente inhabilitada, sin sustituto aprobado |
| L15 (parcial) | [Egress manual #41443472518](https://github.com/Semse-projet/project-manager-app/actions/runs/41443472518) SUCCESS en SHA anterior `a1d6894`, 0 intentos externos observados, firewall de control negativo operativo | **No** se ha repetido en `1a5b900641` ni `13c1dd964`; no acredita redes de Railway. En un intento posterior se lanzó erróneamente [run #41447133840](https://github.com/Semse-projet/project-manager-app/actions/runs/41447133840) sobre `main` y se **canceló**; no cuenta como prueba de la rama #1008 |

**Snapshot de validación al preparar este anexo:** `unit-coverage` del SHA `1a5b90064141ee32d7de9dddcfb4d38b65134728` terminó SUCCESS con 3689 PASS y 0 FAIL; `API Integration`, Hydra, Autonomy y Operación Asistida SUCCESS; `quality-gates` continuaba en curso. Codex revisó ese SHA sin problemas importantes. El cambio documental posterior `13c1dd964749addad7689e3799f89d5b2f8d5dd5` exige verificar nuevamente el CI antes de adjudicarle resultados del anterior.

**Decisiones y tareas estrictamente pendientes:**
1. Conciliar formalmente la precedencia con `core.knowledge-contributor-rag-ingestion` `APPROVED` en un ADR versionado aprobado, sin inferir consentimiento de `PROMOTED` ni anular silenciosamente el contrato anterior.
2. Completar L13 con principal confiable para eventos/worker; L14 con retries, DLQ y reindexación local-only; revalidar accesos tras revocación y carreras.
3. Repetir no-egress en SHA final/entorno controlado, y ejecutar restauración/rollback con datos sintéticos y trazabilidad de aprobaciones.
4. Obtener aprobación del SDD F0 por HEAD exacto y revisor de seguridad **humano independiente** para nivel 3, y verificar consentimientos legítimos antes de cualquier `TENANT_CURATED`.

**Estado integral sigue `OPEN_BLOCKER / NOT VERIFIED`.** Ni la fusión eventual de #1008 ni el flag de biblioteca curada constituyen por sí solos autorización para compartir originales privados.
