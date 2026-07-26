import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profileSource = readFileSync(
  "apps/web/app/(app)/worker/profile/page.tsx",
  "utf8",
);
const usersControllerSource = readFileSync(
  "apps/api/src/modules/users/users.controller.ts",
  "utf8",
);
const usersPolicySource = readFileSync(
  "apps/api/src/modules/users/users.policy.ts",
  "utf8",
);
const usersServiceSource = readFileSync(
  "apps/api/src/modules/users/users.service.ts",
  "utf8",
);

test("worker profile no longer calls the administrative verification endpoint", () => {
  assert.doesNotMatch(profileSource, /\/api\/semse\/users\/\$\{currentUser\.id\}\/verify/);
  assert.doesNotMatch(profileSource, /requestVerification/);
  assert.doesNotMatch(profileSource, /verificationType/);
});

test("unverified profile explains the review gate without a fake request action", () => {
  assert.match(profileSource, /Verificación en preparación/);
  assert.match(profileSource, /no enviará tus datos al endpoint administrativo/i);
  assert.match(profileSource, /cola, evidencia y proveedor de identidad aprobados/i);
  assert.match(profileSource, /Próximamente/);
  assert.doesNotMatch(profileSource, />Solicitar</);
  assert.doesNotMatch(profileSource, /Solicitud enviada/);
});

test("the existing verify operation remains an OPS-only administrative boundary", () => {
  const verifyRoute = usersControllerSource.slice(
    usersControllerSource.indexOf('@Post(":userId/verify")'),
    usersControllerSource.indexOf('@Patch(":userId/status")'),
  );

  assert.match(verifyRoute, /@RequirePermissions\("users:verify"\)/);
  assert.match(usersServiceSource, /if \(!canVerifyUser\(input\)\)/);
  assert.match(usersPolicySource, /actor\.roles\.includes\("OPS_ADMIN"\)/);
});
