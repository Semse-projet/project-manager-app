import test from "node:test";
import assert from "node:assert/strict";
import { isCapabilitySelectorEnabled } from "../../apps/web/lib/capability-flag.ts";

const FLAG_ENV_KEYS = [
  "SEMSE_IDENTITY_CAPABILITY_UI_ENABLED",
  "SEMSE_IDENTITY_CAPABILITY_UI_CANARY_TENANT_IDS",
] as const;

function withEnv(values: Partial<Record<(typeof FLAG_ENV_KEYS)[number], string>>, run: () => void) {
  const original = FLAG_ENV_KEYS.map((key) => [key, process.env[key]] as const);
  try {
    for (const key of FLAG_ENV_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(values)) process.env[key] = value;
    run();
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("isCapabilitySelectorEnabled defaults to false with no env configured", () => {
  withEnv({}, () => {
    assert.equal(isCapabilitySelectorEnabled("tenant_default"), false);
  });
});

test("isCapabilitySelectorEnabled is true for every tenant when globally enabled", () => {
  withEnv({ SEMSE_IDENTITY_CAPABILITY_UI_ENABLED: "true" }, () => {
    assert.equal(isCapabilitySelectorEnabled("tenant_default"), true);
    assert.equal(isCapabilitySelectorEnabled("tenant_other"), true);
  });
});

test("isCapabilitySelectorEnabled is true only for allowlisted tenants when not globally enabled", () => {
  withEnv({ SEMSE_IDENTITY_CAPABILITY_UI_CANARY_TENANT_IDS: "tenant_default,tenant_2" }, () => {
    assert.equal(isCapabilitySelectorEnabled("tenant_default"), true);
    assert.equal(isCapabilitySelectorEnabled("tenant_2"), true);
    assert.equal(isCapabilitySelectorEnabled("tenant_other"), false);
  });
});
