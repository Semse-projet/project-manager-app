---
type: plan
feature: "knowledge-contributor-curated-library"
domain: "core"
spec: "docs/specs/core/knowledge-contributor-curated-library.spec.md"
version: "2.0"
status: "DRAFT"
branch: "docs/curated-knowledge-library-992-20261018"
date: "2026-10-18"
---

# Plan F0–F5 — Biblioteca Técnica SEMSE

> Sólo planificación; spec aún DRAFT y código NOT_STARTED. Issue #992. No tocar el PR crítico #987 ni desplegar.

## 1. Snapshot de verdad

- `main` base revisada: `655e7fc028100f727389060ac68974b315420917`; no comprobaron aquí deploys ni variables reales de Railway.
- Issue #992 abierto: `PROMOTED` no prueba consentimiento; el código actual de main indexa observaciones sin contrato de publicación separado.
- PR #987 independiente contiene endurecimiento de grants privados y seguridad; **no está fusionado** al redactar.
- Scripts/GUI heredados `public_training`: no constituyen autorización de exposición; revisar antes de activar F3.
- Estado de consentimientos históricos, licencia y titularidad: **DESCONOCIDO**, no asumir.

## 2. Constitution check

- [x] Decisión de producto F1 ratificada por el propietario en #992: privados originales, `ORG_PRIVATE` por defecto, futuro `TENANT_CURATED` con consentimiento/version/revisores; esto NO es SDD APPROVED ni consentimiento de terceros.
- [ ] Aprobaciones independientes del SDD/ADR, titularidad, licencia, retención y privacidad antes de cualquier código de feature.
- [x] Límites tenant/org y deny-by-default diseñados.
- [x] Sin ejecución de pagos, escrow ni contratos por publicar.
- [x] Consentimiento, auditoría, outbox y retirada modelados como requisitos **con audit+outbox y retiro propio desde F1**, no aplazados a F2.
- [x] Se separan spec, código, CI, merge, deploy y activación.
- [ ] Test de amenazas y revisión jurídica de derechos/retención.
- [ ] Confirmar implementación P0 #974 en ambiente antes de cualquier publicación.

**Plano transversal propuesto:** [`knowledge-contributor-curated-library.integration-contracts.md`](knowledge-contributor-curated-library.integration-contracts.md) define una sola puerta de consulta, integración de solo lectura por módulo, revocación y restricciones de Payment Governance.

## 3. Arquitectura y autoridad

**Canónico:** `CuratedKnowledgeEntry` + versiones inmutables y aprobaciones en Postgres (no metadataJson como ACL).
**Privado:** Observation / PrometeoDocument original bajo dueño org; vínculo `sourcePrivateRef` privado sólo para curadores autorizados.
**Proyección:** sólo versión saneada `PUBLISHED`, accesible tras consentimiento + revisor privacidad + revisor técnico + permiso/tenant verificados.
**Search:** F3 comienza FTS-only en PostgreSQL; prohibido reutilizar `Prometeo EmbeddingService` que llama a OpenAI. Adaptador local separado sólo tras aprobación y no-egress probado incluso con `OPENAI_API_KEY` configurado; nunca cloud fallback. Títulos, conteos, feedback y citas siguen mismo `where` que el texto.
**Cachés:** scope/policyVersion, sin servir contenido al margen de SQL; revocación invalida inmediatamente ACL y asíncronamente los índices.

## 4. Slices y dependencias

| Slice | Contenido | Precondición / salida |
|---|---|---|
| F0 | SDD, consentimiento, matriz de seguridad y decisión #992 | Producto + privacidad + seguridad aprueban contrato |
| F1 | Custodia privada; borradores, firma humana por versión+hash/policy+caducidad, prueba de representación, retirar consentimiento propio, audit+outbox y aggregateRevision transaccionales; UI privada | Test actor/titular/retiradas/expiración/crash; cero publicación |
| F2 | Depuración y dos revisiones humanas incondicionalmente independientes, step-up, firma editorial, publication CAS+outbox de publicación | Transiciones concurrentes, no self-review y auditoría atómica; outbox de consentimientos ya existe desde F1 |
| F3 | FTS-only al inicio; RAG sólo derivados sanitizados con cita+ACL en la misma SQL | #974 activo, cuarentena de `field_observation` heredada, no-egress, actor verificado y tests de aislamiento |
| F4 | Capacitación por oficio, cuestionarios y feedback supervisado | Calidad técnico-editorial y advertencias verificadas |
| F5 | Canario y métricas, operación DLQ, rollback | Seguridad independiente, latencia y revocación probadas |

