import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { SatelliteScopeGuard } from "../dist/modules/satellites/satellite-scope.guard.js";

// ─────────────────────────────────────────────────────────────────────────────
// SAT-001 anillo 1 — SatelliteScopeGuard: 401 sin token, 403 fuera de scope,
// request.satellite adjunto (caso negativo obligatorio del arnés SAT-000)
// ─────────────────────────────────────────────────────────────────────────────

const IDENTITY = { id: "sat_1", name: "alexa", scopes: ["intake:write", "intake:read"] };

function makeGuard(requiredScopes: string[] | undefined, verifyImpl?: () => Promise<unknown>) {
  const reflector = {
    getAllAndOverride: () => requiredScopes
  };
  const service = {
    verifyToken: verifyImpl ?? (async () => IDENTITY)
  };
  return new SatelliteScopeGuard(reflector as never, service as never);
}

function makeContext(headers: Record<string, unknown>) {
  const request: Record<string, unknown> = { headers };
  return {
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => function handler() {},
      getClass: () => class Controller {}
    },
    request
  };
}

test("SAT-001 guard: sin Authorization ⇒ 401 sin llegar al servicio", async () => {
  let verified = false;
  const guard = makeGuard(["intake:write"], async () => {
    verified = true;
    return IDENTITY;
  });
  const { context } = makeContext({});

  await assert.rejects(() => guard.canActivate(context as never), UnauthorizedException);
  assert.equal(verified, false);
});

test("SAT-001 guard: scheme no-bearer ⇒ 401", async () => {
  const guard = makeGuard(["intake:write"]);
  const { context } = makeContext({ authorization: "Basic abc123" });

  await assert.rejects(() => guard.canActivate(context as never), UnauthorizedException);
});

test("SAT-001 guard: token válido con scopes suficientes ⇒ pasa y adjunta request.satellite", async () => {
  const guard = makeGuard(["intake:write"]);
  const { context, request } = makeContext({ authorization: "Bearer sst_valid" });

  assert.equal(await guard.canActivate(context as never), true);
  assert.deepEqual(request.satellite, IDENTITY);
});

test("SAT-001 guard: scope faltante ⇒ 403 con lista de missing", async () => {
  const guard = makeGuard(["jobs:read", "intake:write"]);
  const { context } = makeContext({ authorization: "Bearer sst_valid" });

  await assert.rejects(
    () => guard.canActivate(context as never),
    (error: unknown) => {
      assert.ok(error instanceof ForbiddenException);
      const body = error.getResponse() as { missing: string[] };
      assert.deepEqual(body.missing, ["jobs:read"]);
      return true;
    }
  );
});

test("SAT-001 guard: sin metadata de scopes solo exige token válido (introspección /me)", async () => {
  const guard = makeGuard(undefined);
  const { context, request } = makeContext({ authorization: "Bearer sst_valid" });

  assert.equal(await guard.canActivate(context as never), true);
  assert.deepEqual(request.satellite, IDENTITY);
});

test("SAT-001 guard: propaga el error del servicio (401 token revocado)", async () => {
  const guard = makeGuard(["intake:write"], async () => {
    throw new UnauthorizedException({ message: "Invalid satellite token" });
  });
  const { context } = makeContext({ authorization: "Bearer sst_revocado" });

  await assert.rejects(() => guard.canActivate(context as never), UnauthorizedException);
});
