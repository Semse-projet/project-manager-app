#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const TASKS = {
  "build:packages": [
    ["pnpm", ["--filter", "@semse/schemas", "build"]],
    ["pnpm", ["--filter", "@semse/shared", "build"]],
    ["pnpm", ["--filter", "@semse/auth", "build"]],
    ["pnpm", ["--filter", "@semse/knowledge", "build"]],
    ["pnpm", ["--filter", "@semse/agents", "build"]],
    ["pnpm", ["--filter", "@semse/autonomy", "build"]],
    ["pnpm", ["--filter", "@semse/tools", "build"]],
    ["pnpm", ["--filter", "@semse/sdk", "build"]],
    ["pnpm", ["--filter", "@semse/product-events", "build"]],
  ],
  "build:apps": [
    ["pnpm", ["run", "db:generate"]],
    ["pnpm", ["--filter", "@semse/api", "build"]],
    ["pnpm", ["--filter", "@semse/web", "build"]],
    ["pnpm", ["run", "check:worker"]],
  ],
  "typecheck:all": [
    ["pnpm", ["run", "db:generate"]],
    ["pnpm", ["exec", "tsc", "--noEmit", "--project", "apps/api/tsconfig.json"]],
    ["pnpm", ["exec", "tsc", "--noEmit", "--project", "apps/web/tsconfig.json"]],
    ["pnpm", ["run", "check:worker"]],
  ],
  "railway:preflight": [
    ["pnpm", ["run", "validate:workspace"]],
    ["pnpm", ["run", "build:packages"]],
    ["pnpm", ["run", "build:apps"]],
    ["pnpm", ["run", "typecheck:all"]],
  ],
};

function run(command, args) {
  const label = `${command} ${args.join(" ")}`;
  console.log(`\n[workspace-runner] ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

const task = process.argv[2];

if (!task || !(task in TASKS)) {
  console.error(
    `[workspace-runner] expected one of: ${Object.keys(TASKS).join(", ")}`
  );
  process.exit(1);
}

for (const [command, args] of TASKS[task]) {
  run(command, args);
}
