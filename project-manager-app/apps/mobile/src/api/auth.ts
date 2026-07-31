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

export async function logout(): Promise<void> {
  await clearTokens();
}

export function isAuthError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
