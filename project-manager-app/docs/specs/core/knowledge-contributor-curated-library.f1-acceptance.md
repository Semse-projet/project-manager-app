---
type: "acceptance-contract"
feature: "knowledge-contributor-curated-library"
phase: "F1_PRIVATE_CUSTODY"
status: "DRAFT"
sdd: "docs/specs/core/knowledge-contributor-curated-library.spec.md"
revision: "0.1"
date: "2026-10-19"
privacyCritical: true
implementation_status: "NOT_STARTED"
activation_status: "INACTIVE"
---

# Biblioteca Técnica Prometeo — F1: contrato ejecutable de aceptación

> **F0 / DISEÑO SOLAMENTE.** Esta matriz no autoriza implementar, fusionar, desplegar o activar F1. Requiere aprobación formal del SDD/ADR, auditoría jurídica/privacidad y pruebas de seguridad de #992. El CI del PR documental no prueba que estas API/tablas existan.

## 1. Objetivo y frontera

F1 guarda **fichas derivadas privadas** por organización, versiones inmutables y consentimientos explícitos **retirables inmediatamente**. No publica, no comparte entre organizaciones, no habilita búsqueda RAG, no crea membresías, no emite licencias, no autoriza pagos, escrow ni reputación profesional. `PROMOTED` es estado editorial de una observación; **no es autorización de uso o publicación**.

La fuente original (Evidence/Observation/medios) permanece en su sistema propietario. F1 nunca copia fotos originales, EXIF, cliente, dirección, planos, firmas ni identificadores del trabajo al derivado común. Un borrador puede estar todavía sin depurar y por ello **sólo es visible al aportante y al custodio autorizado de su organización**, no a la futura audiencia `TENANT_CURATED`.

**Precondición P0:** inventario real de `ragDocumentId` y `sourceType=field_observation`, consulta de acceso vigente del índice histórico y disposición de cuarentena para ACL no acreditada. La existencia de #987 en DRAFT no prueba cuarentena ni despliegue. Si una ruta legacy sigue sirviendo texto de origen sin titularidad/ACL probada, mantenerla bloqueada y detener F1/F3 en esa audiencia; registrar el bloqueo, no sustituirlo por un `scope:null` global.

## 2. Modelo objetivo F1 (F1A parcial, F1B pendiente)

F1A de #1010 contiene Entry/Version/Consent y tiene evidencia de migración/test en CI, no despliegue ni API. Esta tabla describe el objetivo completo: los campos y modelos adicionales no se consideran existentes. Ver [mapeo y gates](knowledge-contributor-curated-library.delivery-gates.md).

| Agregado | Identificadores y restricciones obligatorias |
|---|---|
| CuratedKnowledgeEntry | `tenantId, id, owningOrgId, contributorUserId, status, aggregateRevision`; `@@unique([tenantId,id])` |
| CuratedKnowledgeVersion | `tenantId, id, entryId, version, sanitizedBody, contentHash, policyHash, sourcePrivateRef`; FK `(tenantId,entryId)`; única `(tenantId,entryId,version)`; cuerpo inmutable |
| CuratedPublicationConsent | `tenantId, id, entryId, versionId, signerUserId, actorType, publicationScope, purpose, contentHash, policyHash, noticeVersion, validFrom, expiresAt, withdrawnAt, authorityProofPrivateRef`; FK compuesta `(tenantId,entryId,versionId)` |
| CuratedKnowledgeReview | `tenantId,id,entryId,versionId,reviewType,reviewerUserId,reviewedHash,reviewedPolicyHash`; FK compuesta; **sólo reserva de estructura en F1**, ningún approval habilitado hasta F2 |
| CuratedAccessGrant | `tenantId,id,entryId,versionId,audienceOrgId,revokedAt`; F1 no emite grants de lectura `TENANT_CURATED` |
| CuratedKnowledgeAudit + DomainOutboxEvent | Mismo `tenantId/entryId`, `aggregateRevision` monotónica, `eventSchemaVersion` separado; sólo IDs opacos, actor verificado, transiciones, hashes y fechas |

