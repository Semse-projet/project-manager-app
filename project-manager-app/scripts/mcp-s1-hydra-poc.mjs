#!/usr/bin/env node
/**
 * ISOLATED synthetic OAuth test against real Ory Hydra 26.2.0.
 * No SEMSE credentials, users, production data, Railway, live MCP route or
 * database migrations. All servers are loopback-only on a disposable runner.
 *
 * This is NOT proof of a real SEMSE session/Membership/OAuth bridge.
 * Only real Hydra OAuth protocol behavior + simulated SEMSE revocation.
 */
import http from "node:http";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";

const PUBLIC = "http://127.0.0.1:4444";
const ADMIN = "http://127.0.0.1:4445";
const LOGIN = "http://127.0.0.1:3000";
const CALLBACK = "http://127.0.0.1:3000/callback";
const RESOURCE = "https://mcp-poc.invalid/mcp";
const CLIENT = "semse-synthetic-pkce";
const USER = "synthetic-user-a";
const ORG = "synthetic-org-a";
const TENANT = "synthetic-tenant-a";
const SESSION = "synthetic-session-a";
const SCOPES = ["projects:read"];
const grants = new Map();
const sessions = new Map([[SESSION, { userId: USER, tenantId: TENANT, orgId: ORG, active: true, membership: true }]]);
let checks = 0;

function check(condition, why) { assert.ok(condition, why); checks += 1; }
function base64url(value) { return Buffer.from(value).toString("base64url"); }
function fail(reason) { throw new Error(reason); }

async function request(url, options = {}) {
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(9000), ...options });
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch { data = { text: text.slice(0, 400) }; }
  return { status: response.status, location: response.headers.get("location"), data };
}
async function admin(method, suffix, body) {
  const output = await request(ADMIN + suffix, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (output.status < 200 || output.status >= 300) {
    fail("Hydra admin request failed (HTTP " + output.status + " at " + suffix.split("?")[0] + ")");
  }
  return output.data;
}
function redirect(response, to) {
  if (typeof to !== "string") fail("Hydra did not return a redirect URL");
  response.writeHead(302, { Location: to, "Cache-Control": "no-store" });
  response.end();
}
async function handleSyntheticLogin(url, res) {
  const challenge = url.searchParams.get("login_challenge");
  if (!challenge) fail("Missing login challenge");
  const req = await admin("GET", "/admin/oauth2/auth/requests/login?login_challenge=" + encodeURIComponent(challenge));
  check(req.client?.client_id === CLIENT, "Login client ID mismatch");
  const accepted = await admin("PUT",
    "/admin/oauth2/auth/requests/login/accept?login_challenge=" + encodeURIComponent(challenge),
    { subject: USER, remember: false });
  redirect(res, accepted.redirect_to);
}
async function handleSyntheticConsent(url, res) {
  const challenge = url.searchParams.get("consent_challenge");
  if (!challenge) fail("Missing consent challenge");
  const req = await admin("GET", "/admin/oauth2/auth/requests/consent?consent_challenge=" + encodeURIComponent(challenge));
  check(req.subject === USER && req.client?.client_id === CLIENT, "Subject or client mismatch in consent");
  check(req.requested_scope?.includes("projects:read"), "Scope not requested in consent");
  const audience = req.requested_access_token_audience || [];
  check(audience.includes(RESOURCE), "Hydra did not bind the requested resource audience");
  const grantKey = USER + "|" + CLIENT + "|" + ORG + "|" + RESOURCE;
  grants.set(grantKey, { user: USER, sessionId: SESSION, clientId: CLIENT, org: ORG, audience: RESOURCE,
    scope: SCOPES, active: true });
  const accepted = await admin("PUT",
    "/admin/oauth2/auth/requests/consent/accept?consent_challenge=" + encodeURIComponent(challenge),
    { grant_scope: SCOPES, grant_access_token_audience: [RESOURCE],
      session: { access_token: { synthetic_session_binding: SESSION } },
      remember: false });
  redirect(res, accepted.redirect_to);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", LOGIN);
  try {
    if (url.pathname === "/login") return await handleSyntheticLogin(url, res);
    if (url.pathname === "/consent") return await handleSyntheticConsent(url, res);
    res.writeHead(404); res.end();
  } catch (e) {
    // Do not include OAuth challenges or tokens in response/logs.
    res.writeHead(500, { "Content-Type": "text/plain" }); res.end("synthetic login/consent failure");
    process.stderr.write("Synthetic login/consent handler failed: " + e.message.replace(/(challenge|token)=[^ &]*/gi, "$1=[redacted]") + "\n");
  }
});

