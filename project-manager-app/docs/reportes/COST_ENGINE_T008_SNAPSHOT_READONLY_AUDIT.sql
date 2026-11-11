-- SEMSE T-008 / T-008b — MaterialPriceSnapshot current-state audit.
-- Aggregate output only; NO mutations. Run with a PostgreSQL read-only role.
-- Source: Prisma model MaterialPriceSnapshot. Tested against schema names in #1075.
-- IMPORTANT: A row with index=100 and price=base may be LEGITIMATE; it is NOT proof of fallback.
-- Past overwrites are not reconstructible from the current-state cache alone.

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

-- Q1: current snapshot inventory and data-quality indicators.
SELECT
  COUNT(*)::bigint AS snapshot_count,
  COUNT(*) FILTER (WHERE "source" = 'BLS_PPI')::bigint AS labeled_bls_ppi,
  COUNT(*) FILTER (WHERE "source" IS NULL OR BTRIM("source") = '')::bigint AS source_missing,
  COUNT(*) FILTER (WHERE "pricePerUnit" <= 0)::bigint AS non_positive_prices,
  COUNT(*) FILTER (WHERE "source" = 'BLS_PPI'
       AND ("indexValue" IS NULL OR "indexValue" <= 0))::bigint AS bls_missing_or_invalid_index,
  COUNT(*) FILTER (WHERE "source" = 'BLS_PPI'
       AND ("blsSeriesId" IS NULL OR BTRIM("blsSeriesId") = ''))::bigint AS bls_series_missing,
  COUNT(*) FILTER (WHERE "source" = 'BLS_PPI'
       AND "indexValue" = 100 AND "basePrice" IS NOT NULL
       AND "pricePerUnit" = "basePrice")::bigint AS possible_fallback_not_proven,
  COUNT(*) FILTER (WHERE "validUntil" <= NOW())::bigint AS expired,
  COUNT(*) FILTER (WHERE "validUntil" > NOW())::bigint AS currently_valid_ttl,
  COUNT(*) FILTER (WHERE "validUntil" <= "fetchedAt")::bigint AS inconsistent_ttl,
  COUNT(*) FILTER (WHERE "fetchedAt" > NOW() + INTERVAL '5 minutes')::bigint AS future_fetch_timestamp
FROM "MaterialPriceSnapshot";

-- Q2: source distribution and the date of the latest fetch by source.
SELECT
  "source",
  COUNT(*)::bigint AS rows,
  MIN("fetchedAt") AS oldest_fetch,
  MAX("fetchedAt") AS latest_fetch,
  COUNT(*) FILTER (WHERE "validUntil" > NOW())::bigint AS current_ttl,
  COUNT(*) FILTER (WHERE "indexValue" = 100 AND "basePrice" IS NOT NULL
    AND "pricePerUnit" = "basePrice")::bigint AS index100_price_equals_base_not_proof
FROM "MaterialPriceSnapshot"
GROUP BY "source"
ORDER BY "source";

-- Q3: group changes over recent days. A current-state snapshot CANNOT recover overwritten values.
SELECT
  DATE_TRUNC('day', "updatedAt")::date AS updated_day_utc_session_timezone,
  "source",
  COUNT(*)::bigint AS current_rows_updated_that_day,
  COUNT(*) FILTER (WHERE "validUntil" > NOW())::bigint AS presently_valid
FROM "MaterialPriceSnapshot"
WHERE "updatedAt" >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

COMMIT;
