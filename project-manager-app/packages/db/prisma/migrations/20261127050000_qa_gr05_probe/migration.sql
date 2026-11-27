-- QA ONLY (rama qa/release-gate, prueba G-R05). Migración aditiva sintética.
-- No debe llegar a main.
CREATE TABLE IF NOT EXISTS "qa_gr05_probe" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "qa_gr05_probe" ("id") VALUES ('gr05-baseline') ON CONFLICT DO NOTHING;
