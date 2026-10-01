-- C39: catálogo GLOBAL de precios de modelos de IA versionado (spec docs/specs/prometeo/ai-pricing-catalog.spec.md).
-- Migración ADITIVA: 1 tabla nueva + 2 columnas nullable en "AiInteractionLog". Sin backfill, sin tocar datos.
-- "AiModelPrice" NO tiene tenantId: excepción a la regla general autorizada por el dueño (2026-10-01, D1).
--
-- ROLLBACK OPERATIVO: AI_PRICING_CATALOG_MODE=off (no destruye el historial de costos). Retirar el esquema NO es un
-- rollback: solo con una migración posterior, con respaldo/exportación del historial y decisión explícita del dueño
-- (los "priceId" de los logs dejarían de ser reconstruibles). SQL de retirada, solo con esa autorización:
--   ALTER TABLE "AiInteractionLog" DROP CONSTRAINT "AiInteractionLog_priceId_fkey";
--   DROP INDEX "AiInteractionLog_priceId_idx";
--   ALTER TABLE "AiInteractionLog" DROP COLUMN "priceId", DROP COLUMN "costBasis";
--   DROP TABLE "AiModelPrice"; DROP FUNCTION "ai_model_price_immutable"();
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20261001100000_c39_ai_model_price_catalog';

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateTable
CREATE TABLE "AiModelPrice" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelSlug" TEXT NOT NULL,
    "providerModelName" TEXT NOT NULL,
    "inputPer1K" DECIMAL(14,8) NOT NULL,
    "outputPer1K" DECIMAL(14,8) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "pricingSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "sourceUrl" TEXT NOT NULL,
    "sourcePublishedAt" TIMESTAMP(3),
    "sourceCheckedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiModelPrice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiModelPrice_currency_usd" CHECK ("currency" = 'USD'),
    CONSTRAINT "AiModelPrice_prices_nonneg" CHECK ("inputPer1K" >= 0 AND "outputPer1K" >= 0),
    CONSTRAINT "AiModelPrice_schema_version_pos" CHECK ("pricingSchemaVersion" >= 1),
    CONSTRAINT "AiModelPrice_interval_valid" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
    CONSTRAINT "AiModelPrice_source_https" CHECK ("sourceUrl" LIKE 'https://%'),
    -- Una sola tarifa por (provider, modelSlug, providerModelName) en cada instante: no basta unicidad de
    -- "effectiveFrom"; se excluyen intervalos que se intersecan (también ante altas concurrentes).
    CONSTRAINT "AiModelPrice_no_overlap" EXCLUDE USING gist (
        "provider" WITH =, "modelSlug" WITH =, "providerModelName" WITH =,
        tsrange("effectiveFrom", "effectiveTo", '[)') WITH &&
    )
);

-- CreateIndex
CREATE INDEX "AiModelPrice_provider_modelSlug_providerModelName_effective_idx"
    ON "AiModelPrice"("provider", "modelSlug", "providerModelName", "effectiveFrom");

-- Inmutabilidad: sin DELETE; el único UPDATE permitido es CERRAR la vigencia abierta (effectiveTo NULL -> valor).
CREATE FUNCTION "ai_model_price_immutable"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AiModelPrice is immutable: DELETE not allowed' USING ERRCODE = '23000';
  END IF;
  IF OLD."effectiveTo" IS NOT NULL
     OR NEW."effectiveTo" IS NULL
     OR (to_jsonb(NEW) - 'effectiveTo') IS DISTINCT FROM (to_jsonb(OLD) - 'effectiveTo') THEN
    RAISE EXCEPTION 'AiModelPrice is immutable: only closing the open interval (effectiveTo) is allowed' USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AiModelPrice_immutable"
    BEFORE UPDATE OR DELETE ON "AiModelPrice"
    FOR EACH ROW EXECUTE FUNCTION "ai_model_price_immutable"();

-- AlterTable (aditivo, nullable): provenance del costo en los logs
ALTER TABLE "AiInteractionLog" ADD COLUMN "priceId" TEXT, ADD COLUMN "costBasis" TEXT;

-- CreateIndex
CREATE INDEX "AiInteractionLog_priceId_idx" ON "AiInteractionLog"("priceId");

-- AddForeignKey
ALTER TABLE "AiInteractionLog" ADD CONSTRAINT "AiInteractionLog_priceId_fkey"
    FOREIGN KEY ("priceId") REFERENCES "AiModelPrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
