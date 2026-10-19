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

## F1 — Diseño verificable y datos privados
- [ ] T010 Crear tests rojos por tenant/org/consentimiento y versiones inmutables.
- [ ] T011 Agregar modelos `CuratedKnowledgeEntry/Version/Consent/Review/Grant` y migración aditiva.
- [ ] T012 Crear endpoints autenticados sólo para borrador/consentimiento, sin lectura común.
- [ ] T013 Validar derechos del aportante y dueño org (no actor inyectado).
- [ ] T014 Integración contra Postgres migrado y smoke A/B.
- [ ] T015 Entrega propia CI/PR, sin flag de publicación.

## F2 — Revisión y auditoría
- [ ] T020 Depuración local asistida + revisión humana, EXIF/metadatos y detección negativa.
- [ ] T021 Revisión separada privacidad/oficio; comprobar credenciales de revisores.
- [ ] T022 Estado/version hash/consentimiento con CAS Serializable y audit+outbox.
- [ ] T023 Revocar, suspender, superseder; prueba de fallo del audit y publicación concurrente.
- [ ] T024 UI ES/EN móvil con decisiones y razones.

## F3 — Consulta y privacidad efectiva
- [ ] T030 Confirmar #974/PR987 en entorno aprobado y flag OFF inicialmente.
- [ ] T031 Search FTS + opcional local embeddings sólo de derivados; cita pública opaca por versión.
- [ ] T032 ACL SQL única para texto/título/feedback/citation, org/tenant y membresía viva.
- [ ] T033 Tests al revocar/caché/outbox/replay, agente sin scope, otra org y otro tenant.
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
