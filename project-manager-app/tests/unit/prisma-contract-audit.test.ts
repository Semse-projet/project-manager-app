/**
 * Tests del auditor de drift Prisma (scripts/verify-prisma-runtime-contract.mjs).
 *
 * El auditor corre contra una raíz de fixtures (--root) construida en un
 * directorio temporal a partir de tests/fixtures/prisma-contract/base
 * (schema con Job y UserProfile@@map + migración que crea ambas tablas).
 * No requiere base de datos: solo se ejercitan los niveles 1 y 2.
 *
 * Run: node --experimental-strip-types --test tests/unit/prisma-contract-audit.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "verify-prisma-runtime-contract.mjs");
const BASE_FIXTURE = join(REPO_ROOT, "tests", "fixtures", "prisma-contract", "base");

type RunResult = { code: number; output: string };

/** Crea una raíz temporal con el fixture base + el código API indicado. */
function runAuditor(apiSource: string, baseline?: object): RunResult {
  const root = mkdtempSync(join(tmpdir(), "prisma-contract-"));
  try {
    cpSync(BASE_FIXTURE, root, { recursive: true });
    mkdirSync(join(root, "apps", "api", "src"), { recursive: true });
    writeFileSync(join(root, "apps", "api", "src", "sample.service.ts"), apiSource);
    if (baseline) {
      mkdirSync(join(root, "scripts"), { recursive: true });
      writeFileSync(join(root, "scripts", "prisma-contract-baseline.json"), JSON.stringify(baseline));
    }
    try {
      const output = execFileSync(process.execPath, [SCRIPT, "--root", root], { encoding: "utf8" });
      return { code: 0, output };
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      return { code: e.status ?? 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("modelo válido (directo y @@map) pasa sin drift", () => {
  const result = runAuditor(`
    export class S {
      async run() {
        await this.prisma.job.findMany({});
        await this.prisma.userProfile.count({});
      }
    }
  `);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /sin drift detectado/);
});

test("modelo inexistente falla con archivo y línea", () => {
  const result = runAuditor(`
    export class S {
      async run() {
        await this.prisma.ghostModel.findMany({});
      }
    }
  `);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /prisma\.ghostModel/);
  assert.match(result.output, /sample\.service\.ts:4/);
});

test("mención en comentario no cuenta como acceso", () => {
  const result = runAuditor(`
    // pendiente: migrar this.prisma.ghostModel a repositorio
    /* legacy: this.prisma.otherGhost.findMany() */
    export class S {
      async run() {
        await this.prisma.job.findMany({});
      }
    }
  `);
  assert.equal(result.code, 0, result.output);
});

test("mención dentro de un string no cuenta como acceso", () => {
  const result = runAuditor(`
    export class S {
      readonly hint = "usa this.prisma.ghostModel para el caso legacy";
      readonly hint2 = 'tx.ghostModel.findMany(';
      async run() {
        await this.prisma.job.findMany({});
      }
    }
  `);
  assert.equal(result.code, 0, result.output);
});

test("acceso con optional chaining sí se detecta", () => {
  const result = runAuditor(`
    export class S {
      async run() {
        await this.prisma?.ghostModel.findMany({});
      }
    }
  `);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /prisma\.ghostModel/);
});

test("falso positivo: objetos tx ajenos y métodos $ de PrismaClient no cuentan", () => {
  const result = runAuditor(`
    export class S {
      async run(tx: { ghostModel: { push: (x: number) => void } }, ctx: { changeOrders: unknown[] }) {
        tx.ghostModel.push(1);           // tx.<x> sin verbo prisma
        void ctx.changeOrders.length;    // propiedad de otro objeto
        await this.prisma.$transaction([]);
        await this.prisma.$queryRaw\`SELECT 1\`;
        await this.prisma.job.findMany({});
      }
    }
  `);
  assert.equal(result.code, 0, result.output);
});

test("baseline convierte el drift conocido en advertencia sin fallar", () => {
  const result = runAuditor(
    `
    export class S {
      async run() {
        await this.prisma.ghostModel.findMany({});
      }
    }
  `,
    { codeToSchema: ["ghostModel"] },
  );
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /baseline\(codeToSchema\)/);
});

test("modelo en schema sin CREATE TABLE en migraciones falla (nivel 2)", () => {
  const root = mkdtempSync(join(tmpdir(), "prisma-contract-"));
  try {
    cpSync(BASE_FIXTURE, root, { recursive: true });
    writeFileSync(
      join(root, "packages", "db", "prisma", "schema.prisma"),
      `model Job {\n  id String @id\n}\n\nmodel Orphan {\n  id String @id\n}\n`,
    );
    mkdirSync(join(root, "apps", "api", "src"), { recursive: true });
    writeFileSync(join(root, "apps", "api", "src", "sample.service.ts"), "export const x = 1;\n");
    let code = 0;
    let output = "";
    try {
      output = execFileSync(process.execPath, [SCRIPT, "--root", root], { encoding: "utf8" });
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      code = e.status ?? 1;
      output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    }
    assert.equal(code, 1, output);
    assert.match(output, /modelo Orphan/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
