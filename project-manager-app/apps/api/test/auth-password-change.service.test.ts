import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../dist/modules/auth/auth.service.js";
import { hashPassword, verifyPassword } from "../dist/common/auth-password.js";

const CURRENT_PASSWORD = "existing-password";
const NEW_PASSWORD = "a much longer SEMSE passphrase";

function createService() {
  const calls = {
    passwordChanges: [] as Array<{
      userId: string;
      currentSessionId: string;
      expectedPasswordHash: string;
      passwordHash: string;
    }>,
    audits: [] as Array<Record<string, unknown>>,
  };

  const repository = {
    async findUserCredentialById(userId: string) {
      return {
        id: userId,
        email: "user@semseproject.com",
        passwordHash: hashPassword(CURRENT_PASSWORD),
        status: "active",
      };
    },
    async changePasswordAndRevokeOtherSessions(input: {
      userId: string;
      currentSessionId: string;
      expectedPasswordHash: string;
      passwordHash: string;
    }) {
      calls.passwordChanges.push(input);
      return { revokedOtherSessions: 2 };
    },
  };

  const auditService = {
    async append(entry: Record<string, unknown>) {
      calls.audits.push(entry);
    },
  };

  const emailService = { async send() { return { sent: true }; } };
  const logger = { warn() {}, error() {} };

  return {
    service: new AuthService(
      repository as never,
      auditService as never,
      emailService as never,
      logger as never,
    ),
    calls,
  };
}

const actor = {
  tenantId: "tenant_default",
  orgId: "org_user",
  userId: "usr_user",
  roles: ["CLIENT"],
  sessionId: "session_current",
  requestId: "req_password_change",
};

test("changePassword updates the hash, preserves current session and audits without secrets", async () => {
  const { service, calls } = createService();

  const result = await service.changePassword({
    ...actor,
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
  });

  assert.deepEqual(result, {
    status: "updated",
    userId: actor.userId,
    revokedOtherSessions: 2,
  });
  assert.equal(calls.passwordChanges.length, 1);
  assert.equal(calls.passwordChanges[0]?.currentSessionId, actor.sessionId);
  assert.equal(
    verifyPassword(
      CURRENT_PASSWORD,
      calls.passwordChanges[0]?.expectedPasswordHash ?? "",
    ),
    true,
  );
  assert.equal(
    verifyPassword(NEW_PASSWORD, calls.passwordChanges[0]?.passwordHash ?? ""),
    true,
  );
  assert.equal(calls.audits.length, 1);
  assert.equal(calls.audits[0]?.action, "user.password_changed");

  const serializedAudit = JSON.stringify(calls.audits[0]);
  assert.equal(serializedAudit.includes(CURRENT_PASSWORD), false);
  assert.equal(serializedAudit.includes(NEW_PASSWORD), false);
  assert.equal(serializedAudit.includes("passwordHash"), false);
});

test("changePassword rejects an incorrect current password without mutation", async () => {
  const { service, calls } = createService();

  await assert.rejects(
    service.changePassword({
      ...actor,
      currentPassword: "incorrect-current-password",
      newPassword: NEW_PASSWORD,
    }),
    UnauthorizedException,
  );

  assert.equal(calls.passwordChanges.length, 0);
  assert.equal(calls.audits.length, 0);
});

test("changePassword rejects reusing the current password", async () => {
  const { service, calls } = createService();

  await assert.rejects(
    service.changePassword({
      ...actor,
      currentPassword: CURRENT_PASSWORD,
      newPassword: CURRENT_PASSWORD,
    }),
    BadRequestException,
  );

  assert.equal(calls.passwordChanges.length, 0);
  assert.equal(calls.audits.length, 0);
});

test("changePassword requires a session-bound authenticated request", async () => {
  const { service, calls } = createService();

  await assert.rejects(
    service.changePassword({
      ...actor,
      sessionId: undefined,
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    }),
    BadRequestException,
  );

  assert.equal(calls.passwordChanges.length, 0);
});
