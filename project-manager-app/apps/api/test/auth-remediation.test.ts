import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";

import { sha256 } from "../dist/common/auth-password.js";
import { AuthController } from "../dist/modules/auth/auth.controller.js";
import { AuthRepository } from "../dist/modules/auth/auth.repository.js";
import { AuthService } from "../dist/modules/auth/auth.service.js";

const VALID_BOOTSTRAP_BODY = {
  userId: "usr_test",
  tenantId: "tenant_test",
  orgId: "org_test",
  roles: ["CLIENT"],
};

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("auth bootstrap fails closed in production and accepts only the configured secret", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalBootstrapToken = process.env.SEMSE_BOOTSTRAP_TOKEN;
  const issued: unknown[] = [];
  const controller = new AuthController({
    async issueSession(input: unknown) {
      issued.push(input);
      return { accessToken: "access", refreshToken: "refresh" };
    },
  } as never);

  try {
    process.env.NODE_ENV = "production";
    delete process.env.SEMSE_BOOTSTRAP_TOKEN;
    await assert.rejects(
      controller.issueToken({ headers: {} }, VALID_BOOTSTRAP_BODY),
      (error: unknown) => error instanceof ForbiddenException,
    );

    process.env.SEMSE_BOOTSTRAP_TOKEN = "server-only-bootstrap-secret";
    await assert.rejects(
      controller.issueToken(
        { headers: { "x-semse-bootstrap-token": "wrong" } },
        VALID_BOOTSTRAP_BODY,
      ),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const response = await controller.issueToken(
      { headers: { "x-semse-bootstrap-token": "server-only-bootstrap-secret" } },
      VALID_BOOTSTRAP_BODY,
    );
    assert.equal(response.data.accessToken, "access");
    assert.equal(issued.length, 1);
  } finally {
    restoreEnv("NODE_ENV", originalNodeEnv);
    restoreEnv("SEMSE_BOOTSTRAP_TOKEN", originalBootstrapToken);
  }
});

test("logout revokes the current persisted session and records the audit event", async () => {
  const revokedSessionIds: string[] = [];
  const auditRows: Array<{ action: string; entityId: string }> = [];
  const service = new AuthService(
    {
      async revokeSession(sessionId: string) {
        revokedSessionIds.push(sessionId);
      },
    } as never,
    {
      async append(input: { action: string; entityId: string }) {
        auditRows.push(input);
      },
    } as never,
    { async send() { return { sent: true }; } } as never,
  );

  const response = await service.logout({
    sessionId: "session_current",
    userId: "usr_known",
    tenantId: "tenant_known",
    orgId: "org_known",
    roles: ["CLIENT"],
    requestId: "req_logout",
  });

  assert.deepEqual(response, {
    sessionId: "session_current",
    status: "revoked",
  });
  assert.deepEqual(revokedSessionIds, ["session_current"]);
  assert.equal(auditRows[0]?.action, "auth.session.revoked");
  assert.equal(auditRows[0]?.entityId, "session_current");
});

test("refresh lookup only accepts active, non-revoked persisted sessions", async () => {
  let lookup:
    | { where?: Record<string, unknown> }
    | undefined;
  const repository = new AuthRepository({
    authSession: {
      async findFirst(input: { where?: Record<string, unknown> }) {
        lookup = input;
        return null;
      },
    },
  } as never);

  const result = await repository.findSessionByRefreshTokenHash("refresh-hash");

  assert.equal(result, null);
  assert.deepEqual(lookup?.where, {
    refreshTokenHash: "refresh-hash",
    status: "ACTIVE",
    revokedAt: null,
  });
});

test("password-reset request is non-enumerable and never returns a production token", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalWebBaseUrl = process.env.SEMSE_WEB_BASE_URL;
  const lookups: string[] = [];
  const resetTokens: Array<{ userId: string; tokenHash: string; expiresAt: Date }> = [];
  const sentEmails: Array<{ to: string; subject: string; html: string; text?: string }> = [];

  const repository = {
    async findUserByEmail(email: string) {
      lookups.push(email);
      if (email === "known@example.com") {
        return { id: "usr_known", email: "known@example.com" };
      }
      return null;
    },
    async createPasswordResetToken(input: { userId: string; tokenHash: string; expiresAt: Date }) {
      resetTokens.push(input);
    },
  };
  const audit = { async append() {} };
  const email = {
    async send(input: { to: string; subject: string; html: string; text?: string }) {
      sentEmails.push(input);
      return { sent: true };
    },
  };
  const service = new AuthService(repository as never, audit as never, email as never);

  try {
    process.env.NODE_ENV = "production";
    process.env.SEMSE_WEB_BASE_URL = "https://app.semseproject.com/";

    const unknown = await service.requestPasswordReset({
      email: "missing@example.com",
      requestId: "req_missing",
    });
    const known = await service.requestPasswordReset({
      email: "  KNOWN@EXAMPLE.COM ",
      requestId: "req_known",
    });

    assert.equal(JSON.stringify(known), JSON.stringify(unknown));
    assert.equal(JSON.stringify(known).includes("token"), false);
    assert.deepEqual(lookups, ["missing@example.com", "known@example.com"]);
    assert.equal(resetTokens.length, 1);
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0]?.to, "known@example.com");

    const resetText = sentEmails[0]?.text ?? "";
    const tokenMatch = /[?&]token=([^\s]+)/.exec(resetText);
    assert.ok(tokenMatch?.[1], "email must contain the reset token");
    assert.equal(
      resetTokens[0]?.tokenHash,
      sha256(decodeURIComponent(tokenMatch[1])),
      "only the token hash may be persisted",
    );
    assert.match(resetText, /^Restablece tu contraseña de SEMSE: https:\/\/app\.semseproject\.com\/reset-password\?token=/);
  } finally {
    restoreEnv("NODE_ENV", originalNodeEnv);
    restoreEnv("SEMSE_WEB_BASE_URL", originalWebBaseUrl);
  }
});

