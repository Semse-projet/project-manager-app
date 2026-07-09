import { type NextRequest, NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE, type SessionPayload } from "@/lib/auth";

// Cookie legible por el cliente para que la UI muestre el banner de demo.
// No es una credencial: la sesión real viaja en la cookie firmada httpOnly.
// (Sin export: los route files de Next.js solo admiten exports de handlers.)
const DEMO_FLAG_COOKIE = "semse_demo";

type DemoSessionData = {
  userId?: string;
  tenantId?: string;
  orgId?: string;
  roles?: string[];
  farmId?: string;
  expiresInSeconds?: number;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const apiBaseUrl = process.env.SEMSE_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json({ error: "Demo no disponible" }, { status: 404 });
  }

  const upstream = await fetch(`${apiBaseUrl}/v1/demo/session`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ vertical: "agro" }),
  });

  const payload = (await upstream.json().catch(() => ({}))) as {
    data?: DemoSessionData;
    error?: { message?: string };
  };

  if (!upstream.ok || !payload.data?.userId || !payload.data.tenantId || !payload.data.orgId) {
    const status = upstream.status === 429 ? 429 : upstream.status === 404 ? 404 : 502;
    return NextResponse.json(
      { error: payload.error?.message ?? "No se pudo iniciar la demo" },
      { status, headers: { "cache-control": "no-store" } },
    );
  }

  const ttlSeconds = payload.data.expiresInSeconds ?? 30 * 60;
  const now = Math.floor(Date.now() / 1000);
  const session: SessionPayload = {
    userId: payload.data.userId,
    tenantId: payload.data.tenantId,
    orgId: payload.data.orgId,
    roles: payload.data.roles ?? ["DEMO_AGRO"],
    exp: now + ttlSeconds,
  };

  const isHttps = request.nextUrl.protocol === "https:";
  const res = NextResponse.json(
    { ok: true, redirectTo: "/agro", farmId: payload.data.farmId },
    { headers: { "cache-control": "no-store" } },
  );
  res.cookies.set({
    name: SESSION_COOKIE,
    value: await encodeSession(session),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ttlSeconds,
    secure: isHttps,
  });
  res.cookies.set({
    name: DEMO_FLAG_COOKIE,
    value: "agro",
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: ttlSeconds,
    secure: isHttps,
  });
  return res;
}
