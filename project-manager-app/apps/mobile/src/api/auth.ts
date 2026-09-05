import type { AuthMeView } from "@semse/schemas";
import { apiFetch, ApiError, clearTokens, setTokens } from "./client";

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
};

export async function login(email: string, password: string): Promise<LoginResult> {
  const data = await apiFetch<LoginResult>(
    "/v1/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    false,
  );
  await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data;
}

/**
 * The only correct source of userId/tenantId/orgId/roles on mobile — do not
 * decode the access token client-side, it's a custom 2-part base64url+HMAC
 * format (apps/api/src/common/auth-token.ts), not a standard JWT.
 */
export async function fetchMe(): Promise<AuthMeView> {
  return apiFetch<AuthMeView>("/v1/auth/me");
}

export async function logout(): Promise<void> {
  await clearTokens();
}

/**
 * Public endpoint (no auth token required). Always resolves without error —
 * the backend intentionally doesn't reveal whether the email exists, so the
 * UI must show the same "check your email" message either way.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiFetch<{ requested: true }>(
    "/v1/auth/password-reset/request",
    { method: "POST", body: JSON.stringify({ email }) },
    false,
  );
}

export function isAuthError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
