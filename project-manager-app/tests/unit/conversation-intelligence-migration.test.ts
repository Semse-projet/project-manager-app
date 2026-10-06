import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Conversation Intelligence · Ola 1 (CI-010, CI-011): la migración "expand" es aditiva, idempotente y coincide con el
// esquema. Pruebas sin base de datos (la aplicación real se verificó en un Postgres embebido y se repite en CI de deploy).

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const NAME = "20261006180000_conversation_intelligence_expand";
const sql = readFileSync(resolve(ROOT, "packages/db/prisma/migrations", NAME, "migration.sql"), "utf8");
const code = sql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
const schema = readFileSync(resolve(ROOT, "packages/db/prisma/schema.prisma"), "utf8");
const communication = schema.slice(schema.indexOf("model Communication {"), schema.indexOf("}", schema.indexOf("model Communication {")));

test("la migración es aditiva: no borra, no actualiza filas ni elimina objetos", () => {
  assert.equal(/\bDROP\b|\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b|\bINSERT\b|\bRENAME\b|\bSET NOT NULL\b/i.test(code), false);
  assert.equal(/CREATE TABLE/i.test(code), false, "sin tablas nuevas: no se crea una familia paralela de mensajes");
});

test("la migración es idempotente: todo con IF NOT EXISTS (las migraciones fantasma de este repo hacen que reaplicar deba ser seguro)", () => {
  const addColumns = code.match(/ADD COLUMN[^,;]*/g) ?? [];
  assert.equal(addColumns.length, 3, "sequence, occurredAt, contentHash");
  for (const col of addColumns) assert.match(col, /ADD COLUMN IF NOT EXISTS/, col);
  for (const stmt of code.match(/CREATE (UNIQUE )?INDEX[^;]*;/g) ?? []) assert.match(stmt, /CREATE (UNIQUE )?INDEX IF NOT EXISTS/, stmt);
});

test("las columnas son NULABLES (el código anterior las ignora) y tienen los tipos de la spec", () => {
  assert.match(code, /"sequence" INTEGER(?!\s+NOT NULL)/);
  assert.match(code, /"occurredAt" TIMESTAMP\(3\)(?!\s+NOT NULL)/);
  assert.match(code, /"contentHash" TEXT(?!\s+NOT NULL)/);
  assert.equal(/NOT NULL|DEFAULT/i.test(code), false, "sin NOT NULL ni DEFAULT: no reescribe la tabla");
});

test("el esquema declara lo mismo que la migración (sin deriva)", () => {
  assert.match(communication, /sequence\s+Int\?/);
  assert.match(communication, /occurredAt\s+DateTime\?/);
  assert.match(communication, /contentHash\s+String\?/);
  assert.match(communication, /@@index\(\[tenantId, threadId, sequence\]\)/, "índice (tenantId, threadId, sequence) de la spec §7");
  assert.match(code, /"Communication_tenantId_threadId_sequence_idx" ON "Communication"\("tenantId", "threadId", "sequence"\)/);
});

test("no se creó un modelo paralelo de mensajes (spec §7: «no crear tabla paralela de mensajes»)", () => {
  assert.equal(/model ConversationMessage\b/.test(schema), false);
});
