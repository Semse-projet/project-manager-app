/** The web login limiter counts the proxy's hop, which the client cannot forge. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clientIpFromHeaders } from "../../apps/web/app/api/semse/_client-ip.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const route = readFileSync(path.join(root, "apps/web/app/api/semse/auth/token/route.ts"), "utf8");
const headers = (values: Record<string, string>) => new Headers(values);

test("a client rotating made-up IPs on the left keeps the same bucket", () => {
  const ips = new Set(
    Array.from({ length: 5 }, (_, i) => clientIpFromHeaders(headers({ "x-forwarded-for": `198.51.100.${i}, 203.0.113.50` }))),
  );
  assert.deepEqual([...ips], ["203.0.113.50"]);
});

test("no or invalid forwarding headers fall back to x-real-ip, then nothing", () => {
  assert.equal(clientIpFromHeaders(headers({ "x-real-ip": "203.0.113.7" })), "203.0.113.7");
  assert.equal(clientIpFromHeaders(headers({ "x-forwarded-for": "not-an-ip" })), undefined);
  assert.equal(clientIpFromHeaders(headers({})), undefined);
});

test("the login route's limiter uses the shared helper, not the left-most entry", () => {
  const getClientIp = route.split("function getClientIp(req: NextRequest): string {")[1]?.split("\n}")[0];
  assert.ok(getClientIp, "getClientIp must exist");
  assert.match(getClientIp, /return clientIpFromHeaders\(req\.headers\) \?\? "unknown";/);
  assert.doesNotMatch(route, /split\(","\)\[0\]/);
});
