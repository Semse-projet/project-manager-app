import { spawnSync } from "node:child_process";
import path from "node:path";

const script = path.join(__dirname, "check-build-env.mjs");

function run(env: Record<string, string>) {
  const result = spawnSync(process.execPath, [script], { env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env }, encoding: "utf8" });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

const pilot = { EAS_BUILD_PROFILE: "pilot", EXPO_PUBLIC_SEMSE_APP_ENV: "pilot" };

describe("eas-build-pre-install pilot guard", () => {
  test("non-pilot profiles are not restricted", () => {
    expect(run({ EAS_BUILD_PROFILE: "production" }).code).toBe(0);
  });
  test("accepts a single HTTPS staging origin", () => {
    expect(run({ ...pilot, EXPO_PUBLIC_SEMSE_API_BASE_URL: "https://staging-api.example/v1" }).code).toBe(0);
  });
  test.each([
    ["missing APP_ENV", { EAS_BUILD_PROFILE: "pilot", EXPO_PUBLIC_SEMSE_API_BASE_URL: "https://staging-api.example" }],
    ["missing URL", { ...pilot }],
    ["production", { ...pilot, EXPO_PUBLIC_SEMSE_API_BASE_URL: "https://api.semseproject.com" }],
    ["production with trailing dot", { ...pilot, EXPO_PUBLIC_SEMSE_API_BASE_URL: "https://api.semseproject.com./v1" }],
    ["production via legacy variable", { ...pilot, EXPO_PUBLIC_SEMSE_API_URL: "https://API.semseproject.com" }],
    ["plain HTTP", { ...pilot, EXPO_PUBLIC_SEMSE_API_BASE_URL: "http://staging-api.example" }],
    ["credentials", { ...pilot, EXPO_PUBLIC_SEMSE_API_BASE_URL: "https://user:pw@staging-api.example" }],
    ["two different origins", { ...pilot, EXPO_PUBLIC_SEMSE_API_BASE_URL: "https://one.example", EXPO_PUBLIC_SEMSE_API_URL: "https://two.example" }],
  ])("blocks: %s", (_label, env) => {
    const { code, out } = run(env as Record<string, string>);
    expect(code).toBe(1);
    expect(out).toMatch(/pilot build blocked/);
    expect(out).not.toMatch(/user:pw/);
  });
});
