/**
 * Local-only escape hatches for the web BFF (audit A3, 2026-11-25).
 *
 * Mirrors the API's `headerIdentityAllowed()` (apps/api/src/common/request-context.ts):
 * a locally manufactured session (demo accounts, public demo password) is only
 * allowed when the developer opts in on purpose. "Not production" is not enough:
 * staging, previews or a missing NODE_ENV must fail closed.
 *
 * Edge-safe: no Node-only imports, so middleware can use it.
 */

export const DEV_SESSION_OPT_IN_ENV = "SEMSE_ALLOW_DEV_SESSION";

/** Minimum length of the HMAC key that signs `semse_session` (docs/auth.md). */
export const MIN_SESSION_SECRET_LENGTH = 32;

const DEV_SESSION_NODE_ENVS = new Set(["development", "test"]);

type Env = Record<string, string | undefined>;

/** True only with NODE_ENV development/test AND SEMSE_ALLOW_DEV_SESSION=true. */
export function devSessionAllowed(env: Env = process.env): boolean {
  if ((env[DEV_SESSION_OPT_IN_ENV] ?? "").trim() !== "true") return false;
  const nodeEnv = (env.NODE_ENV ?? "").trim().toLowerCase();
  return DEV_SESSION_NODE_ENVS.has(nodeEnv);
}

/**
 * The secret that signs and verifies web sessions, or null when none is usable.
 * There is no built-in fallback: a secret that lives in the repository lets anyone
 * forge a session for any role.
 */
export function resolveWebSessionSecret(env: Env = process.env): string | null {
  const explicit = env.SEMSE_WEB_SESSION_SECRET?.trim() || env.AUTH_SECRET?.trim();
  if (!explicit || explicit.length < MIN_SESSION_SECRET_LENGTH) return null;
  return explicit;
}
