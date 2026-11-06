---
id: "ADR-curated-knowledge-custody-and-gateway"
title: "Custodia privada y consulta gobernada de Biblioteca Técnica Prometeo"
status: "PROPOSED"
date: "2026-10-23"
---

# ADR — Custodia privada y gateway de conocimiento curado

**PROPOSED.** [SDD rector](../specs/core/knowledge-contributor-curated-library.spec.md),
[#1008](https://github.com/Semse-projet/project-manager-app/pull/1008),
[#992](https://github.com/Semse-projet/project-manager-app/issues/992).
Identificador semántico para evitar colisión con ADR-046 referenciado por #987;
no se renumera una decisión de otro PR. Este documento no representa aprobación
jurídica, de seguridad ni consentimiento individual.

## Contexto y decisión de producto ya ratificada

El propietario ratificó originales privados, derivados depurados, ORG_PRIVATE
inicial y futuro TENANT_CURATED con consentimiento granular, titular acreditado,
doble revisión humana independiente y retirada. La promoción editorial histórica
no acredita derechos compartidos. #1010 sólo implementa una base de datos privada;
las APIs, autoridad y publicación necesitan contratos y validaciones posteriores.

## Alternativas consideradas

| Alternativa | Evaluación |
|---|---|
| Marcar PrometeoDocument/Observation originales como compartidos | Rechazada: mezcla procedencia y derivado, conserva PII y convierte metadata editorial en autorización |
| Nuevo servicio de conocimiento con DB/policy/model router propios | Rechazada para este alcance: duplica autoridad, operación y límites de orquestación |
| Extender KnowledgeModule con agregado curado separado y gateway de dominio | Propuesta: conserva originales, reutiliza backend y permite autorización SQL/retirada por versión |
| Reutilizar EmbeddingService y fallback cloud desde el inicio | Rechazada para datos privados curados: falta evidencia no-egress y viola el límite FTS-only inicial |
| FTS PostgreSQL inicial; adaptador local opcional posterior | Propuesta: superficie pequeña y denegación verificable; embeddings requieren otro cambio aprobado y medición |

## Decisiones arquitectónicas propuestas

1. **Propietario:** `apps/api/src/modules/knowledge/` extiende el KnowledgeModule
   existente con controller, policy, repositorio y servicio curatoriales. El
   prefijo HTTP propuesto `/v1/curated-knowledge` no requiere otro módulo ni backend.
   Contributor Program conserva originales; Evidence conserva sus ACL y custodias.
2. **Persistencia:** Entry/Version/Consent/Review/AccessGrant más audit/outbox en
   PostgreSQL canónico. Versiones derivadas separadas físicamente de originales;
   FKs tenant-scoped. Procedencia privada fijada por versión, consentimiento y
   revisión vinculados a contenido/política inmutables. Un cambio exige versión
   nueva. No reinterpretar hashes/formato o booleanos como prueba de autoridad.
3. **Gateway:** `searchCuratedKnowledge` es la puerta del dominio para contenido
   curado, no reemplaza el orquestador Prometeo ni todos los RAG de SEMSE. BFF y
   consumidores llaman al servicio público de Knowledge; no leen tablas o índices
   privados saltándose policy. Backend verifica sesión/principal, tenant, org,
   membresía, audiencia, versión, consentimiento y revisiones en la misma consulta
   SQL que recupera contenido, conteos y citas.
4. **ADR-036 preservado:** Prometeo mantiene contexto, selección de modelos y tools.
   Una invocación de la herramienta curada pasa por `evaluatePrometeoToolPolicy`
   antes del gateway. Un allow de tool no concede acceso al documento; el dominio
   vuelve a comprobar la autorización. `packages/agents` conserva su gobernanza
   de runs y no importa el router LLM ni reimplementa ACL de Knowledge. El texto
   recuperado nunca da órdenes ni habilita tools o efectos de negocio.
5. **ADR-022 preservado:** firma/retiro + AuditLog + DomainOutboxEvent + revisión
   monotónica en una transacción corta desde F1B. Sin red dentro de la transacción.
   Dispatcher/BullMQ/receipts durables canónicos; payload sólo IDs/hashes y datos
   permitidos. High-water mark por agregado y relectura de estado impiden resurrección
   por replay. No crear un bus paralelo ni utilizar ProductEvent como audit de dominio.
6. **Permisos:** familia `knowledge:*` propuesta en spec §3. Los nombres no son
   grants vigentes; registrar capacidades y guards cuando se implemente el slice.
   OPS_ADMIN o pertenecer al tenant no sustituye consentimiento ni independencia.
7. **FSM/eventos:** spec §4/§6 son las únicas listas canónicas. F1 privado sólo DRAFT;
   F2 implementa los demás estados y modifica explícitamente el CHECK de F1A tras
   validación. Retiro de consentimiento existe desde F1B. SUSPENDED representa
   revisión técnica requerida; no se introduce un estado NEEDS_REVIEW paralelo.
8. **Recuperación:** F3 comienza FTS-only sin EmbeddingService ni fallback cloud,
   incluso con credenciales cloud presentes. Local no disponible → contexto
   insuficiente; nunca originales. Un adaptador local futuro exige aprobación y
   prueba no-egress. Citas opacas por versión siguen los mismos predicados de acceso.

## Relación con el contrato de ingesta legacy

[core.knowledge-contributor-rag-ingestion](../specs/core/knowledge-contributor-rag-ingestion.spec.md)
continúa APPROVED. Este ADR propone una **enmienda**, no una sustitución aprobada:
indexar al promover/desindexar al rechazar no implica publicar observaciones a
otras organizaciones. El cambio deberá conservar el ciclo de vida privado donde
esté autorizado y encauzar publicación compartida hacia derivados consentidos.

La enmienda se tramita en seguimiento propio de #974/#992. Antes de afirmar
privacidad: inventario read-only de ragDocumentId/field_observation, autorización
actual, cuarentena/ACL o desindexación auditada y pruebas A/B/C. No ejecutar backfill
público ni inferir cuarentena de que el flag curado esté OFF. Este ADR no modifica
el estado del contrato anterior ni la base de datos.

## Aceptación, consecuencias y rollback

- F0 necesita dictámenes identificables sobre SDD/ADR y derechos/retención. No se
  inventan periodos, licencias ni representantes. Derechos inciertos → privado.
- F1A conserva los bloqueos de revisión de integridad de #1010; un test verde no
  cubre delete/recreate, resurrección de consentimientos, procedencia, identidad
  persistida ni duplicados concurrentes si no contiene esas aserciones.
- F1B exige F1-01…F1-25, más regresiones concretas de los hallazgos del esquema,
  en PostgreSQL y sesiones autenticadas. Ningún consent real antes de esos controles.
- F2 exige dos revisores independientes, CAS y retiro; F3 exige #974/#987 aprobados,
  desplegados y verificados, SQL ACL y cero egreso. Canary sigue en F5.
- Retirada deniega consultas nuevas desde commit; índice/caché se limpian después.
  No se promete borrar copias ya entregadas. Conservación/purga depende de política
  aprobada y legal hold; reservas de identidad no deben permitir reutilizar versiones.
- Costos: tablas/índices y control de concurrencia adicionales; overhead SQL y operación
  de colas. Medir rendimiento con datos sintéticos representativos, sin recortar ACL.
- Rollback de app: flag OFF y bloqueo de exposición preservando retiradas/cuarentena,
  audit y consentimientos. Migraciones aditivas con recuperación/forward-fix probado;
  revertir código no recupera datos ni deshace schema.

## Referencias de gobierno

- [ADR-036: frontera Prometeo/agentes](ADR-036-prometeo-agents-boundary.md).
- [ADR-022: transactional outbox y BullMQ](ADR-022-transactional-outbox-bullmq.md).
- [Matriz de entregas](../specs/core/knowledge-contributor-curated-library.delivery-gates.md).
- [F1 aceptación](../specs/core/knowledge-contributor-curated-library.f1-acceptance.md).

No hay firma independiente registrada en este ADR. Estado PROPOSED; las revisiones
humanas deben indicar identidad, rol competente, versión/SHA, alcance y resultado.
