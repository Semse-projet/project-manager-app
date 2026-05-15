import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { token?: string; newPassword?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido" }, { status: 400 });
  }

  const { token, newPassword } = body;
  if (!token || !newPassword) {
    return NextResponse.json({ ok: false, error: "token y newPassword son requeridos" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ ok: false, error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }

  const apiBaseUrl = process.env.SEMSE_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json({ ok: false, error: "Backend no configurado" }, { status: 503 });
  }

  try {
    const response = await fetch(`${apiBaseUrl}/v1/auth/password-reset/confirm`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      data?: unknown;
      error?: { message?: string };
    };

    if (!response.ok) {
      const msg = payload.error?.message ?? "Token inválido o expirado";
      return NextResponse.json(
        { ok: false, error: msg },
        { status: response.status, headers: { "cache-control": "no-store" } },
      );
    }

    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json(
      { ok: false, error: "No se pudo conectar con el servidor" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
