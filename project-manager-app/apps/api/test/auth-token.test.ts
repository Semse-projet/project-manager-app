import test from "node:test";
import assert from "node:assert/strict";
import { signToken, verifyToken } from "../src/common/auth-token.ts";

test("signToken and verifyToken round-trip claims", () => {
  const token = signToken(
    {
      userId: "usr_test",
      tenantId: "tnt_test",
      orgId: "org_test",
      roles: ["OPS_ADMIN"]
    },
    "x".repeat(32),
    3600
  );

  const claims = verifyToken(token, "x".repeat(32));

  assert.equal(claims.userId, "usr_test");
  assert.equal(claims.tenantId, "tnt_test");
  assert.equal(claims.orgId, "org_test");
  assert.deepEqual(claims.roles, ["OPS_ADMIN"]);
  assert.equal(typeof claims.jti, "string");
  assert.equal(claims.jti.length > 0, true);
});

test("verifyToken rejects tampered token", () => {
  const token = signToken(
    {
      userId: "usr_test",
      tenantId: "tnt_test",
      orgId: "org_test",
      roles: []
    },
    "x".repeat(32),
    3600
  );

  assert.throws(() => verifyToken(`${token}broken`, "x".repeat(32)), /Invalid token signature/);
});

test("signToken emits unique jti values across sequential tokens", () => {
  const one = verifyToken(
    signToken(
      {
        userId: "usr_test",
        tenantId: "tnt_test",
        orgId: "org_test",
        roles: []
      },
      "x".repeat(32),
      3600
    ),
    "x".repeat(32)
  );

  const two = verifyToken(
    signToken(
      {
        userId: "usr_test",
        tenantId: "tnt_test",
        orgId: "org_test",
        roles: []
      },
      "x".repeat(32),
      3600
    ),
    "x".repeat(32)
  );

  assert.notEqual(one.jti, two.jti);
});
