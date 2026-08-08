import { MOBILE_ENV } from "@/lib/config/env";

const TOKEN_KEY = "semse_mobile_token";
const IDENTITY_KEY = "semse_mobile_identity";

export type MobileIdentity = {
  userId: string;
  tenantId: string;
  orgId: string;
  roles: string[];
  email?: string;
};

export type LoginResult = {
  token: string;
  accessToken: string;
  identity: MobileIdentity;
};

// ── Token storage ─────────────────────────────────────────────────────────────

export function saveToken(token: string, identity: MobileIdentity): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // localStorage unavailable in some environments
  }
}

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function getIdentity(): MobileIdentity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as MobileIdentity) : null;
  } catch { return null; }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(IDENTITY_KEY);
  } catch { /* ignore */ }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ── Auth header ───────────────────────────────────────────────────────────────

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Login / Logout ────────────────────────────────────────────────────────────

type ApiEnvelope<T> = { data?: T; error?: { message?: string }; message?: string };
type SessionPayload = { token: string; accessToken?: string; userId?: string; tenantId?: string; orgId?: string; roles?: string[] };

export async function mobileLogin(email: string, password: string): Promise<LoginResult> {
  const apiBase = MOBILE_ENV.runtimeMode === "api-direct"
    ? MOBILE_ENV.apiBaseUrl
    : MOBILE_ENV.bffBaseUrl.replace("/api/semse", "");

  const url = MOBILE_ENV.runtimeMode === "api-direct"
    ? `${MOBILE_ENV.apiBaseUrl}/v1/auth/login`
    : `${apiBase}/api/semse/auth/login`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const payload = await res.json().catch(() => ({})) as ApiEnvelope<SessionPayload>;

  if (!res.ok) {
    throw new Error(payload.error?.message ?? payload.message ?? `Login failed (${res.status})`);
  }

  const session = payload.data ?? (payload as unknown as SessionPayload);
  const token = session.token ?? session.accessToken ?? "";

  if (!token) throw new Error("Server did not return an access token");

  const identity: MobileIdentity = {
    userId: session.userId ?? "unknown",
    tenantId: session.tenantId ?? "default",
    orgId: session.orgId ?? "default",
    roles: session.roles ?? [],
    email,
  };

  saveToken(token, identity);
  return { token, accessToken: token, identity };
}

export function mobileLogout(): void {
  clearSession();
}
