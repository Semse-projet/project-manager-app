-- =============================================================================
-- Q2 — Auditoría de datos históricos para calibrar el motor de costos
-- Spec: docs/specs/api/cost-engine.spec.md · Expediente: cost-engine.decisions.md (Q2)
-- Nota de revisión: docs/specs/api/cost-engine.q2-data-audit.md
--
-- BORRADOR PARA REVISIÓN. NO EJECUTAR EN PRODUCCIÓN sin autorización escrita del
-- responsable de datos, seguridad/privacidad y el DBA.
-- SOLO LECTURA. La salida son CONTEOS AGREGADOS: no incluye identificadores de
-- personas, organizaciones, trabajos, correos, direcciones ni texto libre.
-- La sintaxis NO se ha validado contra una base de datos real.
-- Este borrador es POR TENANT, no por Org: ProjectIntake carece de orgId.
-- Aun con supresión primaria por métrica, NO tiene supresión complementaria.
-- Ninguna salida debe divulgarse sin revisión de inferencia y aprobación de privacidad.
-- TimeEntry no se cuenta como costo real: su tarifa no distingue pago/facturación. Primer paso de la
-- revisión: ejecutar EXPLAIN y la consulta sobre una copia restaurada o una réplica
-- de solo lectura, nunca sobre el primario.
--
-- Uso (psql):
--   psql -v tenant_id='<tenant-id>' -v min_cell=5 -v detail_level=summary -f cost-engine.q2-data-audit.sql
--     tenant_id='<id>'    TENANT explícito obligatorio; NO es una organización
--     tenant_id=''        PROHIBIDO: no devuelve filas; no permite acceso global
--     detail_level        summary por defecto; detail solo tras revisión de privacidad
--     min_cell            tamaño mínimo de celda antes de suprimir el conteo (PROPUESTA 5; la fija privacidad)
--
-- Nombres: Prisma sin @@map => tablas y columnas con comillas dobles y camelCase.
-- Cadena de unión: ProjectIntake."publishedJobId" -> Job.id (sin llave foránea declarada)
--   -> Project."jobId", Contract."jobId", Bid."jobId", PaymentEscrow."jobId".
-- Aislamiento: toda unión exige el mismo "tenantId" que el intake; Contract,
--   PaymentEscrow y PaymentTxn no tienen "tenantId" propio y se alcanzan SOLO a
--   través de Job.
-- =============================================================================

\set ON_ERROR_STOP on
\if :{?detail_level}
\else
  \set detail_level summary
\endif

BEGIN TRANSACTION READ ONLY;
-- Límites operativos PROPUESTOS (los ajusta el DBA):
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '120s';

-- -----------------------------------------------------------------------------
-- Q0 — Sonda de estructura: claves de primer nivel de Contract."termsJson".
-- Solo nombres de clave y conteos; NO lee valores. Sirve para confirmar si el
-- precio acordado vive en "totalAmount" antes de fiarse de la consulta principal.
-- -----------------------------------------------------------------------------
SELECT k AS terms_key, count(*) AS contracts
FROM "Contract" c
JOIN "Job" j ON j.id = c."jobId" AND j."deletedAt" IS NULL
CROSS JOIN LATERAL jsonb_object_keys(
  CASE WHEN jsonb_typeof(c."termsJson"::jsonb) = 'object' THEN c."termsJson"::jsonb ELSE '{}'::jsonb END
) AS k
WHERE c."deletedAt" IS NULL
  AND j."tenantId" = NULLIF(:'tenant_id', '')
GROUP BY k
ORDER BY contracts DESC;

