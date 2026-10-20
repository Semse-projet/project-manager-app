/** Regression checks for session-bound operational BFF reads. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("API availability is independent of server-wide static actor identity", () => {
  const server = read("apps/web/app/api/semse/_server.ts");
  const configCheck = server.split("export function isApiBaseConfigured(): boolean {")[1]?.split("\n}")[0];
  assert.ok(configCheck, "The API URL availability check must be present");
  assert.match(configCheck, /SEMSE_API_BASE_URL/);
  assert.doesNotMatch(configCheck, /resolveRuntimeConfig\(/);
  assert.match(server, /export async function getAuthenticatedServerConfig/);
  const actorResolver = server.split("export async function getAuthenticatedServerConfig")[1]?.split("\n}")[0];
  assert.ok(actorResolver);
  assert.match(actorResolver, /resolveConfigFromRequest\(req\)/);
  assert.match(actorResolver, /resolveConfigFromCookie\(req\)/);
  assert.doesNotMatch(actorResolver, /resolveRuntimeConfig\(/, "Never fall back to static OPS_ADMIN");
  assert.match(actorResolver, /SemseProxyError\(401/, "No session must fail closed");
});

test("Jobs and Mission Control BFF always use the request-authenticated actor", () => {
  const jobs = read("apps/web/app/api/semse/jobs/route.ts");
  assert.equal((jobs.match(/getAuthenticatedServerConfig\(request\)/g) ?? []).length, 2);
  assert.doesNotMatch(jobs, /\bgetServerConfig\b/);
  for (const path of [
    "apps/web/app/api/semse/ops/mission-control/exceptions/route.ts",
    "apps/web/app/api/semse/ops/mission-control/runbooks/route.ts",
    "apps/web/app/api/semse/ops/mission-control/actions/route.ts",
    "apps/web/app/api/semse/sse/mission-control/route.ts",
  ]) {
    const source = read(path);
    if (path.includes("/sse/")) {
      assert.match(source, /getAuthenticatedServerConfig\(request\)/, path);
    } else {
      assert.match(source, /fetchSemseDataForAuthenticatedRequest\(/, path);
    }
    assert.doesNotMatch(source, /\bfetchSemseDataForRequest\b/, path);
    assert.doesNotMatch(source, /\bgetServerConfig\b/, path);
  }
});

test("middleware authenticates protected APIs and sanitizes caller identity headers", () => {
  const middleware = read("apps/web/middleware.ts");
  assert.match(middleware, /sanitizeSemseIdentityHeaders\(req.headers, session\)/);
  assert.match(middleware, /if \(!session\) \{\s*return unauthorizedApiResponse/);
});
