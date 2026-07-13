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

type ApiEnvelope<T> = {
  requestId: string;
  data: T;
  error?: { message?: string; status?: number };
};

type ApiRegisterData = {
  accessToken?: string;
  token?: string;
};

type ApiMeData = Omit<SessionPayload, "exp">;

async function fetchApiEnvelope<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { ...(init?.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok || !payload.data) {
    const msg = payload.error?.message ?? `${url} returned ${response.status}`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
  return payload.data;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { email?: string; password?: string; name?: string; role?: string; redirectTo?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido" }, { status: 400 });
  }

  const { email, password, name, role } = body;
  if (!email || !password || !name) {
    return NextResponse.json({ ok: false, error: "email, password y nombre son requeridos" }, { status: 400 });
  }

  const apiBaseUrl = process.env.SEMSE_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json({ ok: false, error: "Backend no configurado" }, { status: 503 });
  }

  try {
    const registered = await fetchApiEnvelope<ApiRegisterData>(`${apiBaseUrl}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name, role: role ?? "CLIENT" }),
    });

    const accessToken = registered.accessToken ?? registered.token;
    if (!accessToken) throw new Error("El API no devolvió un token de acceso");

    const identity = await fetchApiEnvelope<ApiMeData>(`${apiBaseUrl}/v1/auth/me`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    const now = Math.floor(Date.now() / 1000);
    const sessionPayload: SessionPayload = { ...identity, exp: now + TTL_SECONDS };

    const appRole = roleFromRoles(sessionPayload.roles);
    const redirectTo = resolveSafeRedirectPath(body.redirectTo, defaultDashboardForRole(appRole));
    const isHttps = req.nextUrl.protocol === "https:";

    const res = NextResponse.json({ ok: true, redirectTo }, { headers: { "cache-control": "no-store" } });
    res.cookies.set({
      name: SESSION_COOKIE,
      value: await encodeSession(sessionPayload),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: TTL_SECONDS,
      secure: isHttps,
    });
    res.cookies.set({
      name: "semse_app_role",
      value: appRole,
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: TTL_SECONDS,
      secure: isHttps,
    });
    return res;
  } catch (err) {
    const errObj = err as Error & { status?: number };
    const status = errObj.status === 409 ? 409 : errObj.status === 429 ? 429 : 400;
    return NextResponse.json(
      { ok: false, error: errObj.message ?? "No se pudo crear la cuenta" },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
}
