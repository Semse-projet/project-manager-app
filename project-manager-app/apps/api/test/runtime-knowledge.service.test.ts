import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeKnowledgeService } from "../dist/modules/runtime-knowledge/runtime-knowledge.service.js";

test("runtime knowledge service returns topology and service node detail", async () => {
  const service = new RuntimeKnowledgeService();

  const tree = await service.getTree();
  const node = await service.getNode("api_service");

  assert.equal(tree.node.id, "semse_runtime");
  assert.equal(node.id, "api_service");
});

test("runtime knowledge service answers structured runtime queries", async () => {
  const service = new RuntimeKnowledgeService();
  const result = await service.query({
    search: "redis",
    includeRelations: true,
    includePath: true,
    maxDepth: 4
  });

  assert.equal(result.node?.id, "redis_service");
  assert.equal(result.path.at(-1)?.id, "redis_service");
});


// ── probe targets: never report production services from local dev addresses ──

type EnvOverrides = Record<string, string | undefined>;

async function withEnv<T>(overrides: EnvOverrides, run: () => Promise<T>): Promise<T> {
  const previous: EnvOverrides = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// resolveProbeTargets/probeNodeStatus are private/protected in TypeScript but plain methods at runtime.
const internals = (service: RuntimeKnowledgeService) =>
  service as unknown as {
    resolveProbeTargets(node: unknown): string[];
    probeNodeStatus(node: unknown): Promise<{ status: string; detail?: string; target?: string }>;
  };

test("production: seed loopback targets are dropped and Postgres is probed from DATABASE_URL (no credentials)", async () => {
  const service = new RuntimeKnowledgeService();
  const node = await service.getNode("postgres_service");

  await withEnv({ NODE_ENV: "production", DATABASE_URL: "postgresql://user:secret@db.internal:6543/semse" }, async () => {
    const targets = internals(service).resolveProbeTargets(node);
    assert.deepEqual(targets, ["db.internal:6543"]);
    assert.ok(!targets.join(" ").includes("secret"), "credentials must never reach a probe target");
  });
});

test("production: Redis target comes from REDIS_URL and defaults to port 6379", async () => {
  const service = new RuntimeKnowledgeService();
  const node = await service.getNode("redis_service");

  await withEnv({ NODE_ENV: "production", REDIS_URL: "redis://default:pw@cache.internal" }, async () => {
    assert.deepEqual(internals(service).resolveProbeTargets(node), ["cache.internal:6379"]);
  });
});

test("production: dev-only services with no real target report unknown and are never probed", async () => {
  const service = new RuntimeKnowledgeService();
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("must not probe loopback targets in production");
  }) as typeof fetch;

  try {
    await withEnv({ NODE_ENV: "production", DATABASE_URL: undefined, REDIS_URL: undefined }, async () => {
      for (const id of ["minio_service", "mailhog_service", "postgres_service", "redis_service"]) {
        const node = await service.getNode(id);
        const status = await internals(service).probeNodeStatus(node);
        assert.equal(status.status, "unknown", `${id} must not be reported offline in production`);
        assert.match(String(status.detail), /No probe target configured/);
        assert.equal(status.target, undefined);
      }
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("non-production keeps the local docker-compose targets from the seed", async () => {
  const service = new RuntimeKnowledgeService();
  const node = await service.getNode("postgres_service");

  await withEnv({ NODE_ENV: "development", DATABASE_URL: undefined }, async () => {
    assert.deepEqual(internals(service).resolveProbeTargets(node), ["127.0.0.1:5433"]);
  });
});

test("api_service probe target is unchanged in production (HOST/PORT based)", async () => {
  const service = new RuntimeKnowledgeService();
  const node = await service.getNode("api_service");

  await withEnv({ NODE_ENV: "production", HOST: "0.0.0.0", PORT: "3000" }, async () => {
    assert.equal(internals(service).resolveProbeTargets(node)[0], "http://0.0.0.0:3000/v1/health");
  });
});
