import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(apiRoot, "..", "..");
const testRoot = resolve(apiRoot, "test");
const coverageEnabled = process.argv.includes("--coverage");
const integrationEnabled = process.argv.includes("--integration");
const testFiles = await collectTests(testRoot, integrationEnabled);

if (testFiles.length === 0) {
  console.error(
    `[api-test-runner] no ${integrationEnabled ? "integration" : "unit"} test files found`,
  );
  process.exit(1);
}

const testArguments = [
  "--experimental-strip-types",
  "--test",
  ...(integrationEnabled ? ["--test-concurrency=1"] : []),
  ...testFiles,
];
const commandArguments = coverageEnabled
  ? [
      resolve(repositoryRoot, "node_modules", "c8", "bin", "c8.js"),
      "--reporter=text",
      "--reporter=text-summary",
      "--reporter=html",
      "--reporter=lcov",
      "--reporter=json-summary",
      "--include=src/**/*.ts",
      "--exclude=test/**/*.test.ts",
      "--exclude=**/*.d.ts",
      "--check-coverage",
      "--lines=70",
      "--functions=65",
      "--branches=80",
      "--statements=70",
      process.execPath,
      ...testArguments,
    ]
  : testArguments;

const result = spawnSync(process.execPath, commandArguments, {
  cwd: apiRoot,
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);

async function collectTests(directory, includeIntegration) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return collectTests(path, includeIntegration);
      const isIntegration = entry.name.endsWith("-integration.test.ts");
      if (
        entry.isFile() &&
        entry.name.endsWith(".test.ts") &&
        isIntegration === includeIntegration
      ) {
        return [path];
      }
      return [];
    }),
  );

  return nested.flat().sort((left, right) => left.localeCompare(right));
}
