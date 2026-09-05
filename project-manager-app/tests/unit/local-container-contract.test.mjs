import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("root Compose targets the canonical API image and runtime contract", () => {
  const compose = read("docker-compose.yml");

  assert.match(compose, /dockerfile:\s*Dockerfile\.api/);
  assert.match(compose, /["']4000:4000["']/);
  assert.match(compose, /http:\/\/localhost:4000\/v1\/health/);
  assert.match(compose, /AUTH_SECRET:/);
  assert.doesNotMatch(compose, /dockerfile:\s*Dockerfile\s*$/m);
  assert.equal(existsSync(new URL("../../Dockerfile.api", import.meta.url)), true);
});

test("Dev Container references existing Compose files and pinned pnpm", () => {
  const config = JSON.parse(read(".devcontainer/devcontainer.json"));

  assert.equal(config.service, "workspace");
  assert.equal(config.workspaceFolder, "/workspaces/SEMSEproject");
  assert.deepEqual(config.forwardPorts, [3000, 4000]);
  assert.match(config.postCreateCommand, /pnpm@10\.33\.0/);
  assert.equal(config.dockerComposeFile[0], "docker-compose.devcontainer.yml");
  assert.equal(existsSync(new URL("../../.devcontainer/docker-compose.devcontainer.yml", import.meta.url)), true);
  assert.equal(existsSync(new URL("../../infra/docker/compose.semse-mvp.yml", import.meta.url)), true);

  const compose = read(".devcontainer/docker-compose.devcontainer.yml");
  assert.match(compose, /image:\s*ollama\/ollama:0\.32\.1/);
  assert.doesNotMatch(compose, /ollama\/ollama:latest/);
});
