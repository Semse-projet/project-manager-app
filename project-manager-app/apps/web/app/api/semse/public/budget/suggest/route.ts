import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const apiBase = process.env.SEMSE_API_BASE_URL ?? "http://127.0.0.1:4000";
    const response = await fetch(`${apiBase}/v1/intelligence/public/budget/suggest`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": process.env.SEMSE_TENANT_ID ?? "tenant_default",
      },
      body: JSON.stringify(body),
    });

    const json = await response.json() as { data?: unknown; error?: { message?: string } };
    if (!response.ok) {
      return NextResponse.json(
        { error: { message: json.error?.message ?? "No se pudo calcular el presupuesto." } },
        { status: response.status },
      );
    }

    return NextResponse.json({ data: json.data });
  } catch {
    return NextResponse.json({ error: { message: "Service unavailable" } }, { status: 503 });
  }
}
