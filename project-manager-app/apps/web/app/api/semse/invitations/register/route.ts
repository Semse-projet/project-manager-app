import { type NextRequest, NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE, roleFromRoles, defaultDashboardForRole, type SessionPayload } from "@/lib/auth";

const TTL_SECONDS = 8 * 60 * 60;

type ApiEnvelope<T> = { data?: T; error?: { message?: unknown; status?: number } };
type ApiSessionData = { accessToken?: string; token?: string };
type ApiMeData = Omit<SessionPayload, "exp">;

/**
 * BO-03: el invitado crea su cuenta con el token de la invitación (sin Org propia)
 * y recibe la misma cookie de sesión que el registro normal. El email sale de la
 * invitación en el servidor; aquí nunca se acepta uno.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (token.length < 10 || name.length < 2) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }
  if (password.length < 15 || password.length > 128) {
    return NextResponse.json({ ok: false, error: "La contraseña debe tener entre 15 y 128 caracteres" }, { status: 400 });
  }
  const apiBaseUrl = process.env.SEMSE_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json({ ok: false, error: "Backend no configurado" }, { status: 503 });
  }

  const registered = await fetch(`${apiBaseUrl}/v1/invitations/register`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, name, password })
  });
  const registeredBody = (await registered.json().catch(() => ({}))) as ApiEnvelope<ApiSessionData>;
  const accessToken = registeredBody.data?.accessToken ?? registeredBody.data?.token;
  if (!registered.ok || !accessToken) {
    const status = registered.status === 409 ? 409 : registered.status === 429 ? 429 : 404;
    return NextResponse.json({ ok: false, error: "Invitation not available" }, { status, headers: { "cache-control": "no-store" } });
  }

  const meResponse = await fetch(`${apiBaseUrl}/v1/auth/me`, {
    cache: "no-store",
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const meBody = (await meResponse.json().catch(() => ({}))) as ApiEnvelope<ApiMeData>;
  if (!meResponse.ok || !meBody.data) {
    return NextResponse.json({ ok: false, error: "No se pudo abrir la sesión" }, { status: 502 });
  }

  const sessionPayload: SessionPayload = { ...meBody.data, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  const appRole = roleFromRoles(sessionPayload.roles);
  const isHttps = req.nextUrl.protocol === "https:";
  const res = NextResponse.json(
    { ok: true, redirectTo: defaultDashboardForRole(appRole) },
    { headers: { "cache-control": "no-store" } }
  );
  res.cookies.set({
    name: SESSION_COOKIE,
    value: await encodeSession(sessionPayload),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
    secure: isHttps
  });
  res.cookies.set({
    name: "semse_app_role",
    value: appRole,
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
    secure: isHttps
  });
  return res;
}
