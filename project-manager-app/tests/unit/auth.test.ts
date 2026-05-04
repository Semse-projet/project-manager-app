/**
 * Unit tests for @semse/auth package.
 * Run: node --experimental-strip-types --test tests/unit/auth.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  RBAC_DEFAULT_POLICY,
  rolePermissions,
  hasPermission,
  normalizeRoles,
  getPermissionsForRoles,
  appRoleFromRoles,
  appRoleFromPathname,
  defaultDashboardForRole
} from "../../packages/auth/src/index.ts";

import {
  generateSessionId,
  encodeSession,
  decodeSession,
  isSessionValid,
  type SessionPayload
} from "../../packages/auth/src/session.ts";

// ── constants ─────────────────────────────────────────────────────────────────

test("RBAC_DEFAULT_POLICY is deny_by_default", () => {
  assert.equal(RBAC_DEFAULT_POLICY, "deny_by_default");
});

// ── rolePermissions ───────────────────────────────────────────────────────────

test("rolePermissions defines all four roles", () => {
  assert.ok(Array.isArray(rolePermissions["CLIENT"]));
  assert.ok(Array.isArray(rolePermissions["PRO"]));
  assert.ok(Array.isArray(rolePermissions["WORKER"]));
  assert.ok(Array.isArray(rolePermissions["OPS_ADMIN"]));
});

test("OPS_ADMIN has more permissions than CLIENT", () => {
  assert.ok(rolePermissions["OPS_ADMIN"].length > rolePermissions["CLIENT"].length);
});

test("WORKER has agent execution permissions", () => {
  assert.ok(rolePermissions["WORKER"].includes("agents:run:worker"));
  assert.ok(rolePermissions["WORKER"].length >= 1);
});

test("OPS_ADMIN includes ops-specific and dashboard:write permissions", () => {
  assert.ok(rolePermissions["OPS_ADMIN"].includes("ops:dashboard:read"));
  assert.ok(rolePermissions["OPS_ADMIN"].includes("ops:dashboard:write"));
  assert.ok(rolePermissions["OPS_ADMIN"].includes("ops:incidents:create"));
  assert.ok(rolePermissions["OPS_ADMIN"].includes("disputes:resolve"));
});

// ── normalizeRoles ────────────────────────────────────────────────────────────

test("normalizeRoles strips whitespace and deduplicates", () => {
  const result = normalizeRoles(["CLIENT", " CLIENT ", "CLIENT"]);
  assert.equal(result.length, 1);
  assert.equal(result[0], "CLIENT");
});

test("normalizeRoles resolves known aliases", () => {
  const result = normalizeRoles(["ADMIN"]);
  assert.ok(result.includes("OPS_ADMIN"), `Got: ${result}`);
});

test("normalizeRoles filters empty strings", () => {
  const result = normalizeRoles(["", "PRO", "  "]);
  assert.deepEqual(result, ["PRO"]);
});

// ── getPermissionsForRoles ────────────────────────────────────────────────────

test("getPermissionsForRoles returns combined unique permissions", () => {
  const perms = getPermissionsForRoles(["CLIENT", "OPS_ADMIN"]);
  assert.ok(perms.includes("jobs:read"));
  assert.ok(perms.includes("ops:dashboard:read"));
  assert.ok(perms.includes("disputes:resolve"));
});

test("getPermissionsForRoles returns empty for unknown role", () => {
  const perms = getPermissionsForRoles(["UNKNOWN_ROLE"]);
  assert.deepEqual(perms, []);
});

// ── hasPermission ─────────────────────────────────────────────────────────────

test("hasPermission returns true when role grants permission", () => {
  assert.equal(hasPermission(["CLIENT"], "jobs:read"), true);
  assert.equal(hasPermission(["PRO"], "bids:create"), true);
  assert.equal(hasPermission(["OPS_ADMIN"], "ops:dashboard:write"), true);
});

test("hasPermission returns false when role lacks permission", () => {
  assert.equal(hasPermission(["CLIENT"], "ops:dashboard:read"), false);
  assert.equal(hasPermission(["PRO"], "disputes:assign"), false);
  assert.equal(hasPermission(["WORKER"], "jobs:create"), false);
});

test("hasPermission works with multiple roles", () => {
  assert.equal(hasPermission(["PRO", "OPS_ADMIN"], "disputes:assign"), true);
});

test("hasPermission returns false for empty roles array", () => {
  assert.equal(hasPermission([], "jobs:read"), false);
});

test("hasPermission returns false for unknown permission", () => {
  assert.equal(hasPermission(["OPS_ADMIN"], "does:not:exist"), false);
});

// ── appRoleFromRoles ──────────────────────────────────────────────────────────

test("appRoleFromRoles returns admin for OPS_ADMIN", () => {
  assert.equal(appRoleFromRoles(["OPS_ADMIN"]), "admin");
  assert.equal(appRoleFromRoles(["CLIENT", "OPS_ADMIN"]), "admin");
});

test("appRoleFromRoles returns worker for PRO or WORKER", () => {
  assert.equal(appRoleFromRoles(["PRO"]), "worker");
  assert.equal(appRoleFromRoles(["WORKER"]), "worker");
});

test("appRoleFromRoles falls back to client", () => {
  assert.equal(appRoleFromRoles([]), "client");
  assert.equal(appRoleFromRoles(["CLIENT"]), "client");
  assert.equal(appRoleFromRoles(["UNKNOWN"]), "client");
});

// ── appRoleFromPathname ───────────────────────────────────────────────────────

test("appRoleFromPathname classifies routes correctly", () => {
  assert.equal(appRoleFromPathname("/admin/ops"), "admin");
  assert.equal(appRoleFromPathname("/worker/runs"), "worker");
  assert.equal(appRoleFromPathname("/client/dashboard"), "client");
  assert.equal(appRoleFromPathname("/"), "client");
});

// ── defaultDashboardForRole ───────────────────────────────────────────────────

test("defaultDashboardForRole returns correct routes", () => {
  assert.equal(defaultDashboardForRole("admin"), "/admin/dashboard");
  assert.equal(defaultDashboardForRole("worker"), "/worker/dashboard");
  assert.equal(defaultDashboardForRole("client"), "/client/dashboard");
});

// ── generateSessionId ─────────────────────────────────────────────────────────

test("generateSessionId returns a UUID-format string", () => {
  const sid = generateSessionId();
  assert.equal(typeof sid, "string");
  assert.match(sid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test("generateSessionId produces unique values", () => {
  const ids = new Set(Array.from({ length: 20 }, () => generateSessionId()));
  assert.equal(ids.size, 20);
});

// ── encodeSession / decodeSession ─────────────────────────────────────────────

const validPayload: SessionPayload = {
  sid: "test-session-id",
  userId: "user-123",
  tenantId: "tenant-abc",
  orgId: "org-xyz",
  roles: ["CLIENT"],
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

test("encodeSession produces a base64url string without +/= chars", () => {
  const encoded = encodeSession(validPayload);
  assert.equal(typeof encoded, "string");
  assert.ok(encoded.length > 20);
  assert.doesNotMatch(encoded, /[+/=]/);
});

test("decodeSession round-trips a valid payload", () => {
  const encoded = encodeSession(validPayload);
  const decoded = decodeSession(encoded);
  assert.deepEqual(decoded, validPayload);
});

test("decodeSession returns null for malformed input", () => {
  assert.equal(decodeSession("!@#$%invalid"), null);
  assert.equal(decodeSession(""), null);
});

test("decodeSession returns null when required fields are missing", () => {
  const incomplete = { sid: "x", userId: "y" };
  const encoded = Buffer.from(JSON.stringify(incomplete)).toString("base64url");
  assert.equal(decodeSession(encoded), null);
});

// ── isSessionValid ────────────────────────────────────────────────────────────

test("isSessionValid returns true for future expiry", () => {
  const future: SessionPayload = {
    ...validPayload,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  };
  assert.equal(isSessionValid(future), true);
});

test("isSessionValid returns false for past expiry", () => {
  const past: SessionPayload = {
    ...validPayload,
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  };
  assert.equal(isSessionValid(past), false);
});

test("isSessionValid accepts a custom now reference", () => {
  const expiresAt = "2026-04-07T12:00:00Z";
  const before = new Date("2026-04-07T11:59:59Z");
  const after  = new Date("2026-04-07T12:00:01Z");
  const session: SessionPayload = { ...validPayload, expiresAt };

  assert.equal(isSessionValid(session, before), true);
  assert.equal(isSessionValid(session, after), false);
});
