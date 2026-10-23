---
type: delivery-gates
feature: knowledge-contributor-curated-library
status: DRAFT
date: "2026-10-22"
spec: docs/specs/core/knowledge-contributor-curated-library.spec.md
---

# Entrega F0 → F1A → F1B → F2 → F3

Esta matriz reconcilia decisiones y evidencia; no concede consentimiento de terceros,
no firma por revisores y no cambia el SDD a APPROVED. La bandera de publicación
`SEMSE_CURATED_KNOWLEDGE_ENABLED` permanece OFF como condición de entrega; no se
inspeccionaron variables de Railway ni datos de producción.

## 1. Decisión vigente y límites

[Decisión del propietario, 2026-10-19](https://github.com/Semse-projet/project-manager-app/issues/992#issuecomment-6261922298): originales privados; derivados depurados/versionados; ORG_PRIVATE por defecto; futura audiencia TENANT_CURATED limitada a organizaciones autorizadas del mismo tenant; consentimiento individual del aportante y autorización del titular; dos revisores humanos independientes; retiro efectivo; sin entrenamiento de modelos, pagos, licencias automáticas, enlaces públicos ni cross-tenant.

La instrucción de continuar las entregas permite preparar y validar el trabajo.
No equivale a dictamen independiente ni resuelve licencia/retención por terceros.
No volver a solicitar al propietario la elección de audiencia ya ratificada.

## 2. Corte de evidencia reproducible

| Elemento | Evidencia observada | Límite |
|---|---|---|
| #1008 | DRAFT/open, HEAD `d3f206f4f74869f5760751269d2ef72b6dfc19f9`, base main | F0 documental; este documento es una continuación de ese HEAD |
| #1010 | DRAFT/open, HEAD `7f27b13ade41cc6fd36485589a39633e3b2c5192`, base rama de #1008; base_sha reportado `1289fc2b2164411f9a2c5f9b57bde19d212de8ac` | No contiene las seis revisiones documentales posteriores de #1008 |
| Prisma F1A local | Prisma CLI 6.19.3, `validate --schema packages/db/prisma/schema.prisma`: PASS | URL sintética local sólo para validar configuración; no hubo conexión ni migración local |
| [API Integration 39218215284](https://github.com/Semse-projet/project-manager-app/actions/runs/39218215284) | SUCCESS; job `117947025370`, migraciones y DB-backed API tests SUCCESS | CI existente, recuperado; no ejecución nueva ni prueba de staging |
| Checkout de ese job | `6db362ab540dd6452a9c8fac63da711107fa4a29`, merge de `7f27b13a...` en `4cf36f6c7cfde58c5460c9672407b892ed6c946b` | Es el merge de prueba de GitHub, no ejecución directa del head aislado ni integración futura |
| Migración F1A en logs | `20261019090000_curated_knowledge_f1_private_custody` aplicada a las 07:49:41Z del 19-oct | No prueba migración de producción/rollback |
| Prueba específica | `ok 62 - F1A: private defaults, tenant-bound FK, version immutability keys, and consent isolation`, 133.139738 ms | No omitida; una prueba con varias aserciones, no los 25 escenarios F1B |
| [CI 39218215382](https://github.com/Semse-projet/project-manager-app/actions/runs/39218215382) | Workflow SUCCESS asociado a head F1A | No sustituye aceptación funcional, revisión independiente ni CI tras cambios |
| #987 | DRAFT/open, HEAD `a4162548d30eb8e17fa54b286de05f0929963f92` | No inferir CI del HEAD actual a partir de bloques históricos del cuerpo |
| #974 | OPEN en el cruce de esta sesión | No consta cierre operativo de seguridad |

La prueba F1A verifica defaults privados, prohibición de PUBLISHED, FKs entre tenants,
unicidad de versión, rechazo de UPDATE, propósito de entrenamiento inválido,
consentimiento expirado al insertar y titular org ausente/ajeno. La retirada se
prueba como UPDATE directo de DB: **no** demuestra identidad, permisos, auditoría,
outbox ni retiro por HTTP. El test tampoco cubre dos organizaciones del mismo
tenant. El runner usa DATABASE_URL para evitar skip; el job observado sí ejecutó
la prueba sobre PostgreSQL 16. Algunas aserciones aceptan cualquier rechazo:
reforzar códigos/constraints esperados al ampliar F1B, sin presentar ese refuerzo
como ya realizado.

## 3. Gates y criterio de cierre

| Gate | Entrada | Salida verificable | No permite |
|---|---|---|---|
| F0 contrato | Decisión #992, spec/plan/tasks/checklist | SDD/ADR con dictámenes competentes, parámetros jurídicos y trazabilidad; índice/validador coherentes | Firmar por aportantes, publicar, asumir aprobación por CI |
| F1A custodia | Migración aditiva de #1010 | FK compuestas, inmutabilidad, unicidad, privado por DB y migración/test con procedencia | API, compartir, indexar, presentar F1 completo |
| F1B consentimiento | F0 aprobado + F1A reconciliada/validada | Borrador/versiones, sesión humana, representación, hashes exactos, plazo, retiro propio, auditoría/outbox/revision atómicos; 25 escenarios F1 ejecutados | Publicar, revisar editorialmente, buscar |
| F2 revisión | Consentimientos válidos por versión | PRIVACY y TECHNICAL humanos distintos entre sí y de autor/aportante/firmante/publicador; cualificación y step-up; decisiones hash/policy-bound | Aprobar por IA o por coincidencia de roles |
| F2 publicación | Revisiones y derechos actuales | FSM/CAS serializable; lectura de proyección depurada; migración explícita del CHECK F1A; prueba publish/withdraw/replay concurrentes | Abrir la audiencia sólo por flag o por consentimiento almacenado |
| F3 RAG | F2 + #974/#987 aprobados/desplegados/verificados | FTS-only inicial; ACL SQL en contenido/citas/conteos; vigencia por reloj DB; actor verificado; no-egress y revocación efectiva | Cloud fallback, originales, herramientas desde texto recuperado |

Publicación efectiva necesita también aislamiento legacy, seguridad independiente,
staging y rollback. F5 conserva el canary autorizado del plan: no se renumera ni
se considera satisfecho por terminar F3. Desarrollo, merge, deploy y activación
son decisiones/evidencias distintas.

## 4. Diferencias de contrato que F1B debe resolver

| Concepto | F1A implementado | Contrato objetivo / resolución |
|---|---|---|
| Propósito | `CuratedConsentPurpose.RAG_REFERENCE` | Se unifica documentación a RAG_REFERENCE, único valor cerrado; sin nuevo permiso ni alias externo CURATED_RAG_REFERENCE |
| Estado privado | `DRAFT` + `ORG_PRIVATE`, CHECK DB | DRAFT_PRIVATE/DRAFT_DERIVATIVE eran etiquetas descriptivas; la respuesta F1 debe usar DRAFT. F2 requiere definir la FSM exacta antes de migrar el CHECK |
| Actor | `createdByUserId`, `actorUserId` como texto | Derivar de sesión; comprobar HUMAN/membresía. Un string o FK de org no acredita identidad ni mandato |
| Derechos | `rightsHolderOrgId`, `proofPrivateRef`, `legalBasisReviewed=false` | Faltan autoridad temporal verificada, identidad del representante y revalidación. Booleano no sustituye prueba/dictamen |
| Plazo | `grantedAt`, `expiresAt`, CHECK `expiresAt > grantedAt` | Añadir semántica `validFrom`; revalidar con now() al autorizar. CHECK de inserción no bloquea por sí solo lecturas futuras al vencer |
| Hashes | `contentSha256`, `versionContentSha256`, `audiencePolicySha256` | Comparar exactamente contra contenido/política mostrados; formato SHA-256 no demuestra igualdad. Falta snapshot inmutable de política de versión |
| Vinculación | Consent→Version y Version→Entry por tenant | Resolver entrada por relación; no aceptar entryId y versionId incongruentes. Si se añade entryId a Consent, FK compuesta consistente |
| Auditoría/outbox | `aggregateRevision=0`, comentario "from F2 onward"; sin flujo atómico | Corregir en F1B: incremento CAS + audit + outbox desde primera firma/retirada; no esperar a F2 |
| Review/Grant | No implementados | Reservas del modelo objetivo, sin approvals ni grants de audiencia en F1B |
| Retiro | Campos de retirada y UPDATE directo de test | Endpoint sólo firmante/representante vigente autorizado, idempotencia y rollback total de audit/outbox |

Estas diferencias son backlog explícito, no afirmaciones de endpoints vulnerables
ya activos. Antes de modificar schema: migración planificada y pruebas del nuevo
contrato; no cambiar una migración aplicada para esconder drift.

## 5. Orden de F1B listo para ejecución tras el gate formal

1. T010/T011: fijar mapeo anterior, política inmutable, autoridad/vigencia y
   persistencia de audit/outbox/revision. Tests negativos primero. Reutilizar
   infraestructura canónica; no crear bus alterno de ProductEvent.
2. T012/T013: borradores/versiones con ownership privado; consentimiento sobre
   preview exacta; rechazar tenant/firmante inyectado, mandato vencido y hashes
   obsoletos (409). Ninguna firma de service account.
3. T014: retirada propia + transacción audit/outbox; fallo inducido revierte todo;
   idempotencia y serialización concurrente; replay N después de retirada N+1 no
   reactiva. Vigencia se evalúa sin esperar al worker.
4. T012/T015: vistas privadas y UI ES/EN con estado NO PUBLICADO y retirada;
   registro de endpoints/eventos reales al implementarlos. No rutas /publish,
   /search, /reviews ni enlaces navegables a pantallas futuras.
5. Ejecutar F1-01…F1-25 con Org-A/Org-B del tenant-1 y Org-C del tenant-2,
   canarios sintéticos, dos humanos por org y representantes vigentes/revocados.
   Archivar resultados por SHA, migration checksum y entorno; documentar skips.

## 6. Dependencias y trabajo independiente

- #1008 → #1010/F1B: contrato y rama apilada. Actualizar la rama hija sin perder
  commits; volver a revisar su diff/CI. No fusionar a main sólo por mergeable=true.
- #1010 → F1B → F2 → F3: datos, autoridad, revisión/publicación y recuperación.
- #974/#987 → publicación/consulta efectiva: comprobar seguridad desplegada,
  aislamiento, grants y retirada. No equivale a derechos curatoriales de #992.
- Legacy → privacidad efectiva F1/F3: inventario read-only de ragDocumentId y
  field_observation, ACL o cuarentena/desindexación auditada, prueba A/B/C.
  Inventario no demuestra cuarentena; una ruta legacy expuesta bloquea esa audiencia.
- Preparar contratos y validar esquema privado puede avanzar sin activar #987.
  Los consumidores sin actor/scope permanecen fail-closed; no habilitarlos para
  cerrar un hallazgo. #1008/#1010 no cierran automáticamente #992 ni #974.

## 7. Expediente de decisión independiente pendiente

| Dictamen | Material concreto a revisar | Evidencia de cierre pendiente |
|---|---|---|
| Producto | Decisión #992 y límites de esta matriz | Ratificación ya registrada; no repetir audiencia |
| Derechos/privacidad | Titular individual/empresa, representación, licencia de uso, atribución opcional, plazo/retención/hold y titular incierto | Documento versionado, autoridad revisora e identidad/fecha; no hay valores de retención inventados |
| Seguridad/arquitectura | Modelo, hashes, scopes SQL, atomicidad, amenazas y 25 escenarios F1 | Revisor independiente, dictamen y SHA/versión exactos; estado formal SDD/ADR |
| Técnica por oficio (F2) | Cualificación, jurisdicción, referencias, expiración y límites | Dos revisiones independientes aplicables a cada versión, no aprobación genérica |
| Operación | DB/secretos/storage/sesiones staging separados; restauración y rollback que preserven retiro/cuarentena | Prueba reproducible con datos sintéticos, checksum y SHA desplegado |

Ante derechos inciertos: privado/denegado. Ante fallo de no-egress, exposición o
retiro: bloquear acceso primero; recuperación física según política aprobada.
No prometer borrar copias descargadas. Rollback de aplicación no equivale a revertir
schema ni recuperar datos. Ningún resultado de esta entrega cambia pagos, firmas,
credenciales, grants privados existentes ni licencias profesionales.
