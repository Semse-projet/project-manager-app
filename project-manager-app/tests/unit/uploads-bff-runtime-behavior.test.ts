import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import ts from "typescript";

const src = readFileSync(path.resolve(import.meta.dirname, "../../apps/web/app/api/semse/uploads/files/[...key]/route.ts"), "utf8");

function harness(session: boolean) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let bodyReads = 0;
  const output = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, (...args: any[]) => Promise<Response>> = {};
  const ctx = {
    exports,
    require(name: string) {
      if (name === "next/server") return { NextResponse: { json: (data: unknown, opts?: { status?: number }) => Response.json(data, opts) } };
      if (name === "../../../_server") {
        return {
          resolveCookieRuntimeConfigForRequest: async () => session
            ? ({ apiBaseUrl: "http://api.test", tenantId: "tenantA", orgId: "orgA", userId: "userA", roles: "PRO" })
            : null,
          buildAuthorizedHeaders: async () => ({ authorization: "Bearer session-bound" }),
          handleServerError: (e: Error) => Response.json({ error: e.message }, { status: 502 }),
        };
      }
      throw new Error("Unexpected test dependency: " + name);
    },
  };
  const run = new Function("exports", "require", output);
  run(ctx.exports, ctx.require);
  const oldFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (init.method === "PUT") return Response.json({ ok: true, key: "key" });
    return new Response("source photo bytes", { headers: { "content-type": "image/jpeg" } });
  }) as typeof fetch;
  return {
    handlers: exports,
    calls,
    request: {
      headers: new Headers({ "content-type": "image/jpeg" }),
      async arrayBuffer() { bodyReads++; return new Uint8Array([0xff, 0xd8, 0xff]).buffer; },
    },
    get reads() { return bodyReads; },
    done() { globalThis.fetch = oldFetch; },
  };
}
const params = { params: Promise.resolve({ key: ["tenants", "tenantA", "evidence", "a.jpg"] }) };

test("GET and PUT without session return 401 without touching upstream storage", async () => {
  const h = harness(false);
  try {
    const get = await h.handlers.GET(h.request, params);
    const put = await h.handlers.PUT(h.request, params);
    assert.equal(get.status, 401);
    assert.equal(put.status, 401);
    assert.equal(h.calls.length, 0);
    assert.equal(h.reads, 0, "no file body read before authentication");
  } finally { h.done(); }
});

test("session-bound GET/PUT forward authenticated request and original bytes", async () => {
  const h = harness(true);
  try {
    const get = await h.handlers.GET(h.request, params);
    const put = await h.handlers.PUT(h.request, params);
    assert.equal(get.status, 200);
    assert.equal(await get.text(), "source photo bytes");
    assert.equal(put.status, 200);
    assert.equal(h.calls.length, 2);
    assert.deepEqual(h.calls.map(c => c.init.method), ["GET", "PUT"]);
    assert.ok(h.calls.every(c => (c.init.headers as Record<string,string>).authorization === "Bearer session-bound"));
    assert.equal(h.reads, 1);
  } finally { h.done(); }
});
