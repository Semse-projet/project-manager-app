import assert from "node:assert/strict";
import test from "node:test";
import { signInvitationProxy, verifyInvitationProxy } from "../../packages/auth/src/invitation-proxy.ts";
const key = "test-only-".repeat(5);
test("proxy assertion binds client, method, path and fresh timestamp", () => {
  const headers = signInvitationProxy(key, "203.0.113.1", "POST", "/v1/invitations/preview", 1700000000);
  assert.equal(verifyInvitationProxy(key, headers, "POST", "/v1/invitations/preview", 1700000010), "203.0.113.1");
  assert.equal(verifyInvitationProxy(key, headers, "POST", "/v1/invitations/accept", 1700000010), null);
  assert.equal(verifyInvitationProxy(key, headers, "GET", "/v1/invitations/preview", 1700000010), null);
  assert.equal(verifyInvitationProxy(key, headers, "POST", "/v1/invitations/preview", 1700000040), null);
  assert.equal(verifyInvitationProxy(key, { ...headers, "x-semse-invitation-client": "203.0.113.2" }, "POST", "/v1/invitations/preview", 1700000010), null);
  assert.equal(verifyInvitationProxy("weak", headers, "POST", "/v1/invitations/preview", 1700000010), null);
});
