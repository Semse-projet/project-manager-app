import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const limit = request.nextUrl.searchParams.get("limit") ?? "12";
    const apiBase = process.env.SEMSE_API_BASE_URL ?? "http://127.0.0.1:4000";
    const response = await fetch(`${apiBase}/v1/intelligence/public/openings?limit=${encodeURIComponent(limit)}`, {
      cache: "no-store",
      headers: {
        "x-tenant-id": process.env.SEMSE_TENANT_ID ?? "tenant_default",
      },
    });

    const json = await response.json() as { data?: unknown; error?: { message?: string } };
    if (!response.ok) {
      return NextResponse.json(
        { error: { message: json.error?.message ?? "No se pudieron cargar las vacantes." } },
        { status: response.status },
      );
    }

    return NextResponse.json({ data: json.data });
  } catch {
    return NextResponse.json({ error: { message: "Service unavailable" } }, { status: 503 });
  }
}
