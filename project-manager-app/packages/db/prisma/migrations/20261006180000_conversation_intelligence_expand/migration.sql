-- Conversation Intelligence · Ola 1 (spec prometeo.conversation-intelligence, §7 expand/contract: paso 1 "expand").
--
-- Migración ADITIVA e IDEMPOTENTE: tres columnas NULABLES y un índice sobre `Communication`. Sin backfill, sin tocar
-- filas, sin tablas nuevas, sin borrar nada. El código anterior ignora estas columnas.
--
--   sequence    posición original del mensaje en su conversación (null si la fuente no la conserva)
--   occurredAt  instante del mensaje; NULL cuando la fuente no tiene tiempo por mensaje (nunca se inventa)
--   contentHash huella del cuerpo original
--
-- Todo con IF NOT EXISTS: las migraciones fantasma ya vividas en este repo (ver scripts/pre-migrate.mjs) hacen que
-- reaplicar sea seguro. Rollback: poner SEMSE_CONVERSATION_INTELLIGENCE_MODE=off; las columnas quedan inertes
-- (forward-fix, nunca se borran datos canónicos ya escritos).

-- AlterTable
ALTER TABLE "Communication"
    ADD COLUMN IF NOT EXISTS "sequence" INTEGER,
    ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "contentHash" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Communication_tenantId_threadId_sequence_idx" ON "Communication"("tenantId", "threadId", "sequence");
