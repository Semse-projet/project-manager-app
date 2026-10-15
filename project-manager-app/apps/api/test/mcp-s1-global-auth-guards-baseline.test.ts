import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "../dist/common/auth.guard.js";
import { RbacGuard } from "../dist/common/rbac.guard.js";
import { IS_PUBLIC_KEY } from "../dist/common/public.decorator.js";
import { REQUIRED_PERMISSIONS_KEY, AUTHENTICATED_ACCESS_KEY } from "../dist/common/permissions.decorator.js";

/**
 * Tests the existing global NestJS AuthGuard + RbacGuard behavior BEFORE S1.
 * S1 and ADR-045 remain REVIEW/PROPOSED. No OAuth bridge or MCP route exists.
 * Security invariant: a future MCP tools/call route MUST NOT use @Public().
 */

const actor = {
  userId: "user_a",
  tenantId: "tenant_a",
  orgId: "org_a",
  roles: ["PRO"]
};

function context(request: Record<string, unknown>) {
  return {
    getHandler() { return function mcpFutureHandler() {}; },
    getClass() { return class FutureMcpController {}; },
    switchToHttp() { return { getRequest() { return request; } }; }
  };
}

function reflector(options: { public?: boolean; permissions?: string[]; authenticatedReason?: string } = {}) {
  return {
    getAllAndOverride(key: string) {
      if (key === IS_PUBLIC_KEY) return options.public ?? false;
      if (key === REQUIRED_PERMISSIONS_KEY) return options.permissions;
      if (key === AUTHENTICATED_ACCESS_KEY) return options.authenticatedReason;
      return undefined;
    }
  };
}

test("S1 prerequisite: global AuthGuard replaces any caller-injected authContext with validated identity", async () => {
  let authCalls = 0;
  const request = {
    headers: { authorization: "Bearer placeholder" },
    authContext: {
      userId: "attacker",
      tenantId: "other_tenant",
      orgId: "other_org",
      roles: ["OPS_ADMIN"]
    }
  };
  const guard = new AuthGuard(
    reflector() as never,
    {
      async authenticateRequest(req: unknown) {
        authCalls++;
        assert.equal(req, request);
        return actor;
      }
    } as never
  );
  assert.equal(await guard.canActivate(context(request) as never), true);
  assert.equal(authCalls, 1);
  assert.deepEqual(request.authContext, actor);
});

test("S1 prerequisite: invalid OAuth/SEMSE authentication cannot fall through to handler", async () => {
  const request = { headers: { authorization: "Bearer rejected-token" } };
  const guard = new AuthGuard(
    reflector() as never,
    { async authenticateRequest() { throw new UnauthorizedException("Invalid bearer"); } } as never
  );
  await assert.rejects(guard.canActivate(context(request) as never), UnauthorizedException);
  assert.equal("authContext" in request, false);
});

test("S1 prerequisite: RbacGuard denies protected handlers without permission metadata", () => {
  const guard = new RbacGuard(reflector() as never);
  assert.throws(() => guard.canActivate(context({authContext: actor}) as never), ForbiddenException);
});

test("S1 prerequisite: RbacGuard refuses project status mutation permission for PRO", () => {
  const guard = new RbacGuard(reflector({permissions: ["projects:status:update"]}) as never);
  assert.throws(() => guard.canActivate(context({authContext: actor}) as never), ForbiddenException);
});

test("S1 safety warning: @Public currently bypasses BOTH AuthGuard and RbacGuard", async () => {
  const publicReflector = reflector({public: true, permissions: ["projects:read"]});
  let attemptedAuth = false;
  const authGuard = new AuthGuard(publicReflector as never, {
    async authenticateRequest() { attemptedAuth = true; throw new Error("MUST_NOT_RUN"); }
  } as never);
  const rbacGuard = new RbacGuard(publicReflector as never);
  const request = { headers: {} };
  assert.equal(await authGuard.canActivate(context(request) as never), true);
  assert.equal(rbacGuard.canActivate(context(request) as never), true);
  assert.equal(attemptedAuth, false);
  // @Public is only appropriate for separately reviewed OAuth discovery metadata,
  // NOT for future tools/list or tools/call. The MCP OAuth bridge must integrate
  // with protected, server-trusted authContext and required permissions metadata.
});
