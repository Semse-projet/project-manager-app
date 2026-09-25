import test from "node:test";
import assert from "node:assert/strict";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../dist/modules/auth/auth.service.js";
import { hashPassword } from "../dist/common/auth-password.js";

// ADR-040 / docs/specs/core/org-membership-status.spec.md — AuthRepository.
// findUserByEmail now filters memberships by `status: "ACTIVE"` at the query
// level (apps/api/src/modules/auth/auth.repository.ts). AuthService itself is
// unchanged: it already fails closed via "Usuario sin membresía activa" when
// `user.memberships` is empty, which is exactly what happens once the
// repository excludes SUSPENDED/REVOKED/INVITED rows. These tests exercise
// that existing fail-closed path with the repository behavior it now relies
// on, mocked at the boundary — the real Prisma `where` clause itself is
// covered by reading the migration/schema, not re-asserted here without a DB.

const PASSWORD = "a much longer SEMSE passphrase";

function createService(memberships: Array<{ orgId: string; role: { key: string }; org: { tenantId: string } }>) {
  const passwordHash = hashPassword(PASSWORD);
  const repository = {
    async findUserByEmail(email: string) {
      return {
        id: "usr_multi_org",
        email,
        passwordHash,
        status: "active",
        memberships,
      };
    },
  };

  const sessions: unknown[] = [];
  const authRepositoryForSessions = {
    createSession: async (input: unknown) => {
      sessions.push(input);
      return input;
    },
  };

  const auditService = { async append() {} };
  const emailService = { async send() { return { sent: true }; } };
  const logger = { warn() {}, error() {} };

  const combinedRepository = { ...repository, ...authRepositoryForSessions };

  return {
    service: new AuthService(
      combinedRepository as never,
      auditService as never,
      emailService as never,
      logger as never,
    ),
  };
}

test("login succeeds and scopes roles to the primary org when only ACTIVE memberships are returned", async () => {
  // Simulates AuthRepository already excluding a SUSPENDED row for org_b —
  // only the two ACTIVE memberships for org_a reach AuthService.
  const { service } = createService([
    { orgId: "org_a", role: { key: "CLIENT" }, org: { tenantId: "tenant_default" } },
    { orgId: "org_a", role: { key: "PRO" }, org: { tenantId: "tenant_default" } },
  ]);

  process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-not-for-prod-use-only-32chars";
  const result = await service.loginWithPassword({
    email: "multi@semseproject.com",
    password: PASSWORD,
    requestId: "req_login_1",
  });

  assert.ok(result.token);
  assert.ok(result.sessionId);
});

test("login fails closed with 'no active membership' when every membership was filtered out (all SUSPENDED/REVOKED)", async () => {
  // Simulates the real-world case this slice exists to fix: a user whose
  // only memberships are non-ACTIVE. AuthRepository.findUserByEmail's
  // `where: { status: "ACTIVE" }` filter means `memberships` arrives empty
  // here, exactly like a user with zero memberships ever had.
  const { service } = createService([]);

  process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-not-for-prod-use-only-32chars";
  await assert.rejects(
    service.loginWithPassword({
      email: "revoked@semseproject.com",
      password: PASSWORD,
      requestId: "req_login_2",
    }),
    UnauthorizedException,
  );
});
