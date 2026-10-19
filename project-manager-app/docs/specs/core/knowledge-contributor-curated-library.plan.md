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

- [ ] Aprobación explícita del nuevo contrato F1 (distinta de la aprobación de grants privados).
- [x] Límites tenant/org y deny-by-default diseñados.
- [x] Sin ejecución de pagos, escrow ni contratos por publicar.
- [x] Consentimiento, auditoría, outbox y retirada modelados como requisitos.
- [x] Se separan spec, código, CI, merge, deploy y activación.
- [ ] Test de amenazas y revisión jurídica de derechos/retención.
- [ ] Confirmar implementación P0 #974 en ambiente antes de cualquier publicación.

## 3. Arquitectura y autoridad

**Canónico:** `CuratedKnowledgeEntry` + versiones inmutables y aprobaciones en Postgres (no metadataJson como ACL).
**Privado:** Observation / PrometeoDocument original bajo dueño org; vínculo `sourcePrivateRef` privado sólo para curadores autorizados.
**Proyección:** sólo versión saneada `PUBLISHED`, accesible tras consentimiento + revisor privacidad + revisor técnico + permiso/tenant verificados.
**Search:** FTS Postgres primero; opcional vector local medido; sin proveedor cloud para chunk/embedding privados. Títulos, conteos, feedback y citas siguen mismo `where` que el texto.
**Cachés:** scope/policyVersion, sin servir contenido al margen de SQL; revocación invalida inmediatamente ACL y asíncronamente los índices.

## 4. Slices y dependencias

| Slice | Contenido | Precondición / salida |
|---|---|---|
| F0 | SDD, consentimiento, matriz de seguridad y decisión #992 | Producto + privacidad + seguridad aprueban contrato |
| F1 | Tablas/versiones y consentimiento, UI de borradores | Test actor/titular + no publicación |
| F2 | Pipeline de depuración, 2 revisores, firma editorial, outbox | Transiciones concurrentes y auditoría atómica |
| F3 | RAG SQL/FTS sólo sobre fichas sanitizadas; cita y revocación | #974 activo, no-egress y test de aislamiento |
| F4 | Capacitación por oficio, cuestionarios y feedback supervisado | Calidad técnico-editorial y advertencias verificadas |
| F5 | Canario y métricas, operación DLQ, rollback | Seguridad independiente, latencia y revocación probadas |

Cada slice tiene PR independiente y reversible; F0 de este PR **no ejecuta código ni migraciones**.

## 5. Datos, migraciones y compatibilidad

- Expand: tablas nuevas, claves compuestas tenant y versiones; SQL migratorio revisado, checksum y `prisma migrate deploy`; no `db push`.
- Backfill: inventariar observaciones sin mutar visibilidad. Ningún `public_training` histórico es automáticamente elegible.
- Contract: ninguna columna existente se elimina en F1–F3; rollback desactiva flag y grants; forward-fix auditable si una migración ya se aplicó.
- Un outbox atómico gobierna publish/withdraw, y reintentos idempotentes evitan resurrección por indexación tardía.
- Cualquier purga física respeta hold/retención; bloqueo de lectura ocurre primero.

## 6. Seguridad y abuso

Riesgos: fuga entre organizaciones, consentimiento falsificado, prompt injection, redacción insuficiente, consejo de oficio peligroso, código obsoleto, indice huérfano, publicaciones concurrentes a revocación, ganancias indebidas del programa. Mitigaciones: principal verificado, SQL ACL del mismo statement, cuatro puertas humanas (aportante, titular, privacidad, oficio), hash por versión, fuentes comprobables, flags y revisión doble, worker de purga y logs minimizados.

## 7. Indicadores, despliegue y rollback

- Metas piloto: 0 fugas/cross-tenant, 0 egreso de originales, 100% consentimiento/version/revisores en publicados, 100% de revocaciones efectivas para consultas nuevas.
- Hipótesis p95 búsqueda < 1s con 10k fichas en datos de staging; validar `EXPLAIN (ANALYZE,BUFFERS)`, no declarar SLO logrado sin prueba.
- Flag `SEMSE_CURATED_KNOWLEDGE_ENABLED` siempre OFF hasta aprobación y canary explícito.
- Señal de rollback: cualquier exposición de fuente privada, evidencia de egreso, revocación que falle o publicaciones no autorizadas.

## 8. Investigación y decisiones

NIST AI RMF generativo: procedencia y gobierno; OWASP 2025: prompt injection, información sensible, poisoning, agencia y vectores. No entrenar modelos ni crear certificaciones. **Decisiones abiertas:** alcance F1 tenant y titularidad, retención/licencia, atribución, estándares técnicos/renovación. No atribuir aprobación al usuario sin su decisión explícita en #992.

## 9. Gates de tareas

- [ ] Resolución de #992 y SDD APPROVED.
- [ ] ADR de privacidad/propiedad y licencia aprobado.
- [ ] Dependencia real #974 reconciliada.
- [ ] Tests negativos y migraciones escritas ANTES del código de dominio.
- [ ] Integración autenticada y red instrumentada en staging aislado.
- [ ] CI/merge/deploy/canary/rollback validados por separado.
