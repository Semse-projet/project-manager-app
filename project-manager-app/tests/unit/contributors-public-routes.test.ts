/**
 * The public contributor-program BFF routes (/contributors page) have no
 * signed-in user. They used fetchSemseDataForRequest, which falls back to the
 * server's static identity (503 where none is configured); they must call the
 * @Public API endpoints anonymously: the tenant header plus the BFF transport
 * headers (bootstrap token + visitor IP) for per-visitor throttling, never an
 * Authorization or identity header.
 * Run: node --experimental-strip-types --test tests/unit/contributors-public-routes.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import ts from "typescript";

const dir = path.resolve(import.meta.dirname, "../../apps/web/app/api/semse/contributors/public");

function loadHelper(fetchImpl: typeof fetch) {
  const output = ts.transpileModule(readFileSync(path.join(dir, "_public.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, any> = {};
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (data: unknown, opts?: { status?: number }) => Response.json(data, opts) } },
    "../../_server": {
      trustedClientHeaders: () => ({ "x-semse-bootstrap-token": "bt", "x-semse-client-ip": "203.0.113.7" }),
      upstreamErrorResponse: async (res: Response) => Response.json({ error: { status: res.status } }, { status: res.status }),
      handleServerError: () => Response.json({ error: { status: 502 } }, { status: 502 }),
    },
  };
  const savedFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  new Function("exports", "require", output)(exports, (name: string) => {
    if (name in deps) return deps[name];
    throw new Error("Unexpected dependency: " + name);
  });
  return { helper: (p: string) => (exports.fetchPublicContributorData as (p: string, r: unknown) => Promise<Response>)(p, {}), restore: () => { globalThis.fetch = savedFetch; } };
}

test("calls the API anonymously, with the tenant and visitor transport headers only, and returns its data", async () => {
  let seen: { url: string; headers: Record<string, string> } | undefined;
  const { helper, restore } = loadHelper((async (url: string, init: RequestInit) => {
    seen = { url, headers: init.headers as Record<string, string> };
    return Response.json({ data: [{ id: "m1" }] });
  }) as unknown as typeof fetch);
  try {
    const res = await helper("/v1/contributor-program/missions");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { data: [{ id: "m1" }] });
    assert.match(seen!.url, /\/v1\/contributor-program\/missions$/);
    assert.deepEqual(Object.keys(seen!.headers).map((h) => h.toLowerCase()).sort(), ["x-semse-bootstrap-token", "x-semse-client-ip", "x-tenant-id"]);
  } finally {
    restore();
  }
});

test("trims trailing slashes from SEMSE_API_BASE_URL", async () => {
  let url = "";
  const saved = process.env.SEMSE_API_BASE_URL;
  process.env.SEMSE_API_BASE_URL = "http://api.internal:4000//";
  const { helper, restore } = loadHelper((async (u: string) => { url = u; return Response.json({ data: [] }); }) as unknown as typeof fetch);
  try {
    await helper("/v1/contributor-program/missions");
    assert.equal(url, "http://api.internal:4000/v1/contributor-program/missions");
  } finally {
    restore();
    if (saved === undefined) delete process.env.SEMSE_API_BASE_URL; else process.env.SEMSE_API_BASE_URL = saved;
  }
});

test("relays the API's real status instead of a 503 'runtime not configured'", async () => {
  const { helper, restore } = loadHelper((async () => new Response("{}", { status: 404 })) as unknown as typeof fetch);
  try {
    assert.equal((await helper("/v1/contributor-program/missions/x")).status, 404);
  } finally {
    restore();
  }
});

test("the three public routes use the anonymous helper, never the server identity", () => {
  for (const file of ["terms/route.ts", "missions/route.ts", "missions/[id]/route.ts"]) {
    const src = readFileSync(path.join(dir, file), "utf8");
    assert.match(src, /fetchPublicContributorData\(.*, request\);/, file);
    assert.doesNotMatch(src, /fetchSemseDataForRequest|runtimeDisabledResponse/, file);
  }
  assert.match(readFileSync(path.join(dir, "missions/[id]/route.ts"), "utf8"), /\[A-Za-z0-9_-\]\{1,128\}/);
});
