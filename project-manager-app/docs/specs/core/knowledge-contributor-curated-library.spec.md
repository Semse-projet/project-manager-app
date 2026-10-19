---
id: "core.knowledge-contributor-curated-library"
title: "SEMSE Prometeo — Biblioteca técnica curada con consentimiento y revocación"
domain: "core"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags:
  - "SEMSE_CURATED_KNOWLEDGE_ENABLED"
production_evidence: []
privacyCritical: true
auditLog: true
sse: false
fsmTransicion: "Private derivative draft, consent and review; publication/withdrawal only in later governed slices"
paymentGovernance: "N/A — curated knowledge publication never authorizes escrow, payments, credentials or benefits"
related_files:
  - "apps/api/src/modules/contributor-program/contributor-program.service.ts"
  - "apps/api/src/modules/contributor-program/contributor-program.repository.ts"
  - "apps/api/src/modules/prometeo/prometeo.service.ts"
  - "apps/api/src/modules/prometeo/prometeo.repository.ts"
  - "packages/db/prisma/schema.prisma"
related_tests: []
related_endpoints: []
related_events: []
related_agents:
  - "prometeo"
last_verified: "2026-10-18"
---

# Biblioteca Técnica SEMSE — conocimiento curado, autorizado y revocable

> **DRAFT / NO ACTIVAR.** Diseño propuesto para #992. La aprobación del contrato de *grants privados* de #987 no constituye autorización para divulgar observaciones de colaboradores. Ningún texto histórico `public_training` ni `PROMOTED` permite publicar. Alcance F1 ratificado por el propietario el 2026-10-19 en #992; sigue requiriendo consentimiento de los titulares, aprobación formal SDD/ADR y revisión jurídica, de privacidad y seguridad antes de implementar o publicar.

**Contratos transversales:** véase [`knowledge-contributor-curated-library.integration-contracts.md`](knowledge-contributor-curated-library.integration-contracts.md) para el Knowledge Gateway, consumidores existentes, fronteras de datos, permisos y pruebas de seguridad. Este anexo es DRAFT, no API implementada.

## 1. Problema y resultado

**Para quién:** trabajadores y profesionales de oficios, empresas participantes, revisores de privacidad y expertos por oficio, Prometeo Copilot y administradores autorizados.

**Problema comprobado:** `ContributorProgramService.setObservationPromotion` indexa una observación corregida en Prometeo, pero `promotionStatus=PROMOTED` sólo significa revisión editorial. Los originales contienen potencialmente nombres, rostros, ubicaciones, secretos comerciales o evidencia del cliente. Los lectores de otras organizaciones no cuentan con consentimiento ni deben acceder a esos originales. El código de `main` tampoco tiene el endurecimiento RAG de #987: **esta iniciativa depende de verificar que el P0 #974 esté fusionado y activo** antes de probar cualquier búsqueda compartida.

**Resultado observable:** fichas técnicas derivadas, desidentificadas y revisadas pueden consultarse sólo dentro de su audiencia autorizada; cada versión conserva autoría/procedencia privada, consentimientos, validación técnica, vigencia, trazabilidad y revocación. Nunca se consulta el documento original desde la biblioteca compartida.

**Definición:** conocimiento RAG consultable y revocable **NO** es entrenamiento, fine-tuning, transferencia de copyright ni certificación profesional. Esos usos exigen contratos nuevos.

## 2. Alcance y decisión propuesta del producto

