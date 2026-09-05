#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

const TASKS = {
  "build:packages": [
    ["pnpm", ["--filter", "@semse/schemas", "build"]],
    ["pnpm", ["--filter", "@semse/control-plane", "build"]],
    ["pnpm", ["--filter", "@semse/shared", "build"]],
    ["pnpm", ["--filter", "@semse/auth", "build"]],
    ["pnpm", ["--filter", "@semse/knowledge", "build"]],
    ["pnpm", ["--filter", "@semse/forge", "build"]],
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
    ["pnpm", ["run", "build:packages"]],
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
  let result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  // Corepack can execute the pinned package manager even when Windows cannot
  // create global pnpm shims under Program Files. Retry only when the original
  // executable was not found; never repeat a command that actually started.
  if (command === "pnpm" && result.error?.code === "ENOENT") {
    const corepack = process.platform === "win32" ? process.execPath : "corepack";
    const corepackArgs = process.platform === "win32"
      ? [join(dirname(process.execPath), "node_modules", "corepack", "dist", "corepack.js"), "pnpm", ...args]
      : ["pnpm", ...args];
    console.warn(`[workspace-runner] pnpm shim unavailable; retrying with corepack pnpm`);
    result = spawnSync(corepack, corepackArgs, {
      stdio: "inherit",
      env: process.env,
    });
  }

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
