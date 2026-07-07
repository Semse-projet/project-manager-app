import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { SatelliteAppGuard } from "../dist/modules/satellites/satellite-app.guard.js";

// ─────────────────────────────────────────────────────────────────────────────
// SAT-003 anillo 1 — SatelliteAppGuard: doble identidad (app token + sesión de
// usuario). Este guard SOLO valida el app token vía x-semse-app-token; la
// sesión de usuario la sigue exigiendo el AuthGuard/RbacGuard normales, que
// corren en paralelo y no se tocan aquí (docs/specs/satellites/SAT-003-mobile-app-client.spec.md)
// ─────────────────────────────────────────────────────────────────────────────

const IDENTITY = { id: "sat_mobile", name: "mobile", scopes: ["jobs:read", "milestones:read"] };

function makeGuard(requiredScopes: string[] | undefined, verifyImpl?: () => Promise<unknown>) {
  const reflector = {
    getAllAndOverride: () => requiredScopes
  };
  const service = {
    verifyToken: verifyImpl ?? (async () => IDENTITY)
  };
  return new SatelliteAppGuard(reflector as never, service as never);
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

test("SAT-003 guard: sin x-semse-app-token ⇒ 401 (aunque venga Authorization de usuario)", async () => {
  let verified = false;
  const guard = makeGuard(["jobs:read"], async () => {
    verified = true;
    return IDENTITY;
  });
  const { context } = makeContext({ authorization: "Bearer user_session_token" });

  await assert.rejects(() => guard.canActivate(context as never), UnauthorizedException);
  assert.equal(verified, false);
});

test("SAT-003 guard: x-semse-app-token vacío ⇒ 401", async () => {
  const guard = makeGuard(["jobs:read"]);
  const { context } = makeContext({ "x-semse-app-token": "   " });

  await assert.rejects(() => guard.canActivate(context as never), UnauthorizedException);
});

test("SAT-003 guard: app token válido con scope suficiente ⇒ pasa y adjunta request.satelliteApp, no toca Authorization", async () => {
  const guard = makeGuard(["jobs:read"]);
  const { context, request } = makeContext({
    authorization: "Bearer user_session_token",
    "x-semse-app-token": "sst_mobile_valid"
  });

  assert.equal(await guard.canActivate(context as never), true);
  assert.deepEqual(request.satelliteApp, IDENTITY);
  assert.equal(request.satellite, undefined, "no debe pisar request.satellite (identidad de SatelliteScopeGuard)");
  assert.equal((request.headers as Record<string, unknown>).authorization, "Bearer user_session_token", "el guard no toca la sesión de usuario");
});

test("SAT-003 guard: app token sin scope requerido ⇒ 403 con missing", async () => {
  const guard = makeGuard(["jobs:write"]);
  const { context } = makeContext({ "x-semse-app-token": "sst_mobile_valid" });

  await assert.rejects(
    () => guard.canActivate(context as never),
    (error: unknown) => {
      assert.ok(error instanceof ForbiddenException);
      const body = error.getResponse() as { missing: string[] };
      assert.deepEqual(body.missing, ["jobs:write"]);
      return true;
    }
  );
});

test("SAT-003 guard: propaga 401 del servicio cuando el app token está revocado", async () => {
  const guard = makeGuard(["jobs:read"], async () => {
    throw new UnauthorizedException({ message: "Invalid satellite token" });
  });
  const { context } = makeContext({ "x-semse-app-token": "sst_revocado" });

  await assert.rejects(() => guard.canActivate(context as never), UnauthorizedException);
});

test("SAT-003 guard: intersección — scopes de la app limitan aunque el usuario tenga más permisos", async () => {
  // La app 'mobile' solo declara jobs:read, milestones:read. Aunque el
  // usuario (via RbacGuard, no modelado aquí) tenga jobs:write, esta ruta
  // exige también jobs:write del lado app ⇒ 403.
  const guard = makeGuard(["jobs:read", "jobs:write"], async () => IDENTITY);
  const { context } = makeContext({ "x-semse-app-token": "sst_mobile_valid" });

  await assert.rejects(
    () => guard.canActivate(context as never),
    (error: unknown) => {
      assert.ok(error instanceof ForbiddenException);
      const body = error.getResponse() as { missing: string[] };
      assert.deepEqual(body.missing, ["jobs:write"]);
      return true;
    }
  );
});
