import test from "node:test";
import assert from "node:assert/strict";
import { validateApiEnv } from "../src/config/env.schema.ts";

test("validateApiEnv accepts development env without AUTH_SECRET", () => {
  const env = validateApiEnv({
    NODE_ENV: "development",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/semse"
  });

  assert.equal(env.NODE_ENV, "development");
  assert.equal(env.PORT, 4000);
  assert.equal(env.RATE_LIMIT_LIMIT, 20);
});

test("validateApiEnv requires AUTH_SECRET in production", () => {
  assert.throws(
    () =>
      validateApiEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/semse"
      }),
    /AUTH_SECRET/
  );
});
