import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { authTokenBodySchema } from "@semse/schemas";
import { parseWithSchema } from "../src/common/zod-validation.ts";

test("parseWithSchema returns typed payload for valid input", () => {
  const result = parseWithSchema(authTokenBodySchema, {
    userId: "usr_test",
    tenantId: "tnt_test",
    orgId: "org_test",
    roles: ["OPS_ADMIN"]
  });

  assert.equal(result.userId, "usr_test");
  assert.deepEqual(result.roles, ["OPS_ADMIN"]);
});

test("parseWithSchema throws BadRequestException for invalid input", () => {
  assert.throws(
    () => parseWithSchema(authTokenBodySchema, { tenantId: "tnt_test", orgId: "org_test" }),
    BadRequestException
  );
});
