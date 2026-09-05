import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authPasswordChangeSchema } from "../../packages/schemas/src/api-input.schema.ts";
import { isPublicSemseApiPath } from "../../apps/web/lib/semse-api-auth.ts";

test("password change schema enforces a 15 to 128 character new password", () => {
  assert.equal(
    authPasswordChangeSchema.safeParse({
      currentPassword: "old-password",
      newPassword: "12345678901234",
    }).success,
    false,
  );
  assert.equal(
    authPasswordChangeSchema.safeParse({
      currentPassword: "old-password",
      newPassword: "123456789012345",
    }).success,
    true,
  );
  assert.equal(
    authPasswordChangeSchema.safeParse({
      currentPassword: "old-password",
      newPassword: "x".repeat(128),
    }).success,
    true,
  );
  assert.equal(
    authPasswordChangeSchema.safeParse({
      currentPassword: "old-password",
      newPassword: "x".repeat(129),
    }).success,
    false,
  );
  assert.equal(
    authPasswordChangeSchema.safeParse({
      currentPassword: "",
      newPassword: "123456789012345",
    }).success,
    false,
  );
});

test("password change BFF remains private and proxies to the canonical endpoint", () => {
  assert.equal(
    isPublicSemseApiPath("/api/semse/auth/password-change"),
    false,
  );

  const source = readFileSync(
    "apps/web/app/api/semse/auth/password-change/route.ts",
    "utf8",
  );
  assert.match(source, /fetchSemseDataForRequest/);
  assert.match(source, /\/v1\/auth\/password-change/);
  assert.match(source, /method:\s*"POST"/);
});

test("all role portals mount the shared account center", () => {
  for (const role of ["worker", "client", "admin"]) {
    const source = readFileSync(
      `apps/web/app/(app)/${role}/account/page.tsx`,
      "utf8",
    );
    assert.match(source, /AccountCenter/);
  }

  const sharedSource = readFileSync(
    "apps/web/app/components/account/AccountCenter.tsx",
    "utf8",
  );
  assert.match(sharedSource, /changeMyPassword/);
  assert.match(sharedSource, /updateMyProfile/);
  assert.match(sharedSource, /autocomplete="current-password"/i);
  assert.match(sharedSource, /autocomplete="new-password"/i);
});
