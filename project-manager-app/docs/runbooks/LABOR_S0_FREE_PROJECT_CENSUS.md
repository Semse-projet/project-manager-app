# Runbook — censo de sólo lectura de FreeProject (S0, D6)

**Spec:** [`labor.free-project-mutation-guard`](../specs/labor/free-project-mutation-guard.spec.md) §7 y §14 (D6).
**Objetivo:** medir, sin tocar datos, cuántos FreeProject quedaron en estados
que el hueco de S0 permitía escribir antes del guard.
**Ejecuta:** un operador autorizado por el owner, con un rol de base de datos
de **sólo lectura**. Un agente sin ese acceso no lo ejecuta.

## Reglas (condiciones aprobadas por el owner)

- Sólo lectura: transacción `READ ONLY` y `ROLLBACK` al final. Ningún
  `UPDATE`, `DELETE`, `INSERT` ni DDL.
- Sólo conteos agregados. No se exportan ids, nombres, ubicaciones,
  coordenadas, descripciones ni usuarios.
- Un conteo distinto de cero **no es evidencia de abuso** ni se atribuye a
  personas: sin AuditLog previo a S0 no se puede saber quién ni por qué
  escribió cada fila.
- No se modifican ni "corrigen" filas a partir del censo. Cualquier
  remediación de datos necesita su propio spec y aprobación.
- No se copian credenciales ni la cadena de conexión en tickets, logs o
  reportes.

## Consulta

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';

SELECT
  count(*)                                                        AS free_projects_total,
  count(*) FILTER (WHERE fp.status = 'converted')                 AS convertidos_total,

  -- Informativo, NO es anomalía: archivar un proyecto convertido conserva
  -- su convertedJobId como referencia histórica (contrato de S0).
  count(*) FILTER (WHERE fp.status = 'archived'
                     AND fp."convertedJobId" IS NOT NULL)         AS archivados_con_referencia_historica,

  -- Convertido sin referencia (no debería existir).
  count(*) FILTER (WHERE fp.status = 'converted'
                     AND fp."convertedJobId" IS NULL)             AS convertido_sin_referencia,

  -- Las tres categorías siguientes revisan toda referencia histórica:
  -- proyectos convertidos y proyectos archivados después de convertir.

  -- Referencia inexistente: convertedJobId no corresponde a ningún Job.
  count(*) FILTER (WHERE fp.status IN ('converted', 'archived')
                     AND fp."convertedJobId" IS NOT NULL
                     AND j.id IS NULL)                            AS referencia_inexistente,

  -- Inconsistencia de tenant: el Job existe pero en otro tenant.
  count(*) FILTER (WHERE fp.status IN ('converted', 'archived')
                     AND fp."convertedJobId" IS NOT NULL
                     AND j.id IS NOT NULL
                     AND j."tenantId" <> fp."tenantId")           AS tenant_inconsistente,

  -- Job eliminado (soft delete), mismo tenant. Puede haberse borrado
  -- después de una conversión legítima: no indica uso indebido por sí solo
  -- y no cuenta en tenants_con_alguna_anomalia.
  count(*) FILTER (WHERE fp.status IN ('converted', 'archived')
                     AND fp."convertedJobId" IS NOT NULL
                     AND j.id IS NOT NULL
                     AND j."tenantId" = fp."tenantId"
                     AND j."deletedAt" IS NOT NULL)               AS job_eliminado,

  -- Referencia en un proyecto ACTIVO: sólo posible si se "restauró" con
  -- PATCH status después de convertir (hueco cerrado por S0, D2).
  count(*) FILTER (WHERE fp.status = 'active'
                     AND fp."convertedJobId" IS NOT NULL)         AS referencia_en_activo,

  -- Valores de status fuera del dominio active|archived|converted.
  count(*) FILTER (WHERE fp.status NOT IN ('active', 'archived', 'converted'))
                                                                  AS status_fuera_de_dominio,

  -- Cuántos tenants distintos tienen al menos una anomalía (sin listarlos).
  -- Excluye las referencias históricas válidas y los Jobs eliminados.
  count(DISTINCT fp."tenantId") FILTER (
    WHERE (fp.status = 'converted' AND fp."convertedJobId" IS NULL)
       OR (fp.status IN ('converted', 'archived') AND fp."convertedJobId" IS NOT NULL
           AND (j.id IS NULL OR j."tenantId" <> fp."tenantId"))
       OR (fp.status = 'active' AND fp."convertedJobId" IS NOT NULL)
       OR fp.status NOT IN ('active', 'archived', 'converted')
  )                                                               AS tenants_con_alguna_anomalia
FROM "FreeProject" fp
LEFT JOIN "Job" j ON j.id = fp."convertedJobId";

ROLLBACK;
```

## Qué no mide

- **Archivados por terceros:** archivar no deja rastro antes de S0; no se
  puede distinguir un archivado propio de uno ajeno.
- **Conversión a un Job del mismo tenant no asignado al creador:** exigiría
  replicar `jobAssignmentWhere` en SQL y la asignación pudo cambiar después
  de convertir, así que el resultado no sería atribuible. Queda fuera.
- **Ediciones de nombre/ubicación por terceros:** no hay historial previo.

## Registro del resultado

Anotar en el reporte de implementación de S0 (`docs/reportes/`) sólo:
fecha/hora UTC, entorno, SHA desplegado de `semse-API`, rol usado (sin
credenciales) y la fila de conteos. Si no se ejecuta, registrar
`NOT_EXECUTED` y el motivo.
