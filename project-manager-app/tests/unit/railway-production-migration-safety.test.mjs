import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("Railway API migrations are isolated in a fail-closed pre-deploy gate", () => {
  const config = JSON.parse(read("infra/railway/api.railway.json"));
  const script = read("scripts/pre-migrate.mjs");

  assert.deepEqual(config.deploy.preDeployCommand, ["node scripts/pre-migrate.mjs"]);
  assert.equal(config.deploy.startCommand, "node apps/api/dist/main.js");
  assert.match(script, /"migrate", "deploy"/);
  assert.doesNotMatch(script, /\$executeRawUnsafe|"db",\s*"push"|accept-data-loss|DELETE FROM|INSERT INTO/);
});

test("the production API image carries Prisma CLI but startup stays mutation-free", () => {
  const databaseManifest = JSON.parse(read("packages/db/package.json"));
  const dockerfile = read("Dockerfile.api");

  assert.equal(databaseManifest.dependencies.prisma, "^6.4.1");
  assert.equal(databaseManifest.devDependencies.prisma, undefined);
  assert.match(dockerfile, /CMD \["node", "apps\/api\/dist\/main\.js"\]/);
  assert.doesNotMatch(dockerfile, /CMD .*pre-migrate/);
});

test("legacy migration entrypoints cannot bypass reviewed migration history", () => {
  const entrypoints = [
    read("scripts/db-migrate.sh"),
    read("packages/db/scripts/prisma-baseline-deploy.sh"),
  ];

  for (const entrypoint of entrypoints) {
    assert.match(entrypoint, /migrate deploy/);
    assert.doesNotMatch(entrypoint, /db push|migrate resolve|accept-data-loss/);
  }
});
