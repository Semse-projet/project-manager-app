/** KIT-F3-04: anonymous BFF→API calls forward the visitor's IP so the API does not count them all as the BFF. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clientIpFromHeaders } from "../../apps/web/app/api/semse/_client-ip.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const headers = (values: Record<string, string>) => new Headers(values);

test("clientIpFromHeaders takes the hop added by the proxy, then x-real-ip", () => {
  assert.equal(clientIpFromHeaders(headers({ "x-forwarded-for": "203.0.113.1" })), "203.0.113.1");
  // The client controls everything left of the proxy's entry.
  assert.equal(clientIpFromHeaders(headers({ "x-forwarded-for": "198.51.100.66, 203.0.113.1" })), "203.0.113.1");
  assert.equal(clientIpFromHeaders(headers({ "x-real-ip": "2001:db8::1" })), "2001:db8::1");
  assert.equal(clientIpFromHeaders(headers({})), undefined);
});

test("clientIpFromHeaders forwards nothing that is not an IP", () => {
  assert.equal(clientIpFromHeaders(headers({ "x-forwarded-for": "unknown" })), undefined);
  const raw = { get: (name: string) => (name === "x-forwarded-for" ? "203.0.113.1 x-evil" : null) };
  assert.equal(clientIpFromHeaders(raw), undefined);
});

test("trustedClientHeaders sends the client IP only together with the bootstrap token", () => {
  const server = read("apps/web/app/api/semse/_server.ts");
  const helper = server.split("export function trustedClientHeaders(req: NextRequest)")[1]?.split("\n}")[0];
  assert.ok(helper, "trustedClientHeaders must exist");
  assert.match(helper, /if \(!bootstrapToken \|\| !clientIp\) return \{\};/);
  assert.match(helper, /\[SEMSE_BOOTSTRAP_HEADER_NAME\]: bootstrapToken/);
  assert.match(helper, /\[SEMSE_CLIENT_IP_HEADER_NAME\]: clientIp/);
});

test("every anonymous auth/demo BFF route forwards the trusted client headers", () => {
  const routes: Record<string, string> = {
    "apps/web/app/api/semse/auth/token/route.ts": "/v1/auth/login",
    "apps/web/app/api/semse/auth/login/route.ts": "/v1/auth/login",
    "apps/web/app/api/semse/auth/register/route.ts": "/v1/auth/register",
    "apps/web/app/api/semse/auth/forgot-password/route.ts": "/v1/auth/password-reset/request",
    "apps/web/app/api/semse/auth/reset-password/route.ts": "/v1/auth/password-reset/confirm",
    "apps/web/app/api/semse/demo/session/route.ts": "/v1/demo/session",
  };
  for (const [file, upstream] of Object.entries(routes)) {
    const source = read(file);
    // The call site, not a comment mentioning the path: `${apiBaseUrl}/v1/…` or "/v1/…".
    const at = Math.max(source.lastIndexOf(`${upstream}\``), source.lastIndexOf(`"${upstream}"`));
    const call = at >= 0 ? source.slice(at, at + 400) : undefined;
    assert.ok(call, `${file} must call ${upstream}`);
    assert.match(call, /trustedClientHeaders\(|input\.trustedHeaders/, `${file} must forward trusted client headers to ${upstream}`);
  }
});
