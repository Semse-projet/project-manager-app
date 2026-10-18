import { NextRequest, NextResponse } from "next/server";

/**
 * Vista previa pública de una invitación: el destinatario aún no tiene cuenta,
 * así que no hay sesión. La API (`@Public`, 404 neutro) es la que decide; aquí no
 * se reenvía ninguna identidad.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (token.length < 10) {
    return NextResponse.json({ error: { status: 400, message: "Invalid token" } }, { status: 400 });
  }
  const apiBaseUrl = process.env.SEMSE_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json({ error: { status: 503, message: "Backend no configurado" } }, { status: 503 });
  }
  const response = await fetch(`${apiBaseUrl}/v1/invitations/preview`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token })
  });
  const payload = (await response.json().catch(() => ({}))) as { data?: unknown };
  if (!response.ok || !payload.data) {
    const status = response.status === 429 ? 429 : 404;
    return NextResponse.json({ error: { status, message: "Invitation not available" } }, { status });
  }
  return NextResponse.json({ data: payload.data }, { headers: { "cache-control": "no-store" } });
}
