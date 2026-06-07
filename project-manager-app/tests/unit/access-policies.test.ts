/**
 * Unit tests for RBAC access policy functions — pure, no I/O.
 * Run: node --experimental-strip-types --test tests/unit/access-policies.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Inline policies ────────────────────────────────────────────────────────────

type Actor = { tenantId: string; orgId: string; userId: string; roles: string[] };

const canReadUser = (actor: Actor, targetUserId: string) =>
  actor.roles.includes("OPS_ADMIN") || actor.userId === targetUserId;

const canReadUserMemberships = (actor: Actor, targetUserId: string) =>
  actor.roles.includes("OPS_ADMIN") || actor.userId === targetUserId;

const canVerifyUser = (actor: Actor) => actor.roles.includes("OPS_ADMIN");
const canUpdateUserStatus = (actor: Actor) => actor.roles.includes("OPS_ADMIN");
const canReadOrg = (actor: Actor, orgId: string) =>
  actor.roles.includes("OPS_ADMIN") || actor.orgId === orgId;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const admin: Actor  = { tenantId: "t1", orgId: "org1", userId: "admin1", roles: ["OPS_ADMIN"] };
const worker: Actor = { tenantId: "t1", orgId: "org2", userId: "worker1", roles: ["PRO"] };
const client: Actor = { tenantId: "t1", orgId: "org3", userId: "client1", roles: ["CLIENT"] };

// ── canReadUser ───────────────────────────────────────────────────────────────

test("canReadUser: OPS_ADMIN can read any user", () => {
  assert.equal(canReadUser(admin, "anyone"), true);
});

test("canReadUser: user can read themselves", () => {
  assert.equal(canReadUser(worker, "worker1"), true);
});

test("canReadUser: user cannot read another user", () => {
  assert.equal(canReadUser(worker, "client1"), false);
});

test("canReadUser: client can read themselves", () => {
  assert.equal(canReadUser(client, "client1"), true);
});

// ── canReadUserMemberships ────────────────────────────────────────────────────

test("canReadUserMemberships: admin can read anyone's memberships", () => {
  assert.equal(canReadUserMemberships(admin, "worker1"), true);
});

test("canReadUserMemberships: user can read their own memberships", () => {
  assert.equal(canReadUserMemberships(worker, "worker1"), true);
});

test("canReadUserMemberships: user cannot read other's memberships", () => {
  assert.equal(canReadUserMemberships(worker, "client1"), false);
});

// ── canVerifyUser ─────────────────────────────────────────────────────────────

test("canVerifyUser: OPS_ADMIN can verify users", () => {
  assert.equal(canVerifyUser(admin), true);
});

test("canVerifyUser: PRO cannot verify users", () => {
  assert.equal(canVerifyUser(worker), false);
});

test("canVerifyUser: CLIENT cannot verify users", () => {
  assert.equal(canVerifyUser(client), false);
});

// ── canUpdateUserStatus ───────────────────────────────────────────────────────

test("canUpdateUserStatus: only OPS_ADMIN", () => {
  assert.equal(canUpdateUserStatus(admin), true);
  assert.equal(canUpdateUserStatus(worker), false);
  assert.equal(canUpdateUserStatus(client), false);
});

// ── canReadOrg ────────────────────────────────────────────────────────────────

test("canReadOrg: admin can read any org", () => {
  assert.equal(canReadOrg(admin, "org_unknown"), true);
});

test("canReadOrg: actor can read their own org", () => {
  assert.equal(canReadOrg(worker, "org2"), true);
});

test("canReadOrg: actor cannot read a different org", () => {
  assert.equal(canReadOrg(worker, "org3"), false);
});

test("canReadOrg: admin reads their own org too", () => {
  assert.equal(canReadOrg(admin, "org1"), true);
});

// ── Multi-role actor ──────────────────────────────────────────────────────────

test("actor with multiple roles including OPS_ADMIN has full access", () => {
  const multiRole: Actor = { tenantId: "t1", orgId: "org1", userId: "u1", roles: ["OPS_ADMIN", "PRO"] };
  assert.equal(canVerifyUser(multiRole), true);
  assert.equal(canUpdateUserStatus(multiRole), true);
  assert.equal(canReadUser(multiRole, "anyone"), true);
});

test("actor with no roles has no privileged access", () => {
  const noRoles: Actor = { tenantId: "t1", orgId: "org1", userId: "u1", roles: [] };
  assert.equal(canVerifyUser(noRoles), false);
  assert.equal(canReadUser(noRoles, "other"), false);
  assert.equal(canReadUser(noRoles, "u1"), true); // can still read self
});
