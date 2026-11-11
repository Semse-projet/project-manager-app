/**
 * core.header-identity-fail-closed — AC-HI-01..05, AC-HI-10, AC-HI-11.
 *
 * Header-derived identity (x-user-id / x-tenant-id / x-org-id / x-roles) is
 * only allowed when ALL of: AUTH_SECRET is unset, SEMSE_ALLOW_HEADER_IDENTITY
 * is exactly "true", and NODE_ENV is development or test. Anything else must
 * fail closed (503) instead of trusting caller-supplied headers.
 */
import "reflect-metadata";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  headerIdentityAllowed,
  resolveRequestContext,
} from "../dist/common/request-context.js";
import { AuthService } from "../dist/modules/auth/auth.service.js";

const FORGED_HEADERS = {
  "x-user-id": "attacker",
  "x-tenant-id": "victim-tenant",
  "x-org-id": "victim-org",
  "x-roles": "OPS_ADMIN",
};

const ENV_KEYS = ["AUTH_SECRET", "NODE_ENV", "SEMSE_ALLOW_HEADER_IDENTITY"] as const;
type EnvPatch = Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

/** Runs fn with exactly the given env values, restoring the originals after. */
async function withEnv<T>(patch: EnvPatch, fn: () => Promise<T> | T): Promise<T> {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of ENV_KEYS) {
      const value = patch[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return await fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("headerIdentityAllowed (single policy, option A)", () => {
  const allowed: Array<[string, EnvPatch]> = [
    ["development + opt-in", { NODE_ENV: "development", SEMSE_ALLOW_HEADER_IDENTITY: "true" }],
    ["test + opt-in", { NODE_ENV: "test", SEMSE_ALLOW_HEADER_IDENTITY: "true" }],
    ["NODE_ENV with spaces/caps", { NODE_ENV: " Development ", SEMSE_ALLOW_HEADER_IDENTITY: "true" }],
    ["opt-in with surrounding spaces", { NODE_ENV: "test", SEMSE_ALLOW_HEADER_IDENTITY: " true " }],
  ];
  for (const [name, env] of allowed) {
    test("allows: " + name, () => {
      assert.equal(headerIdentityAllowed(env as NodeJS.ProcessEnv), true);
    });
  }

  const denied: Array<[string, EnvPatch]> = [
    ["development without opt-in", { NODE_ENV: "development" }],
    ["test without opt-in", { NODE_ENV: "test" }],
    ["staging + opt-in", { NODE_ENV: "staging", SEMSE_ALLOW_HEADER_IDENTITY: "true" }],
    ["preview + opt-in", { NODE_ENV: "preview", SEMSE_ALLOW_HEADER_IDENTITY: "true" }],
    ["NODE_ENV unset + opt-in", { SEMSE_ALLOW_HEADER_IDENTITY: "true" }],
    ["production + opt-in", { NODE_ENV: "production", SEMSE_ALLOW_HEADER_IDENTITY: "true" }],
    ["Production (caps) + opt-in", { NODE_ENV: " Production ", SEMSE_ALLOW_HEADER_IDENTITY: "true" }],
    ["opt-in = yes", { NODE_ENV: "development", SEMSE_ALLOW_HEADER_IDENTITY: "yes" }],
    ["opt-in = 1", { NODE_ENV: "development", SEMSE_ALLOW_HEADER_IDENTITY: "1" }],
    ["opt-in = TRUE", { NODE_ENV: "development", SEMSE_ALLOW_HEADER_IDENTITY: "TRUE" }],
    ["opt-in empty", { NODE_ENV: "development", SEMSE_ALLOW_HEADER_IDENTITY: "" }],
    ["AUTH_SECRET present", { AUTH_SECRET: "x".repeat(40), NODE_ENV: "development", SEMSE_ALLOW_HEADER_IDENTITY: "true" }],
  ];
  for (const [name, env] of denied) {
    test("denies: " + name, () => {
      assert.equal(headerIdentityAllowed(env as NodeJS.ProcessEnv), false);
    });
  }

  test("defaults to process.env", async () => {
    await withEnv({ NODE_ENV: "staging", SEMSE_ALLOW_HEADER_IDENTITY: "true" }, () => {
      assert.equal(headerIdentityAllowed(), false);
    });
    await withEnv({ NODE_ENV: "test", SEMSE_ALLOW_HEADER_IDENTITY: "true" }, () => {
      assert.equal(headerIdentityAllowed(), true);
    });
  });
});

describe("no AUTH_SECRET: both auth paths share the policy", () => {
  const authService = new AuthService({} as never, {} as never, {} as never, {} as never);
  const viaGuard = (headers: Record<string, unknown>) => authService.authenticateRequest({ headers });
  const viaContext = async (headers: Record<string, unknown>) => resolveRequestContext({ headers });

  for (const [label, run] of [["authenticateRequest", viaGuard], ["resolveRequestContext", viaContext]] as const) {
    for (const nodeEnv of ["staging", "preview", "development", undefined]) {
      test(label + ": forged headers fail closed (503) with NODE_ENV=" + String(nodeEnv) + " and no opt-in", async () => {
        await withEnv({ NODE_ENV: nodeEnv }, async () => {
          await assert.rejects(run(FORGED_HEADERS), (error: any) => {
            assert.equal(error?.getStatus?.(), 503);
            return true;
          });
        });
      });
    }

    test(label + ": staging with the opt-in still fails closed (503)", async () => {
      await withEnv({ NODE_ENV: "staging", SEMSE_ALLOW_HEADER_IDENTITY: "true" }, async () => {
        await assert.rejects(run(FORGED_HEADERS), (error: any) => error?.getStatus?.() === 503);
      });
    });

    test(label + ": production with the opt-in still fails closed (503) — AC-12", async () => {
      await withEnv({ NODE_ENV: "production", SEMSE_ALLOW_HEADER_IDENTITY: "true" }, async () => {
        await assert.rejects(run(FORGED_HEADERS), (error: any) => error?.getStatus?.() === 503);
      });
    });

    test(label + ": local opt-in keeps the dev header contract", async () => {
      await withEnv({ NODE_ENV: "development", SEMSE_ALLOW_HEADER_IDENTITY: "true" }, async () => {
        const ctx = await run(FORGED_HEADERS);
        assert.equal(ctx.tenantId, "victim-tenant");
        assert.deepEqual(ctx.roles, ["OPS_ADMIN"]);
      });
    });
  }

  test("with AUTH_SECRET the opt-in has no effect: headers alone are 401", async () => {
    await withEnv({ AUTH_SECRET: "s".repeat(48), NODE_ENV: "development", SEMSE_ALLOW_HEADER_IDENTITY: "true" }, async () => {
      await assert.rejects(viaGuard(FORGED_HEADERS), (error: any) => error?.getStatus?.() === 401);
      await assert.rejects(viaContext(FORGED_HEADERS), (error: any) => error?.getStatus?.() === 401);
    });
  });
});

describe("AC-HI-11: header identity is parsed only behind the policy", () => {
  const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const allowedFiles = new Set(["src/common/request-context.ts", "src/modules/auth/auth.service.ts"]);
  let offenders: string[] = [];

  before(async () => {
    const walk = async (dir: string): Promise<string[]> => {
      const entries = await readdir(dir, { withFileTypes: true });
      const nested = await Promise.all(entries.map((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return Promise.resolve(entry.name.endsWith(".ts") ? [full] : []);
      }));
      return nested.flat();
    };
    const files = await walk(join(apiRoot, "src"));
    const hits = await Promise.all(files.map(async (file) => {
      const source = await readFile(file, "utf8");
      return source.includes("parseHeaderRequestContext") ? relative(apiRoot, file) : null;
    }));
    offenders = hits.filter((hit): hit is string => hit !== null && !allowedFiles.has(hit));
  });

  after(() => { offenders = []; });

  test("no controller or service calls parseHeaderRequestContext directly", () => {
    assert.deepEqual(offenders, [],
      "use resolveRequestContext(req) so identity comes from the verified auth context");
  });
});