**Alcance F1 ratificado como decisión de producto (2026-10-19, #992; NO habilita publicación):** `ORG_PRIVATE` por defecto; publicación `TENANT_CURATED` sólo tras permiso del contribuidor y autorización del titular de derechos/organización, junto con revisiones de privacidad y oficio por personas distintas. No se publica entre tenants ni mediante URL abierta. Una organización debe estar autorizada a participar en la biblioteca del mismo tenant; el login no basta para evitar filtraciones. Si no hay consentimiento inequívoco o titular acreditado, **sigue privado**. En fases futuras, `ORG_ALLOWLIST` puede agregar un conjunto específico de organizaciones; `CROSS_TENANT` requiere otro SDD, gobernanza y autorización. El propietario ratificó la audiencia de producto `ORG_PRIVATE` por defecto y el futuro `TENANT_CURATED` sujeto a opt-in; esto no reemplaza el consentimiento individual, la validación del titular legítimo ni la revisión independiente antes de cambiar este SDD a APPROVED.

**Incluido:**
- Observación privada original y archivos de origen separados de una ficha derivada: `problema, contexto seguro, diagnóstico, procedimiento, riesgos, referencias, equipo requerido, evidencia mínima, límites, jurisdicción, fecha de revisión, nivel de habilidad`.
- Consentimiento granular, explícito, informado, revocable y **versionado**, de contribuidor y titular de derechos/organización si corresponde. Sin casilla preactivada; informar audiencia, finalidad RAG, atribución pública opcional, periodo y retirada.
- Depuración local-first asistida por IA sólo como borrador; detección PII/EXIF/faces/placas, metadatos ocultos, marcas de cliente, precios, secretos, seriales, datos GPS y lenguaje identificable. El revisor humano debe verificar el contenido final, no confiar en la puntuación del detector.
- Revisión técnica independiente por oficio, referencia normativa aplicable con edición y jurisdicción, contraindicaciones y advertencias. El revisor debe tener cualificación verificable; no atribuir licencias inexistentes.
- Búsqueda híbrida y citas a **ID de versión publicada**, nunca a ruta privada, sourceRef, identificador del cliente ni hash de un archivo origen. Respuestas basadas en fichas aprobadas, con incertidumbre/advertencias.
- Retirada inmediata en lecturas futuras al revocar; tombstone, invalidación de cachés y asincronía idempotente para purga de embeddings/fragmentos. Auditoría mínima se conserva conforme a retención y legal hold.
- Paneles para aportante, propietario de la organización, revisor privacidad, revisor técnico y auditor. Controles bilingües ES/EN y mobile-first.

**Excluido de F1:** publicación abierta en internet, colaboración entre tenants, utilización de fotos originales para entrenar modelos, publicación retrospectiva de `public_training`, cobro/recompensas automáticos, generación de credenciales/licencias profesionales y decisiones económicas/escrow por la IA. Las lecciones de capacitación pueden proponer ejercicios y autoevaluaciones, pero **no equivalen a habilitación legal para ejecutar trabajos peligrosos**.

## 3. Actores, autoridad y privacidad

| Actor | Permiso propuesto (nuevo, backend) | Puede | Nunca puede |
|---|---|---|---|
| Aportante autenticado | `knowledge:contribute` | pedir consentimiento, redactar borrador, retirar su consentimiento | aprobar publicación ni acceder al original de otro |
| Titular org/cliente de los derechos | `knowledge:authorize-rights` | autorizar la **versión** y audiencia acreditando derechos | consentir por un tercero sin autorización |
| Curador privacidad | `knowledge:review-privacy` | aprobar/rechazar desidentificación y licencia/consentimientos vigentes | aprobar técnica o publicar por sí solo |
| Revisor técnico por oficio | `knowledge:review-technical` | verificar procedimientos, riesgos, jurisdicción y fuentes | leer archivos originales sin permiso específico |
| Publicador OPS delegado | `knowledge:publish` | publicar sólo después de ambas revisiones y autorizaciones | autopublicar, sustituir revisiones, elevar audiencia |
| Lector autorizado | `knowledge:read-curated` | consultar fichas activas para el mismo tenant con membresía vigente | ver provenance original, consentimientos privados o fichas revocadas |
| Auditor autorizado | `knowledge:audit` | revisar historial minimizado | alterar consentimientos ni recuperar fuentes sin otro permiso |

**Reglas innegociables:**
- Backend obtiene `tenantId/orgId/userId` de sesión validada o principal de servicio firmado; jamás de ID libre del request/evento; ACL se aplica en SQL **en la misma consulta** que retorna texto, títulos, citas, conteos o embeddings.
- **No self-approval**: autor, titular interesado y publicador no pueden ser los revisores privacidad y técnica de su propio material cuando existe conflicto. En F1 requerir dos aprobaciones humanas distintas con separación de funciones; sin revisor válido, no se publica.
- Autorizaciones antiguas, revisiones o hashes dejan de valer ante cambios de contenido, audiencia, consentimiento, organización dueña, licencia, norma técnica o procedencia. Cambio de versión exige nueva validación.
- Búsqueda/redacción/embeddings privadas sólo con motores locales confiables; sin cloud fallback, redirecciones externas, herramientas autónomas ni previsualizadores remotos.
- Una cita de material recuperado es **dato no confiable**, nunca instrucción de agente; bloquear prompt injection y salidas HTML/URL ejecutables.
- El autor puede pedir revocación; el titular también. Se aplica el cierre de acceso primero; limpieza física después según políticas. No prometer borrar copias ya descargadas o memoria humana.

## 4. Recorrido P1 y criterios verificables

```text
Observation privada → DRAFT_DERIVATIVE → REDACTION_REVIEW → TECH_REVIEW
  → READY (consentimientos + derechos + ambos revisores)
  → PUBLISHED (audiencia fija + versión inmutable)
  → SUSPENDED / WITHDRAWN / SUPERSEDED
```

`PROMOTED` del programa de colaboradores **no cambia por sí solo** este FSM. Estados de privacidad y consentimiento se evalúan como predicados **actuales**, no señales históricas.

| Escenario | Comportamiento obligatorio |
|---|---|
| P1 Publicar | Ninguna publicación sin consentimiento válido, titular confirmado, versión depurada, 2 revisiones distintas y flag/tenant permitido. Registro de auditoría y outbox en la misma transacción del cambio de visibilidad |
| P2 Rechazar | Si detector o revisor encuentra PII/datos sensibles, la ficha vuelve a borrador; el original sigue privado y no se escribe al índice compartido |
| P3 Revocar | Al confirmar revocación, una **consulta nueva** no devuelve ficha, chunk, título, cita, feedback o estadísticas; purga/cachés se reconcilian por outbox |
| P4 Aislamiento | Org ajena sin permiso, tenant B, membresía revocada, usuario desactivado, agente sin scope firmado → 403/404 y cero contenido |
| P5 Concurrencia | Publicar/revocar en carrera: la revocación prevalece en la lectura futura; revisión/consentimiento se revalidan dentro de transacción serializable y lectura SQL |
| P6 Vigencia y calidad | Ficha obsoleta o sin referencia verificable para procedimiento crítico → `NEEDS_REVIEW`/suspensión, no aparece como consejo verificado |
| P7 Piloto | Cuenta de prueba real A/B, scopes positivos y negativos, auditoría y monitoreo de red sin egreso externo |
| P8 Reintentos | Worker, outbox y DLQ idempotentes; no republicar tras retirada por replay fuera de orden |

## 5. Contratos de datos propuestos (no implementados)

**Modelos Prisma nuevos**, sin modificar `Observation` ni transformar `PrometeoDocument` original en documento compartido:

- `CuratedKnowledgeEntry`: id, tenantId, sourcePrivateRef restringido, owningOrgId, trade, jurisdiction, status, activeVersionId?, publicationScope, createdBy.
- `CuratedKnowledgeVersion`: id, entryId, version, sanitizedBody, title, references, sourceEvidencePrivateRef, SHA-256 de **versión depurada**, redactionReport privado, qualityGrade, reviewedAt, expiresAt, contentLanguage, publishedAt. Versiones inmutables.
- `CuratedPublicationConsent`: id, entryId, versionId, contributorUserId/rightsHolderOrgId, actorType, scope, purpose, legalBasisReviewed, noticeVersion, grantedAt, withdrawnAt, proofPrivateRef. Obtener voluntad por actor; no autogenerar ni heredar `public_training`.
- `CuratedKnowledgeReview`: id, versionId, reviewType PRIVACY/TECHNICAL, decision, reviewerId, qualificationRef verificada si aplica, reviewedHash, reason, reviewedAt.
- `CuratedAccessGrant`: tenantId, versionId, scope, audienceIds cuando aplique, isActive/revokedAt, policyVersion. F1 no concede acceso entre tenants.
- `CuratedKnowledgeAudit` y `DomainOutboxEvent` transaccionales: registrar **sin texto original** eventos de solicitud, consentimiento, revisión, publicación, suspensión, revocación y purge/reindex.

Claves únicas `(tenantId, entryId, version)`, índices B-tree `(tenantId, status, scope, trade, jurisdiction)`, claves foráneas compuestas donde sea necesario y validaciones de pertenencia por tenant; claves de acceso y revocación no dependen exclusivamente de JSON. Buscar primero con FTS de PostgreSQL sobre texto depurado; embeddings **sólo de la versión publicable**, con proveedor local y caché por `tenantId + audience + policyVersion + versionId`. PGVector opcional tras medir necesidad; no introducir infraestructura vectorial paralela en F1. Cada lectura de SQL verifica vigencia y derechos.

**API propuesta** (autorización independiente por endpoint):
- `POST /v1/curated-knowledge/drafts` crea un borrador sin publicación.
- `POST /v1/curated-knowledge/:id/consents` registra consentimiento explícito sólo del actor autenticado o titular debidamente representado.
- `POST /v1/curated-knowledge/:id/reviews/privacy` y `/reviews/technical` registran decisiones con hash/version.
- `POST /v1/curated-knowledge/:id/publish` hace CAS sobre hash, derechos, audiencia, reviewers y flag.
- `POST /v1/curated-knowledge/:id/withdraw` bloquea lectura inmediatamente.
- `GET /v1/curated-knowledge/search?q=...` retorna exclusivamente `id/version/title/summary/trade/jurisdiction/verifiedAt/citationRef` aprobados y autorizados, nunca `sourcePrivateRef`.

Errores: 400 validación, 401 sin sesión, 403 permiso faltante, 404 cross-tenant o recurso oculto, 409 consentimiento/hash/audiencia/revisión desactualizado, 422 depuración o técnica rechazada, 503 falla de indexación (sin fallback a material privado). Rate limits, paginación acotada, sanitización de HTML/Markdown y tamaño máximo por ficha.

**UI F1:** `Contribuir`, `Mis consentimientos`, `Revisión de privacidad`, `Validación de oficio`, `Biblioteca`, `Historial y retirar`. Estado `no publicado` siempre visible; previews no muestran metadatos EXIF ni URLs privadas. ES/EN con avisos de consentimiento equivalentes.

**Agente Prometeo:** herramienta sólo lectura `searchCuratedKnowledge(actorScope, question, trade?, jurisdiction?)`; respuesta con `citationRef, verifiedAt, skillLevel, warnings, confidenceLimit`. No acceso a originales, no capacidad de publicar, firmar o liberar pagos. Si no hay ficha fiable: `insufficientContext=true`, sugerir revisión humana. Aprobación de ejecución de obra sigue fuera del agente.

## 6. Estados, eventos, concurrencia y reconstrucción

- Estado base inicial no visible. `PUBLISHED` sólo si `consentActive && rightsActive && privacyApproved && technicalApproved && versionHashMatches && flagEnabled && noSuspension`.
- Revisión/cambio de contenido invalida aprobaciones previas: nuevo versionId, nunca update silencioso de body publicado.
- En cada revocación: **transacción** cambia estado a `WITHDRAWN`, invalida grant/citation y añade outbox + auditoría antes de responder éxito; consultas posteriores hacen predicado SQL de estado y alcance en el mismo statement. Posterior worker elimina vector, cache, índice, backups expiran por política. Nunca se depende solamente de invalidar caché.
- Domain events **propuestos**: `curated_knowledge.consent_granted`, `.consent_withdrawn`, `.privacy_reviewed`, `.technical_reviewed`, `.published`, `.withdrawn`, `.index_purged`. Registrar primero en EVENT_CATALOG durante implementación, no declarar hoy como existentes.
- Replay y DLQ: version/sequence monotónico, idempotencyKey único por evento y consumidor; `withdrawn` gana a indexación tardía; job verifica estado presente antes de crear chunks.
- Auditoría inmutable y minimizada bajo control privado; retención/hold definida legalmente antes de publicar. Sin réplica íntegra del original en logs o telemetría.

## 7. Dependencias, migración y compatibilidad

1. Verificar despliegue real y aislamiento del P0 #974 / PR #987 antes de habilitar consultas de biblioteca; el SDD de grants privados es **distinto** de este contrato de publicación.
2. Migración **aditiva** para modelos curatoriales; `Observation.promotionStatus` sigue editorial y los `ragDocumentId` históricos no cambian de alcance.
3. `public_training` heredado y documentos `PROMOTED` permanecen privados; backfill sólo reporta candidatos a revisar, **sin publicar** ni enviar originales a proveedor cloud. Auditoría de scripts `scripts/trade-knowledge-ingest.mjs`, default `visibility` de controller/UI y guías seed antes de activar.
4. Feature flag OFF y allowlist tenant/organización en F1; en rollback se apaga flag, se revocan grants de exposición y se preserva auditoría/consentimientos conforme a retención. No `prisma db push` en producción.
5. Dependencia de #992 (decisión alcance/consentimiento) y aprobación SDD+seguridad independientes. Cualquier transacción económica de colaboradores sigue sus propios permisos (ninguna publicación dispara payout).

## 8. Observabilidad, calidad y objetivos medibles

Metas propuestas para canary, a validar con datos reales: **0** documentos/chunks/estadísticas cross-tenant/cross-org; **0** envíos de datos privados a nube; **100%** de publicaciones con consentimiento doble y 2 revisores válidos; **100%** de revocaciones que impiden lecturas nuevas inmediatamente tras commit; **100%** de respuestas técnicas críticas con citas verificadas y fecha/jurisdicción o aviso de insuficiencia. Hipótesis de rendimiento: búsqueda p95 < 1 s con 10k fichas autorizadas en staging representativo; medir `EXPLAIN ANALYZE` y cambiar umbral si el hardware no lo sostiene. Evaluar precisión, cobertura, accesibilidad ES/EN y porcentaje de reportes de error; calidad no se mide sólo por volumen.

Indicadores y panel: consentimientos activos, fichas pendientes/rechazadas, edad desde última revisión, retiros, cachés pendientes de purga, rechazos de autorización (sin PII), respuestas sin fuentes, errores de técnica reportados. Operación: cola/DLQ, rate limits, circuit breaker de proveedores locales, desactivar flag ante egreso o fuga.

## 9. Pruebas obligatorias (bloquean activación)

- [ ] Contribuidor niega consentimiento; fuente original no se copia/indexa en biblioteca.
- [ ] Titular de derechos no autorizado; intento cross-org/tenant; consentimientos falsificados y caducados.
- [ ] Revisores distintos, sin autoaprobación, con vigencia de cualificación y hash correcto.
- [ ] Documento con dirección/placa/GPS/foto de cliente/secretos/metadata oculta: se rechaza publicación hasta depuración humana.
- [ ] Publicación y revocación concurrentes: SQL filtra contenido y metadatos en **misma consulta**; cache/replay no reabre recurso retirado.
- [ ] Revisión de norma/edición/jurisdicción y caducidad: no presentar consejo eléctrico peligroso como verificado.
- [ ] Intento de prompt injection contenido en la ficha; Prometeo sólo cita, no ejecuta instrucciones.
- [ ] `public_training` y PROMOTED histórico permanecen privados sin nueva firma.
- [ ] Migraciones Prisma con Postgres real, únicos/indices, tests signed session A/B, org B, tenant B, deleted project, revoked membership.
- [ ] Observabilidad de red sin egreso cloud en staging aislado y prueba de restauración/rollback.
- [ ] Ningún cobro, recompensa, contrato ni escrow disparado por publicación.
- [ ] UI mobile ES/EN, carga/vacío/prohibido/degradado/error, retiro y consentimiento accesible.

## 10. Implementación por slices (cada uno con PR/CI propio)

**F0 — Gobernanza y contrato:** resolver consentimiento/audiencia y aprobación SDD; documentar licencias/retención, amenazas y ADR. **Este PR es sólo F0 documentación.**

**F1 — Custodia del derivado:** modelos, migración, creación de borradores y consentimientos; ninguna búsqueda pública.

**F2 — Revisión/publicación:** redacción guiada, revisores, FSM, audit/outbox, deny-by-default.

**F3 — Consulta/citas:** búsqueda Postgres FTS/RAG local-only sobre derivados, scopes SQL, retiro y cache purge; pruebas negativas.

**F4 — Capacitación:** fichas de habilidad con pasos, advertencias, cuestionarios y retroalimentación supervisada; nunca licencias automáticas.

**F5 — Canary auditado:** pilotos autorizados, telemetría, rendimiento, rollback y habilitación gradual. No activar mientras falte evaluación independiente.

## 11. Investigación externa

- NIST AI RMF Generative AI Profile, 2024 (vigencia revisada 2026): https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- OWASP GenAI Top 10 2025, privacidad/poisoning/injection/agencia: https://genai.owasp.org/llm-top-10/
- OWASP LLM08 Vector and Embeddings Weaknesses (acceso multi-tenant y leakage): https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf

Aplicar ahora como modelo de amenazas, no como afirmación de certificación NIST/OWASP.

## 12. Gates de cierre

- [x] Propietario ratificó alcance de producto F1: `ORG_PRIVATE` inicial, futuro `TENANT_CURATED` por versión y sin backfill histórico (issue #992, 2026-10-19).
- [ ] Titularidad, licencia, atribución, consentimiento real de cada aportante/titular, retención y garantías de retiro validados por autoridades competentes. El propietario no consiente por terceros.
- [ ] SDD/ADR aprobados por revisores competentes; checklist/plan/tasks/analyze coherentes.
- [ ] `pnpm spec:index` y `pnpm spec:validate:strict` verdes.
- [ ] P0 #974 + PR #987 reconciliado, desplegado y seguridad independiente validada.
- [ ] Cada slice: tests negativos, integración PostgreSQL, CI, merge, deploy, canary y evidencia diferenciados.
- [ ] No exposición global o cross-tenant, pagos ni entrenamiento de modelos sin otro consentimiento.
