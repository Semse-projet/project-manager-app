#!/usr/bin/env node
// EAS hook (eas-build-pre-install): stops a pilot build before it compiles if
// its API origin is missing or is production. The same rule is enforced again
// at app start-up in src/config/environment.ts (defence in depth).
// Never prints the configured value: it may be mistyped with credentials.
const PRODUCTION_HOST = "api.semseproject.com";
const profile = process.env.EAS_BUILD_PROFILE ?? "";

if (profile !== "pilot") {
  console.log(`[check-build-env] profile "${profile || "(none)"}": no pilot restrictions.`);
  process.exit(0);
}

const fail = (reason) => {
  console.error(`[check-build-env] pilot build blocked: ${reason}`);
  process.exit(1);
};

if (process.env.EXPO_PUBLIC_SEMSE_APP_ENV !== "pilot") fail("EXPO_PUBLIC_SEMSE_APP_ENV must be \"pilot\".");
const values = [process.env.EXPO_PUBLIC_SEMSE_API_BASE_URL, process.env.EXPO_PUBLIC_SEMSE_API_URL]
  .map((v) => v?.trim())
  .filter(Boolean);
if (values.length === 0) fail("set EXPO_PUBLIC_SEMSE_API_BASE_URL in the EAS \"preview\" environment (staging API).");
for (const value of values) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("the API URL is not a valid URL.");
  }
  if (url.protocol !== "https:") fail("the API URL must use HTTPS.");
  if (url.hostname === PRODUCTION_HOST) fail("the API URL points to production.");
}
console.log("[check-build-env] pilot build: staging API origin accepted.");
