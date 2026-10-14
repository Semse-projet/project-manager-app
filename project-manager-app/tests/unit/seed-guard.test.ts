import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertSeedAllowed, evaluateSeedGuard } from "../../packages/db/prisma/seed-guard.ts";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");
const LOCAL_DB = "postgresql://user:secret@localhost:5433/semse";
const REMOTE_DB = "postgresql://user:secret@db.example.internal:5432/semse";

test("seed is allowed against a local database in development", () => {
  assert.deepEqual(evaluateSeedGuard({ NODE_ENV: "development", DATABASE_URL: LOCAL_DB }), { allowed: true });
  assert.deepEqual(evaluateSeedGuard({ DATABASE_URL: "postgresql://u:p@127.0.0.1:5433/semse" }), { allowed: true });
  assert.deepEqual(evaluateSeedGuard({ DATABASE_URL: "postgresql://u:p@[::1]:5433/semse" }), { allowed: true });
});

test("NODE_ENV=production is refused, whatever the database or overrides", () => {
  for (const value of ["production", "PRODUCTION", " production "]) {
    const result = evaluateSeedGuard({ NODE_ENV: value, DATABASE_URL: LOCAL_DB, SEMSE_SEED_ALLOW_REMOTE_DB: "true" });
    assert.equal(result.allowed, false);
  }
});

test("a Railway production environment is refused even when NODE_ENV is unset (railway run case)", () => {
  for (const name of ["RAILWAY_ENVIRONMENT_NAME", "RAILWAY_ENVIRONMENT"]) {
    const result = evaluateSeedGuard({ [name]: "production", DATABASE_URL: REMOTE_DB, SEMSE_SEED_ALLOW_REMOTE_DB: "true" });
    assert.equal(result.allowed, false);
  }
  assert.equal(evaluateSeedGuard({ RAILWAY_ENVIRONMENT_NAME: "Prod-EU", DATABASE_URL: LOCAL_DB }).allowed, false);
});

test("a non-local database needs an explicit opt-in, which never lifts the production rules", () => {
  assert.equal(evaluateSeedGuard({ DATABASE_URL: REMOTE_DB }).allowed, false);
  assert.equal(evaluateSeedGuard({ DATABASE_URL: REMOTE_DB, SEMSE_SEED_ALLOW_REMOTE_DB: "yes" }).allowed, false);
  assert.deepEqual(
    evaluateSeedGuard({ NODE_ENV: "development", RAILWAY_ENVIRONMENT_NAME: "staging", DATABASE_URL: REMOTE_DB, SEMSE_SEED_ALLOW_REMOTE_DB: "true" }),
    { allowed: true },
  );
});

test("an unparseable DATABASE_URL fails closed", () => {
  assert.equal(evaluateSeedGuard({ DATABASE_URL: "not a url" }).allowed, false);
});

test("the refusal message never leaks credentials from DATABASE_URL", () => {
  assert.throws(
    () => assertSeedAllowed({ DATABASE_URL: REMOTE_DB }),
    (error: unknown) => {
      const message = String((error as Error).message);
      return message.includes("db.example.internal") && !message.includes("secret") && !message.includes("user:");
    },
  );
  assert.doesNotThrow(() => assertSeedAllowed({ NODE_ENV: "test", DATABASE_URL: LOCAL_DB }));
});

test("seed.ts calls the guard before creating the Prisma client", () => {
  const seed = fs.readFileSync(path.join(repoRoot, "packages/db/prisma/seed.ts"), "utf8");
  const guard = seed.indexOf("assertSeedAllowed(process.env)");
  const client = seed.indexOf("new PrismaClient()");
  assert.ok(guard > 0, "seed.ts must call assertSeedAllowed(process.env)");
  assert.ok(client > guard, "the guard must run before new PrismaClient()");
});

test("prisma:reset runs the guard before dropping the database", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "packages/db/package.json"), "utf8"));
  const reset: string = pkg.scripts["prisma:reset"];
  assert.ok(reset.indexOf("assert-seed-allowed") >= 0);
  assert.ok(reset.indexOf("assert-seed-allowed") < reset.indexOf("migrate reset"));
});

test("DEPLOY.md no longer instructs operators to seed production", () => {
  const deploy = fs.readFileSync(path.join(repoRoot, "infra/railway/DEPLOY.md"), "utf8");
  assert.ok(!/Run this once after Postgres is ready/i.test(deploy));
  assert.match(deploy, /Do not run `db:seed` against the production database/);
});
