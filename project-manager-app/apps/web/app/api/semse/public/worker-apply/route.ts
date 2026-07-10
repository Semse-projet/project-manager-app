import { type NextRequest, NextResponse } from "next/server";
import { ensureIntakeSession, withIntakeSession } from "../intake/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { sessionToken } = ensureIntakeSession(request);

  try {
    const body = await request.json() as Record<string, unknown>;
    const apiBase = process.env.SEMSE_API_BASE_URL ?? "http://127.0.0.1:4000";
    const response = await fetch(`${apiBase}/v1/workers/applications`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": process.env.SEMSE_TENANT_ID ?? "tenant_default",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify(body),
    });

    const json = await response.json() as { data?: unknown; error?: { message?: string } };
    if (!response.ok) {
      const errorResponse = NextResponse.json(
        { error: { message: json.error?.message ?? "No se pudo enviar tu aplicación." } },
        { status: response.status },
      );
      return withIntakeSession(errorResponse, sessionToken);
    }

    return withIntakeSession(NextResponse.json({ data: json.data }), sessionToken);
  } catch {
    return NextResponse.json({ error: { message: "Service unavailable" } }, { status: 503 });
  }
}