Todos los identificadores entrantes se correlacionan con `tenantId` resuelto **por la sesión**, nunca inferido del body. Claves foráneas cruzadas de tenant deben fallar **en PostgreSQL** incluso al llamar por error a una función interna. En F1, el alcance efectivo permitido es únicamente `ORG_PRIVATE`; `TENANT_CURATED` existe sólo como futura opción normativa **no activable**. Enum `ConsentPurpose=RAG_REFERENCE` significa permiso para una futura revisión/uso sujeto a gates; **no** autoriza consulta de F1. Rechazar `PUBLIC`, `CROSS_TENANT`, `MODEL_TRAINING`, `public_training` y campos fuera de los enums.

## 3. Endpoints propuestos y precondiciones

- `POST /v1/curated-knowledge/drafts`: HUMAN autenticado con rol de aportante y org actual; permite crear borrador privado con vínculo de procedencia guardado en almacén privado. Devuelve ID opaco y estado persistido `DRAFT` (borrador privado), sin URL original.
- `POST /v1/curated-knowledge/:entryId/versions/:versionId/consents`: HUMAN autor/titular o representante demostrado; entrada incluye `expectedContentHash`, `expectedPolicyHash`, `noticeVersion`, `validFrom`, `expiresAt`, `actorType`, evidencia de autoridad privada cuando corresponda. El servidor obtiene `signerUserId` de sesión y revalida versión, tenant, titularidad, mandato vigente, audiencia permitida, consentimiento explícito y consentimiento no duplicado bajo transacción serializable. Crea consentimiento + incremento de `aggregateRevision` + audit + outbox **en una misma transacción**.
- `POST /v1/curated-knowledge/:entryId/versions/:versionId/consents/:consentId/withdraw`: HUMAN firmante original o actual representante legítimo del titular **para ese consentimiento**; denegar compañero de la misma organización, otro aportante, antiguo delegado, revisor, publicador y principal de servicio. Revocación + audit + outbox en una transacción; reintento idempotente conserva rastro sin reactivar consentimiento.
- `GET /v1/curated-knowledge/private/drafts` y `GET /v1/curated-knowledge/private/consents`: vistas privadas paginadas, sólo para actor/organización autorizados; no sirven originales, consentimiento firmado ni referencias privadas de otro participante. No hay en F1 `/search`, `/publish`, `/reviews` ni `/public`.

El cuerpo/versión al que consiente la persona debe ser exactamente el documento que se le mostró: no basta resolver el `activeVersionId` al momento de firmar. Si cambia cualquiera de `versionId/contentHash/policyHash/publicationScope/purpose`, respuesta 409 y nueva aceptación. `expiresAt` es obligatorio y válido; para autorizar se usa el **reloj del servidor PostgreSQL**; una tarea periódica atrasada jamás extiende el permiso.

## 4. Operaciones atómicas, eventos y fallos

Transacción F1: `verify authenticated human -> verify tenant/org/resource and mandate -> compare immutable version + policy -> insert/withdraw consent -> increment Entry.aggregateRevision -> insert immutable audit -> insert minimal outbox -> COMMIT`. Si una inserción de audit/outbox falla, **rollback completo**, no consentimiento parcial ni falsa respuesta de éxito.

Envelope permitido: `eventType,eventSchemaVersion,tenantId,entryId,versionId,consentId,actorUserId,aggregateRevision,contentHash,policyHash,occurredAt,idempotencyKey`. Prohibidos: sourcePrivateRef, sanitizedBody aún no aprobado, título original o borrador, prompt, teléfono, nombre de cliente, ubicación, EXIF, firma, prueba de derechos, texto de motivo libre, stacktrace o secretos. Igual regla aplica a logs, telemetría, DLQ y excepciones.

Consumer/outbox: guardar high-water mark por `tenantId+entryId`; ante evento fuera de orden consultar el estado actual y nunca volver a activar consentimiento, documento, cache o índice después de una retirada. `aggregateRevision` **no** equivale a `eventSchemaVersion`.

## 5. Matriz de pruebas negativas obligatorias

