---
type: tasks
feature: "knowledge-contributor-curated-library"
domain: "core"
plan: "docs/specs/core/knowledge-contributor-curated-library.plan.md"
version: "2.0"
status: "PENDING"
branch: "docs/curated-knowledge-library-992-20261018"
date: "2026-10-18"
---

# Backlog F0–F5 — Biblioteca Técnica SEMSE

> No implementar con spec DRAFT. Cada cambio de negocio necesita spec APPROVED y PR controlado.

## F0 — Contrato y autoridades
- [x] T001 Inventariar Observation, promoción, RAG, defaults `public_training` y #992 sin inventar aprobación.
- [x] T002 Proponer flujo custodio/derivado, ACL SQL, consentimiento y revisión técnica.
- [x] T003 Decisión de producto ratificada en #992 (2026-10-19): F1 `ORG_PRIVATE`; futuro `TENANT_CURATED` solo dentro del tenant, por versión, con consentimiento y doble revisión; no se atribuyen derechos o consentimientos ajenos.
- [ ] T003b Documentar y verificar titulares autorizados, licencias, atribución y política de retención/retiro con revisión jurídica/privacidad.
- [ ] T004 Seguridad/privacidad valida PII/EXIF/licencia/retención y ADR.
- [ ] T005 Regenerar/validar índice SDD y aprobar el spec.

## F0b — Contratos de consumo de conocimiento (sólo diseño)
- [x] T006 Identificar módulos existentes: Contributor, Prometeo RAG, BuildOps, Evidence, ProTools, Change Orders, Sense Vision, Skills, Mission Control y Payment Governance.
- [x] T007 Documentar anexo de contratos internos read-only, formatos de citas, datos permitidos, denegaciones y reglas de revocación.
- [ ] T008 Revisar coherencia con #974/#987 y #1007/#1009 y obtener aprobación independiente del diseño del gateway antes de implementar.
- [ ] T009 Definir pruebas de contrato para cada consumidor, con comprobación de cero efectos secundarios en pagos, permisos, evidencia y credenciales.

## F1 — F1A esquema privado / F1B flujo autenticado

F1A existe parcialmente en #1010 y su prueba PostgreSQL pasó en el merge de prueba `6db362ab`; eso no completa T010–T015 ni los 25 escenarios de API. [Evidencia y diferencias](knowledge-contributor-curated-library.delivery-gates.md).
- [ ] T010 Tests rojos: FK compuesta multi-tenant por entry/version/consent/review, signer humano real, representación válida/caducada, consentimiento a versión/hash/política concreta, enum inválido y plazo vencido.
- [ ] T011 Modelos tenant-scoped `CuratedKnowledgeEntry/Version/Consent/Review/Grant` con FKs compuestas, enums cerrados, hash inmutable de contenido/política, expiración, proof of signing authority, `aggregateRevision` y migración aditiva.
- [ ] T012 F1 API/UI sólo borrador privado, consentimiento firmado por humano `versionId + expectedContentHash + expectedPolicyHash`, con comprobación del verdadero firmante/titular/delegación, y retirada propia; cero búsquedas o publicación.
- [ ] T013 Validar aportante/firmante titular/delegado bajo sesión y membresía activas (no actor inyectado), representación temporal acreditada, consentimiento caducado y retiro por dueño del consentimiento; mismo-org ajeno/service/revisor denegados.
- [ ] T014 **Audit+outbox F1 transaccionales**, eventos de firma/retiro sin contenido ni PII, idempotencyKey + revision monotónica con high-water mark; test crash de auditoría, replays, Postgres migrado y sesiones A/B.
- [ ] T015 Entrega propia CI/PR, sin flag de publicación.

## F2 — Revisión y auditoría
- [ ] T020 Depuración local asistida + revisión humana, EXIF/metadatos y detección negativa; UI de revisión recién desde F2, no en F1.
- [ ] T021 Dos revisores humanos diferentes entre sí y distintos de aportante, autor, titular firmante y publicador; comprobar membresía, cualificación, MFA/step-up y rechazar cualquier principal de servicio. Pruebas negativas de todos los pares.
- [ ] T022 Publicación CAS Serializable sobre `versionId/contentHash/policyHash`, audiencia y dos firmas; registra auditoría/outbox de publicación (firma/retiro consentimiento ya se audita en F1). Invalidar revisiones al cambiar versión/política.
- [ ] T023 Retirar/suspender/superseder **publicación** (el retiro de consentimiento existe desde F1); revalidar derechos y consentimientos vigentes, policyHash y revocación en lectura SQL; probar fallo de audit, replay y publicación concurrente.
- [ ] T024 UI ES/EN móvil con decisiones y razones.

## F3 — Consulta y privacidad efectiva
- [ ] T030 Confirmar #974/PR987 en entorno aprobado, además de inventariar, poner bajo ACL/cuarentena y probar `field_observation` con `ragDocumentId` legacy, SDD `knowledge-contributor-rag-ingestion` y `public_training`. Sin pruebas no afirmar privados los originales. Flag OFF inicialmente.
- [ ] T031 Search PostgreSQL FTS-only por defecto sobre derivados publicados; jamás invocar `Prometeo EmbeddingService` cloud ni reenviar privados a OpenAI. Adaptador local opcional es otro cambio aprobado con test red-denied+credenciales cloud; cita opaca por versión.
- [ ] T032 ACL SQL única para texto/título/feedback/citation, org/tenant y membresía viva.
- [ ] T033 Tests al revocar/caché/outbox/replay con high-water mark, consentimiento/autoridad vencidos, hash/policy cambiados, agente sin scope, otra org/tenant, resultados sin PII en auditoría/DLQ y permisos de withdrawal.
- [ ] T034 Captura de red/egreso y pruebas 10k fichas, plan SQL, índices y latencia.
- [ ] T035 Canary sólo con autorización escrita y reversible.

## F4 — Capacitación y calidad
- [ ] T040 Fichas por oficio y región con referencias vigentes, niveles y advertencias.
- [ ] T041 Lecciones, autoevaluaciones y feedback humano; no credenciales profesionales automáticas.
- [ ] T042 Fecha de expiración/superseded y revisión de normativa técnica.

## F5 — Operación y liberación
- [ ] T050 Revisión independiente seguridad/privacidad, consentimientos comprobados.
- [ ] T051 CI completo, tipos, cobertura y validación SDD.
- [ ] T052 Postgres migración/rollback/checksum/replay/DLQ verificado.
- [ ] T053 Fusión/deploy/canary/observabilidad con evidencia separada.
- [ ] T054 P0 #974 y #992 sólo cierran después de las pruebas autorizadas.

**Done:** sin fuga, consentimiento válido y verificable, información vigente y citada, revocación efectiva y auditoría; flags/prod permanecen OFF mientras exista cualquier gate abierto.

## Entrega documental 2026-10-22

- [x] Reconciliar aprobación de producto #992 con F0, conservando SDD DRAFT.
- [x] Documentar evidencia CI F1A, procedencia del merge de prueba y validación Prisma local.
- [x] Unificar propósito cerrado `RAG_REFERENCE` y estado persistido `DRAFT`; documentar campos faltantes sin fingir implementación.
- [ ] Incorporar la documentación vigente de #1008 a la rama #1010 y revalidar la integración antes de continuar código.
- [ ] Completar dictámenes independientes y el registro de decisiones pendientes de la matriz de entregas.
