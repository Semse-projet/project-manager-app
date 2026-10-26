import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { inventoryRepository } from "../../scripts/library-hub-inventory-lib.mjs";

function makeFixture(callback) {
  const root = mkdtempSync(path.join(tmpdir(), "semse-library-hub-"));
  const write = (p, value) => {
    const full = path.join(root, p);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, value);
  };
  try { return callback({ root, write }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}
function base(write) {
  write("pnpm-workspace.yaml", 'packages:\n  - "apps/*"\n  - "packages/*"\n');
  write("package.json", JSON.stringify({ name: "root", devDependencies: { playwright: "^1" } }));
  write("apps/web/package.json", JSON.stringify({ name: "@semse/web", scripts: { preinstall: "echo SHOULD_NOT_RUN" }, dependencies: { "zod": "^3", "@semse/shared": "workspace:*" }, devDependencies: { typescript: "^5" } }));
  write("packages/shared/package.json", JSON.stringify({ name: "@semse/shared", dependencies: { zod: "^4" } }));
  write("apps/vision-service/requirements.txt", "numpy>=1.26.4\nrequests[socks]==2.32.3; python_version > '3.10'\n-r more.txt\n");
  write("pnpm-lock.yaml", [
    "lockfileVersion: '9.0'", "importers:", "  .:", "    devDependencies:",
    "      playwright:", "        specifier: ^1", "        version: 1.1.0",
    "  apps/web:", "    dependencies:", "      zod:", "        specifier: ^3",
    "        version: 3.25.3(peer@1)", "      '@semse/shared':",
    "        specifier: workspace:*", "        version: link:../../packages/shared",
    "    devDependencies:", "      typescript:", "        specifier: ^5", "        version: 5.9.3",
    "  packages/shared:", "    dependencies:", "      zod:", "        specifier: ^4", "        version: 4.1.12",
    "packages:", "  zod@3.25.3:", "    resolution: {integrity: sha512-test}",
  ].join("\n") + "\n");
}
test("discovers workspace manifests and deterministic, sorted dependency inventory", () => makeFixture(({ root, write }) => {
  base(write);
  const one = inventoryRepository(root);
  const two = inventoryRepository(root);
  assert.deepEqual(one, two);
  assert.equal(one.summary.jsManifests, 3);
  assert.equal(one.summary.pythonManifests, 1);
  assert.equal(one.summary.uniquePackageNames, 4);
  assert.equal(one.summary.declarations, 5);
  assert.deepEqual(one.dependencies.map(d => d.manifest), ["apps/web/package.json", "apps/web/package.json", "apps/web/package.json", "package.json", "packages/shared/package.json"]);
  const webZod = one.dependencies.find(d => d.manifest === "apps/web/package.json" && d.name === "zod");
  assert.equal(webZod.resolvedVersion, "3.25.3");
  assert.equal(webZod.resolvedReference, "3.25.3(peer@1)");
  assert.equal(webZod.resolutionStatus, "RESOLVED");
  assert.equal(webZod.licenseStatus, "UNKNOWN");
  assert.equal(webZod.vulnerabilityStatus, "UNKNOWN");
  assert.equal(webZod.runtimeStatus, "UNVERIFIED");
  const link = one.dependencies.find(d => d.name === "@semse/shared");
  assert.equal(link.resolutionStatus, "LOCAL_LINK");
  assert.equal(link.resolvedVersion, null);
  assert.equal(one.summary.versionConstraintDifferences, 1);
  assert.equal(one.summary.repeatedNames, 1);
  assert.equal(one.pythonRequirements.length, 3);
  assert.ok(one.pythonRequirements.some(x => x.resolutionStatus === "UNRESOLVED"));
}));
test("manifest SHA changes when content changes and output has no volatile timestamps", () => makeFixture(({ root, write }) => {
  base(write);
  const a = inventoryRepository(root);
  write("apps/web/package.json", JSON.stringify({ name: "@semse/web", dependencies: { zod: "^3", "@semse/shared": "workspace:*" }, devDependencies: { typescript: "^5" }, description: "changed" }));
  const b = inventoryRepository(root);
  assert.notEqual(a.manifests.find(x => x.path === "apps/web/package.json").sha256, b.manifests.find(x => x.path === "apps/web/package.json").sha256);
  assert.ok(!JSON.stringify(b).includes("generatedAt"));
}));
test("stale lock specifier is explicitly rejected rather than assigned a version", () => makeFixture(({ root, write }) => {
  base(write);
  const f = path.join(root, "apps/web/package.json");
  const data = JSON.parse(readFileSync(f, "utf8"));
  data.dependencies.zod = "^5";
  write("apps/web/package.json", JSON.stringify(data));
  const z = inventoryRepository(root).dependencies.find(x => x.manifest === "apps/web/package.json" && x.name === "zod");
  assert.equal(z.resolutionStatus, "STALE_LOCKFILE");
  assert.equal(z.resolvedVersion, null);
}));
test("missing lockfile never invents a resolved version", () => makeFixture(({ root, write }) => {
  base(write);
  rmSync(path.join(root, "pnpm-lock.yaml"));
  const result = inventoryRepository(root);
  assert.ok(result.dependencies.every(x => x.resolutionStatus === "UNVERIFIED"));
  assert.ok(result.diagnostics.some(x => x.code === "LOCKFILE_MISSING"));
}));
test("malformed manifests fail closed, scripts are never run", () => makeFixture(({ root, write }) => {
  base(write);
  write("apps/web/package.json", "{bad json");
  assert.throws(() => inventoryRepository(root), /Invalid JSON/);
  const marker=path.join(root,"malicious-script-executed");
  write("apps/web/package.json", JSON.stringify({ name: "x", scripts: { preinstall: "touch "+marker }, dependencies: {} }));
  inventoryRepository(root);
  assert.equal(existsSync(marker), false);
}));
test("rejects symlinked package manifests and symlinked directories", () => makeFixture(({ root, write }) => {
  base(write);
  rmSync(path.join(root, "apps/web/package.json"));
  symlinkSync(path.join(root, "package.json"), path.join(root, "apps/web/package.json"));
  assert.throws(() => inventoryRepository(root), /symbolic link/i);
}));
test("rejects unsupported workspace selectors, no directory escape", () => makeFixture(({ root, write }) => {
  base(write);
  write("pnpm-workspace.yaml", "packages:\n  - '../../elsewhere/*'\n");
  assert.throws(() => inventoryRepository(root), /Unsupported workspace pattern/);
}));
test("python requirement URLs with embedded credentials are never echoed", () => makeFixture(({ root, write }) => {
  base(write);
  write("apps/vision-service/requirements.txt", "secret @ https://user:pass@example.com/pkg.whl\n");
  const result = inventoryRepository(root);
  assert.ok(!JSON.stringify(result).includes("user:pass"));
  assert.ok(result.diagnostics.some(d => d.code === "PYTHON_REQUIREMENT_REDACTED"));
}));
test("Python files are static, with complex directives marked unsupported", () => makeFixture(({ root, write }) => {
  base(write);
  const result = inventoryRepository(root);
  const numpy = result.pythonRequirements.find(r => r.name === "numpy");
  assert.equal(numpy.declaredRange, ">=1.26.4");
  assert.equal(numpy.resolvedVersion, null);
  const include = result.pythonRequirements.find(r => r.resolutionStatus === "UNRESOLVED");
  assert.ok(include);
}));

test("npm dependency URLs containing credentials are not echoed", () => makeFixture(({root,write}) => {
  base(write);
  const data=JSON.parse(readFileSync(path.join(root,"apps/web/package.json"),"utf8"));
  data.dependencies.private="git+https://robot:secret@github.example/private.git";
  write("apps/web/package.json",JSON.stringify(data));
  const result=inventoryRepository(root);
  const record=result.dependencies.find(x=>x.name==="private");
  assert.equal(record.declaredRange,"[REDACTED]");
  assert.equal(record.resolvedVersion,null);
  assert.equal(record.resolutionStatus,"UNVERIFIED");
  assert.ok(!JSON.stringify(result).includes("robot:secret"));
}));
test("lockfile format outside pinned supported v9 fails closed", () => makeFixture(({root,write}) => {
  base(write);
  write("pnpm-lock.yaml","lockfileVersion: '8.0'\nimporters:\n");
  assert.throws(()=>inventoryRepository(root),/Unsupported pnpm-lock/);
}));
