import * as SecureStore from "expo-secure-store";

export const API_BASE_URL = process.env.EXPO_PUBLIC_SEMSE_API_BASE_URL ?? "http://localhost:4132";

const ACCESS_TOKEN_KEY = "semse.accessToken";
const REFRESH_TOKEN_KEY = "semse.refreshToken";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setTokens(tokens: { accessToken: string; refreshToken: string }): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function hasSession(): Promise<boolean> {
  return (await getAccessToken()) !== null;
}

/** Rotates the access token using the stored refresh token. Clears the session on failure. */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    await clearTokens();
    return null;
  }

  const json = (await res.json()) as { data: { accessToken: string; refreshToken: string } };
  await setTokens(json.data);
  return json.data.accessToken;
}

/**
 * Talks directly to `apps/api` (no Next.js BFF involved — the mobile app isn't
 * a browser). Every request carries `Authorization: Bearer <accessToken>`; a
 * single 401 triggers one refresh-and-retry before giving up.
 */
export async function apiFetch<T>(path: string, init?: RequestInit, allowRefresh = true): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401 && allowRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch<T>(path, init, false);
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new ApiError(body.error?.message ?? `SEMSE API error ${res.status}`, res.status);
  }

  const json = (await res.json()) as { data: T };
  return json.data;
}