test("password-reset provider failure preserves the generic response", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const repository = {
    async findUserByEmail() {
      return { id: "usr_known", email: "known@example.com" };
    },
    async createPasswordResetToken() {},
  };
  const service = new AuthService(
    repository as never,
    { async append() {} } as never,
    { async send() { return { sent: false, error: "provider unavailable" }; } } as never,
  );

  try {
    process.env.NODE_ENV = "production";
    const response = await service.requestPasswordReset({
      email: "known@example.com",
      requestId: "req_provider_failure",
    });
    assert.deepEqual(response, { status: "accepted" });
  } finally {
    restoreEnv("NODE_ENV", originalNodeEnv);
  }
});

test("confirming a reset hashes the raw token before repository access", async () => {
  let consumed:
    | { tokenHash: string; passwordHash: string }
    | undefined;
  const repository = {
    async consumePasswordResetToken(input: { tokenHash: string; passwordHash: string }) {
      consumed = input;
      return { id: "usr_known", email: "known@example.com" };
    },
  };
  const auditRows: unknown[] = [];
  const service = new AuthService(
    repository as never,
    { async append(input: unknown) { auditRows.push(input); } } as never,
    { async send() { return { sent: true }; } } as never,
  );

  const response = await service.confirmPasswordReset({
    token: "raw-reset-token",
    newPassword: "A-valid-password-123!",
    requestId: "req_confirm",
  });

  assert.equal(consumed?.tokenHash, sha256("raw-reset-token"));
  assert.notEqual(consumed?.passwordHash, "A-valid-password-123!");
  assert.equal(response.status, "updated");
  assert.equal(auditRows.length, 1);
});

test("consumePasswordResetToken is one-use and revokes persisted user sessions", async () => {
  type RepositoryCall = {
    where?: Record<string, unknown>;
    data?: Record<string, unknown>;
  };
  const calls: Record<string, RepositoryCall[]> = {
    tokenFind: [],
    tokenUpdate: [],
    userUpdate: [],
    sessionUpdate: [],
  };
  const transaction = {
    passwordResetToken: {
      async findFirst(input: RepositoryCall) {
        calls.tokenFind.push(input);
        return { id: "prt_1", userId: "usr_known" };
      },
      async update(input: RepositoryCall) {
        calls.tokenUpdate.push(input);
      },
    },
    user: {
      async update(input: RepositoryCall) {
        calls.userUpdate.push(input);
        return { id: "usr_known", email: "known@example.com" };
      },
    },
    authSession: {
      async updateMany(input: RepositoryCall) {
        calls.sessionUpdate.push(input);
      },
    },
  };
  const repository = new AuthRepository({
    async $transaction(callback: (tx: typeof transaction) => unknown) {
      return callback(transaction);
    },
  } as never);

  const result = await repository.consumePasswordResetToken({
    tokenHash: "hashed-token",
    passwordHash: "hashed-password",
  });

  assert.equal(result.id, "usr_known");
  assert.equal(calls.tokenFind.length, 1);
  assert.equal(calls.tokenFind[0]?.where?.tokenHash, "hashed-token");
  assert.equal(calls.tokenFind[0]?.where?.status, "ACTIVE");
  assert.deepEqual(calls.tokenUpdate[0], {
    where: { id: "prt_1" },
    data: { status: "CONSUMED", consumedAt: calls.tokenUpdate[0]?.data?.consumedAt },
  });
  assert.equal(calls.tokenUpdate[0]?.data?.consumedAt instanceof Date, true);
  assert.equal(calls.sessionUpdate[0]?.where?.userId, "usr_known");
  assert.equal(calls.sessionUpdate[0]?.where?.status, "ACTIVE");
  assert.equal(calls.sessionUpdate[0]?.data?.status, "REVOKED");
});

test("consumePasswordResetToken rejects missing, consumed, or expired tokens", async () => {
  const transaction = {
    passwordResetToken: {
      async findFirst() { return null; },
    },
    user: {},
    authSession: {},
  };
  const repository = new AuthRepository({
    async $transaction(callback: (tx: typeof transaction) => unknown) {
      return callback(transaction);
    },
  } as never);

  await assert.rejects(
    repository.consumePasswordResetToken({
      tokenHash: "not-active",
      passwordHash: "hashed-password",
    }),
    (error: unknown) => error instanceof UnauthorizedException,
  );
});