async function waitForHydra() {
  for (let i = 0; i < 45; i++) {
    try {
      const p = await fetch(PUBLIC + "/health/ready", { signal: AbortSignal.timeout(1200) });
      if (p.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  fail("Hydra did not become ready on loopback");
}
async function registerClient() {
  const client = await admin("POST", "/admin/clients", {
    client_id: CLIENT,
    client_name: "SEMSE Synthetic PKCE PoC",
    grant_types: ["authorization_code"],
    response_types: ["code"],
    redirect_uris: [CALLBACK],
    scope: SCOPES.join(" "),
    audience: [RESOURCE],
    token_endpoint_auth_method: "none",
  });
  check(client.client_id === CLIENT, "Client not registered");
  check(client.token_endpoint_auth_method === "none", "PKCE public client auth method changed");
}
async function authorizationCode() {
  const verifier = base64url(randomBytes(36));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(18));
  const auth = new URL(PUBLIC + "/oauth2/auth");
  for (const [k, v] of Object.entries({
    response_type: "code", client_id: CLIENT, redirect_uri: CALLBACK,
    scope: "projects:read", state, code_challenge: challenge,
    code_challenge_method: "S256", audience: RESOURCE,
  })) auth.searchParams.set(k, v);
  let target = auth.toString();
  for (let n = 0; n < 16; n++) {
    if (target.startsWith(CALLBACK)) {
      const url = new URL(target);
      check(url.searchParams.get("state") === state, "State mismatch");
      const code = url.searchParams.get("code");
      if (!code) {
        const oauthError = url.searchParams.get("error") ?? "missing_error_code";
        // Only log a short OAuth protocol error code, never tokens, URLs or verifier.
        const safeCode = /^[a-z][a-z0-9_]{0,63}$/.test(oauthError) ? oauthError : "invalid_error_code";
        fail("OAuth callback returned " + safeCode + " instead of authorization code");
      }
      return { code, verifier };
    }
    const answer = await request(target);
    if (![301, 302, 303, 307, 308].includes(answer.status) || !answer.location) {
      fail("Authorization flow failed at step " + n + ", HTTP " + answer.status);
    }
    const next = new URL(answer.location, target);
    if (!["127.0.0.1"].includes(next.hostname)) fail("External redirect prohibited in PoC");
    target = next.toString();
  }
  fail("Authorization flow redirected too many times");
}
async function token(code, verifier) {
  return request(PUBLIC + "/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: CLIENT,
      redirect_uri: CALLBACK, code_verifier: verifier }),
  });
}
async function introspect(accessToken) {
  const answer = await request(ADMIN + "/admin/oauth2/introspect", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: accessToken }),
  });
  if (answer.status !== 200) fail("Hydra token introspection returned HTTP " + answer.status);
  return answer.data;
}
function verifySyntheticResource(introspection, resource = RESOURCE) {
  if (introspection.active !== true) return false;
  if (introspection.iss !== PUBLIC || introspection.client_id !== CLIENT || introspection.sub !== USER) return false;
  const audiences = Array.isArray(introspection.aud) ? introspection.aud : [introspection.aud];
  if (!audiences.includes(resource)) return false;
  const scopes = String(introspection.scope ?? "").split(/\s+/);
  if (!scopes.includes("projects:read")) return false;
  const consent = grants.get(USER + "|" + CLIENT + "|" + ORG + "|" + resource);
  if (!consent?.active || consent.clientId !== introspection.client_id || consent.audience !== resource) return false;
  const session = sessions.get(consent.sessionId);
  return !!session?.active && !!session?.membership && session.userId === introspection.sub &&
    session.tenantId === TENANT && session.orgId === ORG;
}

try {
  server.listen(3000, "127.0.0.1");
  await once(server, "listening");
  await waitForHydra();
  await registerClient();
  const first = await authorizationCode();
  const invalid = await token(first.code, base64url(randomBytes(36)));
  check(invalid.status >= 400, "Incorrect PKCE verifier was not rejected");
  const second = await authorizationCode();
  const exchanged = await token(second.code, second.verifier);
  check(exchanged.status === 200 && typeof exchanged.data.access_token === "string",
    "Authorization code exchange failed");
  const probe = await introspect(exchanged.data.access_token);
  check(probe.active === true, "Hydra did not introspect an active access token");
  check(verifySyntheticResource(probe), "Audience, scope or synthetic SEMSE session invalid");
  check(!verifySyntheticResource(probe, "https://unrelated.invalid/mcp"), "Wrong resource accepted");
  check(!verifySyntheticResource({ ...probe, client_id: "other-client" }), "Wrong client accepted");
  check(!verifySyntheticResource({ ...probe, iss: "https://other-issuer.invalid" }), "Wrong issuer accepted");
  const invalidToken = await introspect("invalid.invalid.invalid");
  check(invalidToken.active !== true, "Invalid token introspected active");
  sessions.get(SESSION).active = false;
  check(!verifySyntheticResource(probe), "Revoked synthetic SEMSE session still authorized");
  sessions.get(SESSION).active = true;
  sessions.get(SESSION).membership = false;
  check(!verifySyntheticResource(probe), "Suspended synthetic membership still authorized");
  sessions.get(SESSION).membership = true;
  grants.get(USER + "|" + CLIENT + "|" + ORG + "|" + RESOURCE).active = false;
  check(!verifySyntheticResource(probe), "Revoked synthetic consent still authorized");

  process.stdout.write("PASS: real Hydra OAuth code+PKCE, audience/introspection; synthetic SEMSE revocation (" + checks + " checks)\n");
  process.stdout.write("LIMIT: session, membership and grant stores are synthetic; no actual SEMSE OAuth bridge, DB, MCP host or public endpoint tested.\n");
} catch (error) {
  process.stderr.write("FAIL: isolated Hydra PoC — " + String(error.message).slice(0,240) + "\n");
  process.exitCode = 1;
} finally {
  await new Promise(resolve => server.close(resolve));
}
