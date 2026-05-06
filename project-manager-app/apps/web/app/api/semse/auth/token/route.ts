import { type NextRequest, NextResponse } from "next/server";
import {
  encodeSession,
  SESSION_COOKIE,
  roleFromRoles,
  defaultDashboardForRole,
  type SessionPayload,
} from "@/lib/auth";

const TTL_SECONDS = 8 * 60 * 60;
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

function resolveSafeRedirectPath(input: unknown, fallback: string): string {
  if (typeof input !== "string") return fallback;
  const value = input.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
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

  try {
    const identity = await resolveSessionPayload({ email, password });
    const now = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = { ...identity, exp: now + TTL_SECONDS };

    const role = roleFromRoles(payload.roles);
    const redirectTo = resolveSafeRedirectPath(body.redirectTo, defaultDashboardForRole(role));
    const isHttps = req.nextUrl.protocol === "https:";

    const res = NextResponse.json({ ok: true, redirectTo });
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar sesión";
    const status = message === "Credenciales incorrectas" ? 401 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
