-- Migration: project_draft_budget_decimal
-- Converts ProjectDraft.budgetMin/Max from Float to Decimal(12,2).
-- Float is unsuitable for monetary values; Decimal avoids IEEE-754 rounding errors.
-- Existing non-null values are preserved with two-decimal precision.

ALTER TABLE "ProjectDraft"
  ALTER COLUMN "budgetMin" TYPE DECIMAL(12,2) USING "budgetMin"::DECIMAL(12,2),
  ALTER COLUMN "budgetMax" TYPE DECIMAL(12,2) USING "budgetMax"::DECIMAL(12,2);