Cada slice tiene PR independiente y reversible; F0 de este PR **no ejecuta código ni migraciones**.

## 5. Datos, migraciones y compatibilidad

- Expand: tablas nuevas, claves compuestas tenant y versiones; SQL migratorio revisado, checksum y `prisma migrate deploy`; no `db push`.
- Backfill: inventariar observaciones sin mutar visibilidad. **Bloqueante antes de afirmar privacidad:** reconciliar el SDD APPROVED de raw observation ingestion, `ragDocumentId`, `field_observation`, defaults `public_training`, consumidores legacy y scripts. Aplicar ACL fail-closed/cuarentena o desindexación **bajo PR de seguridad independiente**, con pruebas SQL positivas/negativas y plan de rollback. Ningún `public_training` histórico es automáticamente elegible.
- Contract: ninguna columna existente se elimina en F1–F3; rollback desactiva flag y grants; forward-fix auditable si una migración ya se aplicó.
- **F1** introduce audit+outbox minimizados en la misma transacción que firma/retira consentimiento, sin cuerpo del borrador ni PII. **F2** añade publish/withdraw del derivado; todas las mutaciones incrementan `aggregateRevision` y el consumidor exige high-water mark persistente + estado vigente para impedir replay que resucite contenido retirado.
- Cualquier purga física respeta hold/retención; bloqueo de lectura ocurre primero.

## 6. Seguridad y abuso

Riesgos: fuga entre organizaciones, consentimiento falsificado, prompt injection, redacción insuficiente, consejo de oficio peligroso, índice huérfano, publicaciones concurrentes a revocación, ganancias indebidas. Mitigaciones: principal humano verificado para consentimientos y revisiones, firmante titular/delegado con autoridad vigente, SQL ACL del mismo statement, cuatro puertas de personas (aportante, titular, PRIVACY y TECHNICAL independientes), `contentHash + policyHash` por versión, plazo finito, enums cerrados, `tenantId` en toda la cadena con FKs compuestas, audit/outbox sin texto+revision monotónica y high-water mark, flags/FTS-only/no-egress.

## 7. Indicadores, despliegue y rollback

- Metas piloto: 0 fugas/cross-tenant, 0 egreso de originales, 100% consentimiento/version/revisores en publicados, 100% de revocaciones efectivas para consultas nuevas.
- Hipótesis p95 búsqueda < 1s con 10k fichas en datos de staging; validar `EXPLAIN (ANALYZE,BUFFERS)`, no declarar SLO logrado sin prueba.
- Flag `SEMSE_CURATED_KNOWLEDGE_ENABLED` siempre OFF hasta aprobación y canary explícito.
- Señal de rollback: cualquier exposición de fuente privada, evidencia de egreso, revocación que falle o publicaciones no autorizadas.

## 8. Investigación y decisiones

NIST AI RMF generativo: procedencia y gobierno; OWASP 2025: prompt injection, información sensible, poisoning, agencia y vectores. No entrenar modelos ni crear certificaciones. **Producto ratificado en #992 (2026-10-19):** F1 inicia en privado, con posible biblioteca curada únicamente dentro del mismo tenant, consentimiento explícito por versión y doble revisión. **Pendiente:** verificar titularidad y representación, licencia/retención/atribución, estándares técnicos/renovación y aprobaciones de seguridad/privacidad. Esta ratificación no es autorización para publicar ni para tratar datos de terceros.

## 9. Gates de tareas

- [ ] Decisión F1 de audiencia ya ratificada en #992; **pendiente** SDD APPROVED, validación jurídica/privacidad de firmantes y derechos y aceptación de seguridad.
- [ ] ADR de privacidad/propiedad y licencia aprobado.
- [ ] Dependencia real #974 reconciliada.
- [ ] Tests negativos y migraciones escritas ANTES del código de dominio.
- [ ] Integración autenticada y red instrumentada en staging aislado.
- [ ] CI/merge/deploy/canary/rollback validados por separado.
