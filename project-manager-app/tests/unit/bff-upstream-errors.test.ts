/**
 * BFF routes that build their own fetch (streams, PDF passthrough, my-bids)
 * used to answer every upstream failure with 503 "SEMSE server runtime is not
 * configured", hiding 401/403/429 from the API and a missing session. They
 * must relay the real status (KIT-F3-02, SEMSE quality kit).
 * Run: node --experimental-strip-types --test tests/unit/bff-upstream-errors.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

const webApi = path.resolve(import.meta.dirname, "../../apps/web/app/api/semse");

function load(file: string, deps: Record<string, unknown>): Record<string, any> {
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, any> = {};
  new Function("exports", "require", output)(exports, (name: string) => {
    if (name in deps) return deps[name];
    throw new Error("Unexpected test dependency: " + name);
  });
  return exports;
}

const nextServer = { NextResponse: { json: (data: unknown, opts?: { status?: number }) => Response.json(data, opts) } };
const server = load(path.join(webApi, "_server.ts"), {
  "next/server": nextServer,
  "@semse/shared": {
    SEMSE_BOOTSTRAP_HEADER_NAME: "x-semse-bootstrap",
    SEMSE_CLIENT_IP_HEADER_NAME: "x-semse-client-ip",
    SEMSE_PROXY_HEADER_NAMES: { userId: "x-semse-user-id", tenantId: "x-semse-tenant-id", orgId: "x-semse-org-id", roles: "x-semse-roles" },
    buildIdentityHeaders: () => ({}),
    parseRoleList: (roles: string) => roles.split(","),
    trimToUndefined: (value?: string) => value?.trim() || undefined,
    validateWebServerEnv: (env: unknown) => env,
  },
  "../../../lib/auth": { SESSION_COOKIE: "semse_session", decodeSession: async () => null },
  "./_access-token-bootstrap": { AccessTokenBootstrapper: class {} },
  "./_client-ip": { clientIpFromHeaders: () => undefined },
});

const unauthenticatedRequest = {
  headers: new Headers(),
  cookies: { get: () => undefined },
  nextUrl: { pathname: "/api/semse/sse/mission-control" },
  signal: undefined,
};

test("upstreamErrorResponse keeps the API status and its message", async () => {
  const forbidden = await server.upstreamErrorResponse(
    Response.json({ error: { message: "RBAC metadata required" } }, { status: 403 }),
    "/v1/sse/mission-control",
  );
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).error.message, "RBAC metadata required");

  const throttled = await server.upstreamErrorResponse(new Response("Too Many Requests", { status: 429 }), "/v1/my-bids");
  assert.equal(throttled.status, 429);
  assert.equal((await throttled.json()).error.message, "Too Many Requests");
});

test("routeErrorResponse: only a missing runtime is 503, a missing session stays 401", async () => {
  assert.equal(server.routeErrorResponse(new Error("SEMSE server runtime is not configured")).status, 503);
  assert.equal(server.routeErrorResponse(new Error("socket hang up")).status, 502);
  const sessionError = await server.getAuthenticatedServerConfig(unauthenticatedRequest).then(() => null, (error: unknown) => error);
  assert.ok(sessionError, "a request without session must be rejected");
  assert.equal(server.routeErrorResponse(sessionError).status, 401);
});

test("the Mission Control SSE route relays a 403 from the API instead of a 503", async () => {
  const route = load(path.join(webApi, "sse/mission-control/route.ts"), {
    "next/server": nextServer,
    "../../_server": {
      ...server,
      getAuthenticatedServerConfig: async () => ({ apiBaseUrl: "http://api.test", tenantId: "t", orgId: "o", userId: "u", roles: "OPS_ADMIN" }),
      buildAuthorizedHeaders: async () => ({ authorization: "Bearer test" }),
    },
  });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ error: { message: "RBAC metadata required" } }, { status: 403 })) as typeof fetch;
  try {
    const res: Response = await route.GET(unauthenticatedRequest);
    assert.equal(res.status, 403);
  } finally {
    globalThis.fetch = realFetch;
  }

  const anonymous = load(path.join(webApi, "sse/mission-control/route.ts"), { "next/server": nextServer, "../../_server": server });
  assert.equal((await anonymous.GET(unauthenticatedRequest)).status, 401, "no session must be 401, not 503");
});

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) routeFiles(full, out);
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

test("no BFF route turns an upstream failure or an unknown error into 'runtime not configured'", () => {
  const offenders: string[] = [];
  for (const file of routeFiles(webApi)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (!line.includes("runtimeDisabledResponse()")) return;
      const context = lines.slice(Math.max(0, i - 3), i + 1).join("\n");
      const upstreamFailure = /!\s*[\w.]+\.ok\b/.test(context);
      // `catch { return runtimeDisabledResponse(); }` without checking the cause (a missing session, a network error…).
      const blindCatch = !line.includes("not configured") && /catch\s*(\(\s*\w*\s*\))?\s*\{\s*$/.test(lines[i - 1] ?? "");
      if (upstreamFailure || blindCatch) {
        offenders.push(`${path.relative(webApi, file)}:${i + 1}`);
      }
    });
  }
  assert.deepEqual(offenders, [], "use upstreamErrorResponse()/routeErrorResponse() from _server.ts");
});