-- -----------------------------------------------------------------------------
-- Consulta principal: embudo de datos y celdas de calibración.
-- -----------------------------------------------------------------------------
WITH
params AS (
  SELECT NULLIF(:'tenant_id', '')::text AS tenant_id,
         (:'min_cell')::int            AS min_cell,
         :'detail_level'::text         AS detail_level
),
states(code) AS (
  VALUES ('AL'),('AK'),('AZ'),('AR'),('CA'),('CO'),('CT'),('DE'),('DC'),('FL'),('GA'),('HI'),
         ('ID'),('IL'),('IN'),('IA'),('KS'),('KY'),('LA'),('ME'),('MD'),('MA'),('MI'),('MN'),
         ('MS'),('MO'),('MT'),('NE'),('NV'),('NH'),('NJ'),('NM'),('NY'),('NC'),('ND'),('OH'),
         ('OK'),('OR'),('PA'),('RI'),('SC'),('SD'),('TN'),('TX'),('UT'),('VT'),('VA'),('WA'),
         ('WV'),('WI'),('WY')
),
-- 1) Un renglón por intake. La región se reduce a un código de estado válido; el texto
--    libre de la ciudad NO sale de esta consulta.
base AS (
  SELECT
    pi.id,
    pi."tenantId",
    pi."detectedCategory"                                   AS category,
    date_trunc('quarter', pi."createdAt")::date             AS quarter,
    pi."publishedJobId",
    (regexp_match(upper(coalesce(pi.city, '')),
                  '(?:,|\s)\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$'))[1] AS state_from_intake,
    (pi."generatedEstimateJson" IS NOT NULL)                AS has_estimate_json,
    (    (pi."generatedEstimateJson" #>> '{totalRange,min}')      ~ '^[0-9]+(\.[0-9]+)?$'
     AND (pi."generatedEstimateJson" #>> '{totalRange,max}')      ~ '^[0-9]+(\.[0-9]+)?$'
     AND (pi."generatedEstimateJson" #>> '{totalRange,currency}') = 'USD')   AS has_estimate
  FROM "ProjectIntake" pi
  CROSS JOIN params p
  WHERE pi."tenantId" = p.tenant_id
),
-- 2) Trabajo asociado, precio acordado, pagos liberados y evidencia de costo real.
facts AS (
  SELECT
    b.id, b.category, b.quarter, b.has_estimate_json, b.has_estimate, b."publishedJobId",
    j.id                       AS job_id,
    j.status::text             AS job_status,
    pr.status::text            AS project_status,
    coalesce(st_i.code, st_j.code, 'UNRESOLVED') AS state,
    (c.id IS NOT NULL)         AS has_contract,
    CASE WHEN c."termsJson" ->> 'totalAmount' ~ '^[0-9]+(\.[0-9]+)?$'
         THEN (c."termsJson" ->> 'totalAmount')::numeric END         AS contract_total,
    bid.amount                 AS accepted_bid_amount,
    rel.released               AS released_to_pro,
    coalesce(ex.n_materials_usd, 0) AS n_materials_usd,
    coalesce(ex.n_labor_usd, 0)     AS n_labor_usd,
    coalesce(ex.n_any_usd, 0)       AS n_expense_usd,
    coalesce(ex.n_nonusd, 0)        AS n_expense_nonusd,
    coalesce(te.n_time_usd, 0)      AS n_time_usd,
    coalesce(te.n_time_nonusd, 0)   AS n_time_nonusd
  FROM base b
  LEFT JOIN states st_i ON st_i.code = b.state_from_intake
  LEFT JOIN "Job" j
         ON j.id = b."publishedJobId"
        AND j."tenantId" = b."tenantId"
        AND j."deletedAt" IS NULL
  LEFT JOIN states st_j
         ON st_j.code = (regexp_match(upper(coalesce(j.location, '')),
                         '(?:,|\s)\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$'))[1]
  LEFT JOIN "Project" pr ON pr."jobId" = j.id AND pr."tenantId" = j."tenantId"
  LEFT JOIN "Contract" c ON c."jobId" = j.id AND c."deletedAt" IS NULL
  LEFT JOIN LATERAL (
    SELECT max(bd.amount) AS amount
    FROM "Bid" bd
    WHERE bd."jobId" = j.id AND bd.status = 'ACCEPTED'
  ) bid ON true
  -- Lo LIBERADO del escrow es un pago al profesional, NO el costo real del trabajo.
  LEFT JOIN LATERAL (
    SELECT sum(t.amount) AS released
    FROM "PaymentEscrow" es
    JOIN "PaymentTxn" t ON t."escrowId" = es.id
    WHERE es."jobId" = j.id AND es."deletedAt" IS NULL
      AND t.type = 'RELEASE' AND t.status = 'SUCCEEDED'
  ) rel ON true
  -- Evidencia de costo real 1: gastos aprobados (no duplicados). Solo USD cuenta como evidencia.
  -- Aviso de rendimiento: ProjectExpense no tiene índice por "jobId"; el OR puede degradar el plan.
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE e.category = 'materials' AND e.currency = 'USD') AS n_materials_usd,
      count(*) FILTER (WHERE e.category = 'labor'     AND e.currency = 'USD') AS n_labor_usd,
      count(*) FILTER (WHERE e.currency = 'USD')                              AS n_any_usd,
      count(*) FILTER (WHERE e.currency <> 'USD')                             AS n_nonusd
    FROM "ProjectExpense" e
    WHERE e."tenantId" = j."tenantId"
      AND (e."projectId" = pr.id OR e."jobId" = j.id)
      AND e.status IN ('approved', 'reimbursed')
      AND e."isDuplicate" = false
  ) ex ON true
  -- Evidencia de costo real 2: horas aprobadas con tarifa. TimeEntry.currency tiene
  -- default 'MXN' y "hourlyRate" no distingue tarifa pagada de tarifa facturada: ver nota §6.
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE t.currency = 'USD') AS n_time_usd,
      count(*) FILTER (WHERE t.currency <> 'USD') AS n_time_nonusd
    FROM "TimeEntry" t
    WHERE t."tenantId" = j."tenantId" AND t."jobId" = j.id
      AND t.status IN ('completed', 'approved')
      AND t."hourlyRate" IS NOT NULL AND t."durationMinutes" IS NOT NULL
  ) te ON true
),
-- 3) Banderas acumulativas. TERMINADO != DATOS ECONÓMICOS COMPLETOS.
flags AS (
  SELECT f.*,
    (f.job_id IS NOT NULL)                                               AS has_job,
    (f.job_status = 'COMPLETED' OR f.project_status = 'COMPLETED')       AS finished,
    (f.contract_total IS NOT NULL OR f.accepted_bid_amount IS NOT NULL)  AS has_agreed_price,
    (coalesce(f.released_to_pro, 0) > 0)                                 AS has_release,
    (f.n_expense_usd > 0)                                                    AS cost_loose,
    (f.n_materials_usd > 0 AND f.n_labor_usd > 0)                        AS cost_strict
  FROM facts f
),
tiers AS (
  SELECT fl.*,
    fl.has_estimate                                                      AS t_estimated,
    (fl.has_estimate AND fl.has_job)                                     AS t_published,
    (fl.has_estimate AND fl.has_job AND fl.finished)                     AS t_finished,
    (fl.has_estimate AND fl.has_job AND fl.finished AND fl.has_agreed_price) AS t_priced,
    -- Solo hay pagos liberados, sin gasto ni horas aprobadas: NO sirve para calibrar costo.
    (fl.has_estimate AND fl.has_job AND fl.finished AND fl.has_agreed_price
       AND fl.has_release AND NOT fl.cost_loose)                         AS t_payment_only,
    (fl.has_estimate AND fl.has_job AND fl.finished AND fl.has_agreed_price
       AND fl.cost_loose)                                                AS t_cost_loose,
    (fl.has_estimate AND fl.has_job AND fl.finished AND fl.has_agreed_price
       AND fl.cost_strict)                                               AS t_cost_strict
  FROM flags fl
),
agg AS (
  SELECT
    GROUPING(category, state, quarter) AS g,
    category, state, quarter,
    count(*)                                     AS intakes,
    count(*) FILTER (WHERE t_estimated)          AS estimated,
    count(*) FILTER (WHERE t_published)          AS published,
    count(*) FILTER (WHERE t_finished)           AS finished,
    count(*) FILTER (WHERE t_priced)             AS finished_with_agreed_price,
    count(*) FILTER (WHERE t_payment_only)       AS payment_evidence_only,
    count(*) FILTER (WHERE t_cost_loose)         AS cost_evidence_loose,
    count(*) FILTER (WHERE t_cost_strict)        AS cost_evidence_strict,
    -- Diagnósticos de calidad de datos:
    count(*) FILTER (WHERE has_estimate_json AND NOT coalesce(has_estimate, false))                    AS dq_estimate_json_unusable,
    count(*) FILTER (WHERE "publishedJobId" IS NOT NULL AND job_id IS NULL)           AS dq_published_job_not_found,
    count(*) FILTER (WHERE has_job AND has_contract AND contract_total IS NULL)       AS dq_contract_without_total,
    count(*) FILTER (WHERE finished AND NOT has_agreed_price)                         AS dq_finished_without_price,
    count(*) FILTER (WHERE n_expense_nonusd > 0 OR n_time_nonusd > 0)                 AS dq_non_usd_cost_records,
    count(*) FILTER (WHERE state = 'UNRESOLVED')                                      AS dq_region_unresolved
  FROM tiers
  GROUP BY GROUPING SETS (
    (),                       -- total
    (category),               -- por categoría
    (state),                  -- por estado
    (quarter),                -- por trimestre de creación del intake
    (category, state)         -- celda de calibración
  )
)
SELECT
  CASE a.g WHEN 7 THEN '1_total'
           WHEN 3 THEN '2_por_categoria'
           WHEN 5 THEN '3_por_estado'
           WHEN 6 THEN '4_por_trimestre'
           WHEN 1 THEN '5_categoria_x_estado' END AS dimension,
  a.category, a.state, a.quarter,
  -- Supresión de celdas pequeñas (protección de datos). OJO: no hay supresión
  -- complementaria; ver nota §7 antes de publicar resultados por categoría y estado.
  CASE WHEN a.intakes BETWEEN 1 AND p.min_cell - 1 THEN NULL ELSE a.intakes END                    AS intakes,
  CASE WHEN (a.intakes BETWEEN 1 AND p.min_cell - 1 OR a.estimated BETWEEN 1 AND p.min_cell - 1) THEN NULL ELSE a.estimated END                  AS estimated,
  CASE WHEN (a.intakes BETWEEN 1 AND p.min_cell - 1 OR a.published BETWEEN 1 AND p.min_cell - 1) THEN NULL ELSE a.published END                  AS published,
  CASE WHEN (a.intakes BETWEEN 1 AND p.min_cell - 1 OR a.finished BETWEEN 1 AND p.min_cell - 1) THEN NULL ELSE a.finished END                   AS finished,
  CASE WHEN (a.intakes BETWEEN 1 AND p.min_cell - 1 OR a.finished_with_agreed_price BETWEEN 1 AND p.min_cell - 1) THEN NULL ELSE a.finished_with_agreed_price END AS finished_with_agreed_price,
  CASE WHEN (a.intakes BETWEEN 1 AND p.min_cell - 1 OR a.payment_evidence_only BETWEEN 1 AND p.min_cell - 1) THEN NULL ELSE a.payment_evidence_only END      AS payment_evidence_only,
  CASE WHEN (a.intakes BETWEEN 1 AND p.min_cell - 1 OR a.cost_evidence_loose BETWEEN 1 AND p.min_cell - 1) THEN NULL ELSE a.cost_evidence_loose END        AS cost_evidence_loose,
  CASE WHEN (a.intakes BETWEEN 1 AND p.min_cell - 1 OR a.cost_evidence_strict BETWEEN 1 AND p.min_cell - 1) THEN NULL ELSE a.cost_evidence_strict END       AS cost_evidence_strict,
  CASE WHEN (a.intakes BETWEEN 1 AND p.min_cell - 1 OR a.dq_estimate_json_unusable BETWEEN 1 AND p.min_cell - 1) THEN NULL ELSE a.dq_estimate_json_unusable END  AS dq_estimate_json_unusable,
  CASE WHEN (a.intakes BETWEEN 1 AND p.min_cell - 1 OR a.dq_published_job_not_found BETWEEN 1 AND p.min_cell - 1) THEN NULL ELSE a.dq_published_job_not_found END AS dq_published_job_not_found,
  CASE WHEN (a.intakes BETWEEN 1 AND p.min_cell - 1 OR a.dq_contract_without_total BETWEEN 1 AND p.min_cell - 1) THEN NULL ELSE a.dq_contract_without_total END  AS dq_contract_without_total,
  CASE WHEN (a.intakes BETWEEN 1 AND p.min_cell - 1 OR a.dq_finished_without_price BETWEEN 1 AND p.min_cell - 1) THEN NULL ELSE a.dq_finished_without_price END  AS dq_finished_without_price,
  CASE WHEN (a.intakes BETWEEN 1 AND p.min_cell - 1 OR a.dq_non_usd_cost_records BETWEEN 1 AND p.min_cell - 1) THEN NULL ELSE a.dq_non_usd_cost_records END    AS dq_non_usd_cost_records,
  CASE WHEN (a.intakes BETWEEN 1 AND p.min_cell - 1 OR a.dq_region_unresolved BETWEEN 1 AND p.min_cell - 1) THEN NULL ELSE a.dq_region_unresolved END       AS dq_region_unresolved,
  (a.intakes BETWEEN 1 AND p.min_cell - 1)                                                          AS cell_suppressed
FROM agg a
CROSS JOIN params p
WHERE p.tenant_id IS NOT NULL
  AND p.min_cell >= 2
  AND p.detail_level IN ('summary','detail')
  AND (p.detail_level = 'detail' OR a.g = 7)
ORDER BY dimension, a.category NULLS FIRST, a.state NULLS FIRST, a.quarter NULLS FIRST;

COMMIT;
