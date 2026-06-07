import { type NextRequest, NextResponse } from "next/server";
import {
  encodeSession,
  SESSION_COOKIE,
  roleFromRoles,
  defaultDashboardForRole,
  type SessionPayload,
} from "@/lib/auth";
import { resolveSafeRedirectPath } from "@/lib/safe-redirect";

const TTL_SECONDS = 8 * 60 * 60;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX = 5;
const GENERIC_LOGIN_ERROR = "No se pudo iniciar sesión con esas credenciales";
const DEMO_LOGIN_ENABLED =
  process.env.SEMSE_DEMO_MODE === "true" || process.env.NODE_ENV !== "production";

const DEMO_ACCOUNTS: Record<string, Omit<SessionPayload, "exp">> = {
  "worker@demo.semse": {
    userId: "usr_worker_001",
    tenantId: "tenant_default",
    orgId: "org_pro_001",
    roles: ["PRO"],
  },
  "client@demo.semse": {
    userId: "usr_client_001",
    tenantId: "tenant_default",
    orgId: "org_client_001",
    roles: ["CLIENT"],
  },
  "admin@demo.semse": {
    userId: "usr_admin_001",
    tenantId: "tenant_default",
    orgId: "org_admin_001",
    roles: ["OPS_ADMIN"],
  },
};

type ApiEnvelope<T> = {
  requestId: string;
  data: T;
  error?: {
    message?: string;
    status?: number;
  };
};

type ApiLoginData = {
  accessToken?: string;
  token?: string;
};

type ApiMeData = Omit<SessionPayload, "exp">;

type LoginRateLimitBucket = {
  count: number;
  resetAt: number;
};

const loginRateLimitBuckets = new Map<string, LoginRateLimitBucket>();

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || req.headers.get("x-real-ip")?.trim() || "unknown";
}

function consumeLoginAttempt(req: NextRequest, email: string): { limited: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  for (const [key, bucket] of loginRateLimitBuckets) {
    if (bucket.resetAt <= now) {
      loginRateLimitBuckets.delete(key);
    }
  }

  const keys = [
    `ip:${getClientIp(req)}`,
    `email:${email.toLowerCase().trim()}`,
  ];

  let retryAfterSeconds = 0;
  for (const key of keys) {
    const bucket = loginRateLimitBuckets.get(key);
    if (bucket && bucket.count >= LOGIN_RATE_LIMIT_MAX && bucket.resetAt > now) {
      retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil((bucket.resetAt - now) / 1000));
    }
  }

  if (retryAfterSeconds > 0) {
    return { limited: true, retryAfterSeconds };
  }

  for (const key of keys) {
    const bucket = loginRateLimitBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      loginRateLimitBuckets.set(key, { count: 1, resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS });
    } else {
      bucket.count += 1;
    }
  }

  return { limited: false };
}

function clearLoginAttempts(req: NextRequest, email: string): void {
  loginRateLimitBuckets.delete(`ip:${getClientIp(req)}`);
  loginRateLimitBuckets.delete(`email:${email.toLowerCase().trim()}`);
}

async function fetchApiEnvelope<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message ?? `${url} returned ${response.status}`);
  }

  return payload.data;
}

async function resolveSessionPayload(input: {
  email: string;
  password: string;
}): Promise<Omit<SessionPayload, "exp">> {
  const apiBaseUrl = process.env.SEMSE_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (apiBaseUrl) {
    try {
      const login = await fetchApiEnvelope<ApiLoginData>(`${apiBaseUrl}/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: input.email, password: input.password }),
      });

      const accessToken = login.accessToken ?? login.token;
      if (!accessToken) throw new Error("API login did not return an access token");

      return fetchApiEnvelope<ApiMeData>(`${apiBaseUrl}/v1/auth/me`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
    } catch (apiError) {
      // Fall through to demo mode if API auth lifecycle is not configured
      if (!DEMO_LOGIN_ENABLED) throw apiError;
      const isDemoAccount = input.email.toLowerCase().trim() in DEMO_ACCOUNTS;
      if (!isDemoAccount) throw apiError;
      // API is up but auth is not configured — use demo credentials for local dev
    }
  }

  if (!DEMO_LOGIN_ENABLED) {
    throw new Error("SEMSE authentication backend is not configured");
  }

  const account = DEMO_ACCOUNTS[input.email.toLowerCase().trim()];
  if (!account || input.password !== "demo1234") {
    throw new Error("Credenciales incorrectas");
  }

  return account;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { email?: string; password?: string; redirectTo?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string; redirectTo?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  const rateLimit = consumeLoginAttempt(req, email);
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo más tarde." },
      {
        status: 429,
        headers: {
          "retry-after": String(rateLimit.retryAfterSeconds ?? Math.ceil(LOGIN_RATE_LIMIT_WINDOW_MS / 1000)),
          "cache-control": "no-store",
        },
      },
    );
  }

  try {
    const identity = await resolveSessionPayload({ email, password });
    const now = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = { ...identity, exp: now + TTL_SECONDS };

    const role = roleFromRoles(payload.roles);
    const redirectTo = resolveSafeRedirectPath(body.redirectTo, defaultDashboardForRole(role));
    const isHttps = req.nextUrl.protocol === "https:";

    clearLoginAttempts(req, email);
    const res = NextResponse.json({ ok: true, redirectTo }, { headers: { "cache-control": "no-store" } });
    res.cookies.set({
      name: SESSION_COOKIE,
      value: await encodeSession(payload),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: TTL_SECONDS,
      secure: isHttps,
    });
    res.cookies.set({
      name: "semse_app_role",
      value: role,
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: TTL_SECONDS,
      secure: isHttps,
    });

    return res;
  } catch {
    return NextResponse.json(
      { error: GENERIC_LOGIN_ERROR },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
}
