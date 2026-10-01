import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyGroup, validateApplyOptions, parseArgs, DEFAULT_MAX_ROWS } from "../../scripts/maintenance/dedup-lib.mjs";

test("pre-migrate no contiene DELETE sobre tablas de negocio ni runDedup", () => {
  const src = readFileSync(new URL("../../scripts/pre-migrate.mjs", import.meta.url), "utf8");
  assert.ok(!/runDedup/.test(src));
  const deletes = [...src.matchAll(/DELETE FROM\s+"?(\w+)"?/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(deletes)], ["_prisma_migrations"]);
});

test("canonica: la unica fila con dependientes, aunque su id sea mayor", () => {
  const r = classifyGroup([
    { id: "a", createdAt: "2026-01-01", refCount: 0 },
    { id: "z", createdAt: "2026-02-01", refCount: 3 },
  ]);
  assert.equal(r.status, "ok");
  assert.equal(r.canonicalId, "z");
  assert.deepEqual(r.deleteIds, ["a"]);
});

test("sin dependientes: la mas antigua por createdAt, no por id", () => {
  const r = classifyGroup([
    { id: "a", createdAt: "2026-03-01", refCount: 0 },
    { id: "z", createdAt: "2026-01-01", refCount: 0 },
  ]);
  assert.equal(r.canonicalId, "z");
  assert.deepEqual(r.deleteIds, ["a"]);
});

test("hijos en mas de una fila => bloqueado", () => {
  const r = classifyGroup([
    { id: "a", createdAt: "2026-01-01", refCount: 1 },
    { id: "b", createdAt: "2026-01-02", refCount: 2 },
  ]);
  assert.equal(r.status, "blocked");
  assert.deepEqual(r.deleteIds, []);
});

test("empate, sin createdAt o FK no verificable => bloqueado", () => {
  assert.equal(classifyGroup([{ id: "a", createdAt: "2026-01-01", refCount: 0 }, { id: "b", createdAt: "2026-01-01", refCount: 0 }]).status, "blocked");
  assert.equal(classifyGroup([{ id: "a", refCount: 0 }, { id: "b", refCount: 0 }]).status, "blocked");
  assert.equal(classifyGroup([{ id: "a", createdAt: "2026-01-01", refCount: 0, unverifiableRefs: true }, { id: "b", createdAt: "2026-01-02", refCount: 0 }]).status, "blocked");
});

test("dry-run por defecto; --apply exige evidencia de backup y confirmacion", () => {
  assert.equal(parseArgs([]).apply, false);
  assert.equal(parseArgs([]).maxRows, DEFAULT_MAX_ROWS);
  assert.deepEqual(validateApplyOptions({ apply: false }, {}), []);
  assert.equal(validateApplyOptions({ apply: true, backupEvidence: null, maxRows: 50 }, {}).length, 2);
  assert.deepEqual(
    validateApplyOptions({ apply: true, backupEvidence: "restore-drill-2026-10-01", maxRows: 50 }, { DEDUP_APPLY_CONFIRM: "I_HAVE_A_VERIFIED_BACKUP" }),
    [],
  );
  assert.throws(() => parseArgs(["--wat"]));
});