| ID | Escenario | Resultado esperado |
|---|---|---|
| F1-01 | Contribuidor A del tenant A crea borrador propio | 201, sólo org/actor autorizados |
| F1-02 | Contribuidor B de la misma org intenta leer o retirar el consentimiento de A | 403/404 neutro, sin metadatos |
| F1-03 | Org B del mismo tenant intenta listar borrador de org A | 404 o colección vacía, sin conteo |
| F1-04 | Tenant C referencia `entryId/versionId` del tenant A | 404, FK compuesta rechaza inserción cruzada |
| F1-05 | Usuario sin membresía vigente o sesión revocada | 401/403, sin respuesta de contenido |
| F1-06 | Payload aporta `signerUserId`, `tenantId` o rol OPS_ADMIN falsos | Ignorados/rechazados; actor resuelto de sesión |
| F1-07 | Firmante representa a cliente/org sin mandato acreditado | Consentimiento denegado; audit seguro de rechazo |
| F1-08 | Mandato vencido o revocado antes de firma | Denegado; cero fila de consentimiento |
| F1-09 | Se cambia cuerpo o versión entre preview y firma | 409, cero consentimiento |
| F1-10 | Se cambia audiencia/policy/purpose entre preview y firma | 409, cero consentimiento |
| F1-11 | `expiresAt` faltante, anterior o inválido | 400; valores no sobreviven a DB |
| F1-12 | Caducó consentimiento y aún no corrió worker | SQL lo deniega usando DB now() |
| F1-13 | `publicationScope=PUBLIC/CROSS_TENANT/public_training` | 400/constraint violation, nunca fallback |
| F1-14 | `purpose=MODEL_TRAINING` o valor desconocido | 400/constraint violation |
| F1-15 | Principal de servicio intenta crear/revocar consentimiento humano | Denegado; sólo sugerencias, ninguna firma |
| F1-16 | Usuario legítimo retira consentimiento propio | Commit de withdraw + audit + outbox en revisión N |
| F1-17 | Fallo deliberado de audit/outbox al firmar o retirar | Rollback total; nunca éxito parcial |
| F1-18 | Dos consentimientos/retiros concurrentes y reintentos | Sin duplicados indebidos, una secuencia de revisiones coherente |
| F1-19 | Outbox publica N+1 (retirada), luego N (concesión) | High-water impide reactivación |
| F1-20 | Canary de texto cliente/PII en borrador, errores y DLQ | **0 apariciones** del canary en audit, eventos, logs, respuestas ajenas |
| F1-21 | Org ajena intenta leer título/estadística/vista previa | 404/0 títulos/0 contadores, no diferencia de existencia |
| F1-22 | Original `field_observation` PROMOTED/public_training ya indexado | No se supone público; cuarentena/denegación exigida y verificada separadamente |
| F1-23 | `OPENAI_API_KEY` presente, motor local indisponible | F1 no invoca OpenAI/embeddings ni transmite borradores |
| F1-24 | Cualquier llamada a `/publish`, `/search` o a review UI en F1 | Ruta desactivada/404; sin biblioteca visible |
| F1-25 | Pruebas de modelo FKs compuestas + rollback de migración | Sin referencias entre tenants y restauración documentada |

**Datos de prueba:** empresas ficticias Org-A/Org-B (tenant-1) y Org-C (tenant-2); usuarios ficticios aportante A1/A2, titular T1, representante R1 con mandato expirado, revisores P1/T2, publisher S1, service worker W1. Usar únicamente fichas/evidencia **sintéticas** de oficios; insertar canarios de privacidad que no sean PII real. Una ficha de ejemplo de electricidad es material formativo y **no** constituye una licencia, inspección o instrucción para trabajo energizado.

## 6. Evidencia de aprobación F1 — checklist entregable

- [ ] SDD + ADR del slice formalmente `APPROVED` por los responsables **competentes** (producto, seguridad, privacidad y derechos).
- [ ] Inventario/cuarentena de RAG histórico verificado sobre DB y sesiones A/B/C, con evidencias de no exposición.
- [ ] Migración aditiva real y constraints multi-tenant verificadas en PostgreSQL, rollback y backups.
- [ ] 25 pruebas F1 evaluadas en CI; guardar versión/SHA, run links y resultados verificables.
- [ ] Auditoría+outbox+revocación y replay negativo aprobados, sin fuga en logs/DLQ.
- [ ] Captura de red y pruebas con credenciales cloud presentes demuestran **cero egreso** privado.
- [ ] Doble revisión humana/lectura curada **NO** implementadas/activadas prematuramente.
- [ ] Seguridad independiente y staging aislado autorizados; publicación OFF.
- [ ] `SPEC_INDEX` y fichas SDD sincronizadas con resultado real; no promocionar DRAFT a APPROVED por CI documental.

**Release state:** NO APROBADO. F1 privado se diseña; F2 publicación y F3 búsqueda requieren aprobaciones y contratos posteriores. Ver #992, PR #1008 y dependencias #974/#987, #1007/#1009.
