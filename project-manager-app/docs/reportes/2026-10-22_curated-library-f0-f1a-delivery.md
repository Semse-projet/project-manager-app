# Biblioteca Técnica Prometeo — entrega documental y verificación F1A

Fecha: 2026-10-22. Alcance: #1008/#1010 y dependencia de #987/#974.

## Cambios entregados

- Aprobación de producto #992 reconciliada; SDD sigue DRAFT y flag de publicación OFF.
- Plan distingue esquema F1A y consentimiento/retirada autenticados F1B.
- Propósito cerrado unificado a RAG_REFERENCE; respuesta privada usa DRAFT.
- Matriz de gates, diferencias campo por campo, expediente de revisión independiente y secuencia T010–T015 agregados en [delivery-gates](../specs/core/knowledge-contributor-curated-library.delivery-gates.md).
- Se conserva la matriz existente F1-01…F1-25; no se declara ejecutada por el éxito del test de integridad F1A.

## Validación

- Local, sobre documentación modificada: `node scripts/spec-validate.mjs --strict`: 203 specs, 0 errores, 0 advertencias.
- Local: `node scripts/spec-index.mjs --check`: 203 entradas coherentes.
- Local: `git diff --check`: PASS.
- Local, esquema F1A exacto `7f27b13ade41cc6fd36485589a39633e3b2c5192`: Prisma 6.19.3 validate PASS usando URL sintética. El primer intento sin DATABASE_URL sólo falló por configuración ausente (P1012), no por defecto demostrado del schema.
- CI recuperado: [API Integration 39218215284](https://github.com/Semse-projet/project-manager-app/actions/runs/39218215284), job 117947025370 SUCCESS. Logs demuestran migración de custodia y test F1A `ok 62` ejecutado sobre PostgreSQL 16; checkout `6db362ab540dd6452a9c8fac63da711107fa4a29` incluye head `7f27b13a` y base `4cf36f6c`. No extrapolar a otra integración.
- No hay servidor PostgreSQL ni Docker local disponible en esta sesión. No se fabricó una ejecución local de migración ni de los endpoints pendientes.

## Análisis de coherencia y límites

El SDD exige auditoría/outbox y aggregateRevision desde F1B; el esquema F1A sólo tiene placeholder y comentario que lo aplaza a F2. Queda identificado para corregir al implementar F1B. F1A no acredita representación, comparación de hashes, vigencia de lecturas, aislamiento intra-tenant por HTTP ni retiro autenticado.

#987 sigue DRAFT en `a4162548d30eb8e17fa54b286de05f0929963f92`; no se ejecutó ni certificó CI de ese SHA. No se inspeccionaron datos legacy, se aplicó cuarentena, se desplegó ni se activó sharing/RAG. La independencia del revisor no la sustituye esta revisión del propio trabajo.

## Bloqueo concreto restante

AGENTS.md establece «Generar código sin spec aprobado para el dominio» en NUNCA y exige completar SDD cuando está DRAFT/REVIEW. El contrato F1 de #1008 exige aprobación formal SDD/ADR y revisión jurídica/privacidad/seguridad. La autorización del propietario para continuar ya consta; no se solicita de nuevo. Permanecen pendientes los dictámenes independientes y parámetros de derechos/retención identificados en el expediente revisable.

F0 documental preparado y F1A parcialmente verificada no significan F0 formalmente aprobado ni F1 completo. La siguiente entrega de negocio es F1B, una vez satisfecho ese gate. Merge, despliegue, publicación, RAG y canary siguen sin autorización derivada de esta evidencia.
