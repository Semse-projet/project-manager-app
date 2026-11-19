#!/usr/bin/env node
// EAS hook (eas-build-pre-install): stops a pilot build before it compiles if
// its API origin is missing, is not HTTPS, is production, or the two URL
// variables disagree. Mirrors resolveApiBaseUrl() in src/config/environment.ts,
// which enforces the same rules again at app start-up (defence in depth).
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

const origins = values.map((value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("the API URL is not a valid URL.");
  }
  if (url.protocol !== "https:") fail("the API URL must use HTTPS.");
  if (url.username || url.password || url.search || url.hash) fail("the API URL must not carry credentials or parameters.");
  const path = url.pathname.replace(/\/+$/, "");
  if (path !== "" && path !== "/v1") fail("the API URL must be an origin (optionally ending in /v1).");
  // "api.semseproject.com." (trailing dot) is the same DNS name as production.
  const host = url.hostname.replace(/\.+$/, "");
  if (!host) fail("the API URL has no host.");
  if (host === PRODUCTION_HOST) fail("the API URL points to production.");
  return `${url.protocol}//${host}${url.port ? `:${url.port}` : ""}`;
});
if (new Set(origins).size > 1) fail("EXPO_PUBLIC_SEMSE_API_BASE_URL and EXPO_PUBLIC_SEMSE_API_URL point to different origins.");
console.log("[check-build-env] pilot build: staging API origin accepted.");
