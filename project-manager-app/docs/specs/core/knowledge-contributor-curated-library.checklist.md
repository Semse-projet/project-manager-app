---
type: checklist
feature: "knowledge-contributor-curated-library"
spec: "docs/specs/core/knowledge-contributor-curated-library.spec.md"
version: "2.0"
date: "2026-10-18"
---

# Checklist de privacidad, técnica y liberación

| Gate | Estado al crear F0 | Evidencia requerida |
|---|---|---|
| Audiencia F1 de producto | RATIFICADA, NO ACTIVADA | #992: `ORG_PRIVATE` por defecto; `TENANT_CURATED` futuro opt-in dentro del mismo tenant |
| Consentimientos del titular y contribuidor | PENDIENTE | Autorización real individual/version/scope y representación comprobada, nunca en nombre de terceros |
| Derecho/licencia/uso histórico | PENDIENTE | Titularidad revisada; sin `public_training` implícito |
| Revisión separada privacidad y oficio | DISEÑO | Actores distintos, cualificación, riesgo y hash |
| Original vs derivado físico | DISEÑO | No fuente original ni metadata en read model compartido |
| Tenant/org permisos SQL | DISEÑO | Tests postgresql y autenticados A/B/tenant B |
| Revocación y concurrencia | DISEÑO | Nuevo query niega luego de commit; eventos/cachés/DLQ |
| Prompt injection/poisoning | DISEÑO | Datos tratados como no confiables, sin tools desde resultados |
| No egreso cloud | PENDIENTE | Instrumentación real y prueba negativa en staging aislado |
| Vínculo económico | FUERA DE ALCANCE | Ningún pago/escrow por publicación |
| SDD APPROVED y ADR | PENDIENTE | Autorización propietaria + seguridad separadas |
| Migración/rollback | PENDIENTE | Archivos SQL/checksum y forward-fix, nunca db push |
| CI, merge, deploy, activación | NO REALIZADOS | Evidencia distinta para cada transición |

**Integración cruzada DRAFT:** [`knowledge-contributor-curated-library.integration-contracts.md`](knowledge-contributor-curated-library.integration-contracts.md) especifica Knowledge Gateway, lectores read-only, escenarios de ACL, vínculos con Vision/Skills y prohibiciones de side effects en pagos. No demuestra implementación ni aprobación formal.

| RAG histórico con originales PROMOTED | BLOQUEANTE, SIN EVIDENCIA DE CUARENTENA | Contrato raw-ingestion aprobado + inventario `ragDocumentId`, ACL/cuarentena SQL o deindexación y tests A/B/tenant C antes de afirmar confidencialidad |
| F1 consentimientos y revocaciones | CONTRATO REFORZADO, NO IMPLEMENTADO | Firma humana por versión/hashes/plazo, titular con representación temporal, retiro propio, audit+outbox CAS+revision desde F1 |
| Autoridad y revisión independiente | PENDIENTE | PRIVACY/TECHNICAL humanos distintos entre sí y de aportante/autor/firmante/publicador; bloquear service accounts |
| Caducidad / audience policy | PENDIENTE | `expiresAt`, `policyHash`, enums cerrados, revalidación SQL y nueva firma por versión/cambio |
| Tenant / FK compuesta | PENDIENTE | `tenantId` en todos los modelos; pruebas de IDs ajenos no asociados a otro tenant |
| DLQ y payloads privados | PENDIENTE | Audit+outbox sólo IDs/hashes/revision; 0 texto de original o borrador, PII, EXIF, título o errores de secret |
| FTS-only y egreso | PENDIENTE | No usar OpenAI EmbeddingService; salida FTS o insuficiente, incluso con `OPENAI_API_KEY` configurada |
| Replay publication/revoke | PENDIENTE | Revisión monotónica por agregado + high-water mark persistente, sin resurrección de estado retirado |
| UI por fases | PENDIENTE | F1 borrador/consentimiento/retirada; F2 revisión; F3 biblioteca/scope SQL |

**Análisis de coherencia F0:** existe plataforma de extracción/promoción, pero no consentimiento compartido. La publicación curada es un nuevo contrato, no una reinterpretación de `PROMOTED`. Este diseño depende de seguridad #974 y de decisión #992. No hay contradicción deliberada con Payment Governance: publicar no libera dinero.

**Investigación externa:** NIST AI RMF GAI Profile y OWASP Top 10 for LLM Applications (2025), especialmente divulgación de información, poisoning y debilidades de embeddings. Se usan como marco, **no certifican** SEMSE.

- [ ] Aprobaciones del SDD/ADR y límites completados.
- [ ] Tests de cada escenario P1 ejecutados sobre CI y PostgreSQL real.
- [ ] Aislamiento multi-tenant, revocación, no-egress, respaldo y rollback probados.
- [ ] Índice SDD regenerado, PR propio fusionado y stages verificados.
- [ ] Sin rollout ni afirmación de producción hasta canary autorizado.

**Corte 2026-10-22:** [matriz de entregas y evidencia F1A](knowledge-contributor-curated-library.delivery-gates.md). La prueba DB de F1A pasó en CI; los gates de endpoints, consentimiento real, independencia, cuarentena legacy, staging y rollback permanecen pendientes. No marcar los 25 escenarios F1 como aprobados por esa única prueba.

**ADR F0 propuesto:** [custodia y gateway](../../architecture/ADR-curated-knowledge-custody-and-gateway.md). Define Knowledge como módulo propietario, mantiene ADR-036/ADR-022, registra alternativas y enmienda pendiente del contrato de ingesta legacy. Ver [análisis de revisión del 23-oct](../../reportes/2026-10-23_curated-library-review-followup.md). Estado PROPOSED; aprobación formal pendiente.
