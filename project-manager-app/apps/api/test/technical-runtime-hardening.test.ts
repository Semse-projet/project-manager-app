import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TechnicalRuntimeService } from "../dist/modules/agents/technical-runtime.service.js";
import {
  isPathInside,
  isSensitivePath,
  parseAllowedCommand,
  resolveWithinRoot,
} from "../dist/modules/agents/technical-runtime.guards.js";

// Hallazgo 0.38: TechnicalRuntimeService sin shell, con rutas confinadas y sin secretos.

const ROOT = join(tmpdir(), "semse-root");

test("isPathInside compara por relative, no por prefijo de texto", () => {
  assert.equal(isPathInside(ROOT, ROOT), true);
  assert.equal(isPathInside(ROOT, join(ROOT, "src", "a.ts")), true);
  assert.equal(isPathInside(ROOT, `${ROOT}-evil`), false);
  assert.equal(isPathInside(ROOT, join(ROOT, "..", "other")), false);
});

test("resolveWithinRoot rechaza salidas, hermanos con el mismo prefijo y secretos", () => {
  assert.ok(resolveWithinRoot(ROOT, "src/a.ts").startsWith(ROOT));
  assert.throws(() => resolveWithinRoot(ROOT, "../x"), /fuera del workspace/);
  assert.throws(() => resolveWithinRoot(ROOT, `${ROOT}-evil/x`), /fuera del workspace/);
  for (const secret of [".env", ".env.production", "apps/api/.env.local", "keys/server.pem", ".git/config", ".ssh/id_rsa", ".npmrc"]) {
    assert.throws(() => resolveWithinRoot(ROOT, secret), /secretos|protegidos/, secret);
  }
  assert.equal(isSensitivePath(ROOT, join(ROOT, "docs", "environment.md")), false);
});

test("parseAllowedCommand acepta la forma permitida", () => {
  assert.deepEqual(parseAllowedCommand("npm test"), { file: "npm", args: ["test"], pathArgs: [] });
  assert.deepEqual(parseAllowedCommand("npm run build"), { file: "npm", args: ["run", "build"], pathArgs: [] });
  assert.deepEqual(parseAllowedCommand("ls -la src"), { file: "ls", args: ["-la", "src"], pathArgs: ["src"] });
  assert.deepEqual(parseAllowedCommand("cat a.txt"), { file: "cat", args: ["a.txt"], pathArgs: ["a.txt"] });
  assert.deepEqual(parseAllowedCommand("grep -rn TODO src"), { file: "grep", args: ["-rn", "--", "TODO", "src"], pathArgs: ["src"] });
  assert.deepEqual(parseAllowedCommand("echo hola mundo"), { file: "echo", args: ["hola", "mundo"], pathArgs: [] });
});

test("parseAllowedCommand rechaza inyección, banderas peligrosas y comandos fuera de lista", () => {
  const bad = [
    "ls src; rm -rf /",
    "ls src && cat .env",
    "ls src | sh",
    "echo $(cat .env)",
    "echo `id`",
    "cat a.txt > b.txt",
    "ls src\nrm x",
    "echo ${HOME}",
    "npm run build; id",
    "npm run build -- --foo",
    "npm run ../x",
    "npm install evil",
    "npm test extra",
    "grep -f patterns.txt src",
    "grep -r pat",
    "cat",
    "cat -A a.txt",
    "ls -Z",
    "ls src -la",
    "echo -e hi",
    "node -e 1",
    "curl http://x",
    "",
  ];
  for (const command of bad) {
    assert.throws(() => parseAllowedCommand(command), /no permitido|Bandera/, JSON.stringify(command));
  }
});

function workspace() {
  const dir = mkdtempSync(join(tmpdir(), "semse-tr-"));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "a.txt"), "hola");
  writeFileSync(join(dir, ".env"), "SECRET=1");
  const previous = process.cwd();
  process.chdir(dir);
  const service = new TechnicalRuntimeService();
  process.chdir(previous);
  return { dir, service };
}

test("servicio: lectura, escritura, listado y búsqueda no salen de la raíz ni tocan secretos", async () => {
  const { dir, service } = workspace();
  assert.equal(await service.readTextFile("src/a.txt"), "hola");
  await assert.rejects(service.readTextFile(".env"), /secretos|protegidos/);
  await assert.rejects(service.readTextFile("../outside.txt"), /fuera del workspace/);
  await assert.rejects(service.writeTextFile(".env", "x"), /secretos|protegidos/);
  await assert.rejects(service.writeTextFile(`${dir}-evil/x.txt`, "x"), /fuera del workspace/);
  await assert.rejects(service.listDirectory("../"), /fuera del workspace/);
  await service.writeTextFile("src/nuevo.txt", "ok");
  assert.equal(await service.readTextFile("src/nuevo.txt"), "ok");
});

test("servicio: un enlace simbólico que apunta fuera de la raíz se rechaza", async (t) => {
  const { dir, service } = workspace();
  const outside = mkdtempSync(join(tmpdir(), "semse-out-"));
  writeFileSync(join(outside, "secret.txt"), "fuera");
  try {
    symlinkSync(outside, join(dir, "link"), "junction");
  } catch {
    t.skip("sin permiso para crear enlaces en este equipo");
    return;
  }
  await assert.rejects(service.readTextFile("link/secret.txt"), /resuelve fuera/);
  await assert.rejects(service.writeTextFile("link/nuevo.txt", "x"), /resuelve fuera/);
});

test("servicio: runCommand no ejecuta shell (la inyección no crea el archivo marcador)", async () => {
  const { dir, service } = workspace();
  await assert.rejects(service.runCommand(`echo hi; node -e "require('fs').writeFileSync('marker','1')"`), /no permitido/);
  await assert.rejects(service.runCommand("echo hi && touch marker"), /no permitido/);
  await assert.rejects(service.runCommand("cat .env"), /secretos|protegidos/);
  await assert.rejects(service.runCommand("cat ../outside.txt"), /fuera del workspace/);
  assert.equal(existsSync(join(dir, "marker")), false);
});
